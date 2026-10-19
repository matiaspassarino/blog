# Investigación: Sitio público (landing y blog)

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Se verificó contra el código instalado: `astro@7.4.0`, `@astrojs/vercel@11.0.15` (`node_modules/*/dist`) y el esquema y las migraciones de la spec 001.

---

## D1. Actualización del sitio: caché de rutas de Astro con tags, no ISR por ruta

**Decisión**: desactivar el ISR del adaptador (`isr: false`) y usar el **caché de rutas** de Astro 7. Son la API estable `cache` + `Astro.cache`, con el proveedor `cacheVercel()` de `@astrojs/vercel/cache`.
- Cada página declara `Astro.cache.set({ maxAge, swr, tags })`. Los tags son las entidades que muestra.
- `/api/revalidar` llama a `context.cache.invalidate({ tags })`, y a `invalidate({ path })` para los slugs que cambiaron.
- El proveedor emite `Vercel-CDN-Cache-Control` y `Vercel-Cache-Tag`, e invalida con `invalidateByTag` de `@vercel/functions`. Esa dependencia ya es transitiva del adaptador, así que no se agrega nada.

**Por qué**:
- El ISR de Vercel se revalida **por ruta**, y eso obliga a enumerar todas las URLs afectadas. La spec 001 dejó dos huecos sin cerrar: las páginas de artículos de una etiqueta borrada o de una taxonomía renombrada, y las páginas de listado más allá de la 5.
- Con tags cada página dice qué muestra (`articulo:<id>`, `categoria:<id>`, `autor:<id>`…), así que invalidar una entidad alcanza a todas las páginas que la muestran, sean las que sean. RF-019 queda cubierto **sin cambiar el mensaje de la base**.
- Es la API del core de Astro 7 (`routeRules`, `cache.provider`), no un experimento.

**Alternativas descartadas**:
- **ISR con `x-prerender-revalidate` por ruta** (lo previsto en `astro-seo` §2): no puede enumerar las páginas de artículos de una etiqueta ya borrada, y la paginación queda con un tope arbitrario.
- **Ampliar el mensaje de la base con los slugs de los artículos de cada taxonomía**: necesita un trigger `before delete` nuevo en etiquetas, más un tope de artículos, y no resuelve la paginación.
- **Vencimiento por tiempo solamente**: no cumple RF-020 (menos de 60 s).

**Consecuencias**:
- `rutasAfectadas` (`@blog/db`) se reemplaza por `invalidacionesDe(cambio)`, que devuelve `{ tags, rutas }` ([contracts/cache.md](contracts/cache.md)).
- Se actualiza `contracts/revalidacion.md` de la spec 001.
- `SECRETO_REVALIDACION` queda solo para la firma HMAC: ya no hay `bypassToken`.
- En `astro dev` el caché está desactivado (lo dice el propio core), así que los E2E locales ven siempre datos frescos. La invalidación se prueba en unidad (tags calculados y llamada a `invalidate`) y en el quickstart sobre Vercel.
- **Riesgo**: `invalidateByTag` marca la entrada como vieja (stale). La primera visita después del aviso puede recibir la versión anterior mientras se regenera en segundo plano. Mitigación: `swr` corto (60 s) y `maxAge` largo. El quickstart mide CE-004 en Vercel.
- **Plan B**, si el plan Hobby no permitiera invalidar por tag: volver a ISR por ruta con `invalidacionesDe().rutas`. Ese campo ya existe por los slugs.

## D2. Vida del caché por tipo de página

| Página | `maxAge` | `swr` | Tags |
|---|---|---|---|
| Artículo | 1 año | 60 s | `articulo:<id>`, `categoria:<id>`, `etiqueta:<id>` de cada etiqueta, `autor:<id>`, `articulo:<id>` de cada relacionado |
| `/`, `/blog`, `/blog/pagina/n`, categoría, etiqueta y autor (con sus páginas) | 1 año | 60 s | `articulos`, más `<tipo>:<id>` de la propia taxonomía o autor |
| `/sitemap.xml`, `/rss.xml` | 1 año | 60 s | `articulos` |
| 404 por slug inexistente | 1 hora | 60 s | (tag de ruta automático) |
| Redirecciones 301 por slug anterior | 1 año | — | (tag de ruta automático) |
| `/api/revalidar` | sin caché (`cache.set(false)`) | — | — |

- El tag `articulos` es la "colección": cualquier cambio de un artículo, una taxonomía o un autor lo invalida. Así se cubren los listados de cualquier página, la portada, el sitemap y el feed.
- Una página de listado no lleva un tag por cada tarjeta: alcanza con `articulos`.
- Vercel admite hasta 128 tags por respuesta. El peor caso es un artículo con 1 categoría, 1 autor, 3 relacionados y N etiquetas, así que N está acotado de hecho (la demo usa ≤ 4).

## D3. Invalidación por tipo de aviso

| Aviso (`tipo`) | Tags | Rutas (`invalidate({ path })`) |
|---|---|---|
| `articulo` | `articulos`, `articulo:<id>` | `/blog/<slug>` por cada slug (el actual deja de ser 404; el anterior pasa a ser 301) |
| `categoria` / `etiqueta` | `articulos`, `<tipo>:<id>` | `/blog/<tipo>/<slug>` por cada slug |
| `autor` | `articulos`, `autor:<id>` | ninguna (su slug es inmutable) |

Es idempotente: invalidar dos veces es lo mismo que invalidar una (RF-019, H4-E3).

## D4. Firma del aviso

- La verificación se hace con `node:crypto`: `createHmac('sha256', secreto).update(marca + '.' + cuerpoCrudo)` y `timingSafeEqual` sobre buffers del mismo largo. Se calcula sobre **el texto crudo** (`await request.text()`), antes de parsear (contrato 001).
- La ventana es de ±300 s contra `Date.now()`.
- Las respuestas son estas:
  - `401` si la firma o la marca no son válidas;
  - `400` si el JSON es inválido o no cumple el esquema;
  - `200` con `{ tags, rutas }` si se acepta.
  - `GET` y los demás métodos devuelven `405`.
- El cuerpo se parsea con un esquema Zod del aviso que vive en `@blog/db`, junto al tipo `CambioPublico`, que pasa a derivarse del esquema. Así contrato, tipo y validación tienen una sola fuente. `@blog/db` agrega `zod@4.6.7`, la misma versión que `@blog/bloques`, que ya está en el stack.
- La lógica es una función pura, `verificarAviso({ cuerpo, marca, firma, secreto, ahora })`, en `apps/web/src/lib/aviso.ts`, testeable sin servidor.

## D5. Renderers de bloques: React sin hidratar, en `@blog/bloques`

**Decisión**:
- Un componente React por tipo de bloque, más `<Bloques contenido componentes />`, en `packages/bloques/src/render/`.
- Astro los renderiza **sin directiva `client:`**: salen como HTML estático, sin JS (constitución §IV.2).
- `<Bloques>` recibe por composición un componente `Imagen` (`componentes.Imagen`), para que cada app decida cómo optimiza.

**Por qué**: la constitución (§III y §VI.3) pide que los renderers vivan en `packages/bloques` y se compartan con la vista previa del admin, que es Next/React. Si se escriben en `.astro` dentro de `apps/web`, el panel tendría que duplicarlos, y eso viola §VIII.

**Alternativas descartadas**:
- Componentes `.astro` en `apps/web`: no son reutilizables desde Next.
- Markdown o HTML generado en la base: los bloques son estructurados y no hay HTML guardado.

**Consecuencias**:
- `@blog/bloques` agrega `react@19.3.0` como `peerDependency`, y `react-dom` como devDependency para los tests (`renderToStaticMarkup`).
- Tailwind de `apps/web` escanea `packages/bloques/src/render` (`@source`).
- El resaltado de sintaxis queda **fuera** de esta spec: `<pre><code>` con el lenguaje como etiqueta visible. El resaltado de Shiki es asíncrono y no encaja en un render React síncrono; si hace falta, va con una spec propia.
- React escapa todo el texto por defecto. Está prohibido `dangerouslySetInnerHTML`, y una regla de ESLint del paquete lo hace cumplir (RF-003, H1-E2).

## D6. Video sin JS: `iframe` con `srcdoc`

- El bloque `video` renderiza un `<iframe title={titulo} loading="lazy" srcdoc="…">`. El `srcdoc` contiene la miniatura y un enlace a la URL de *embed* con `autoplay=1`, dentro del mismo iframe.
- El reproductor del proveedor recién se descarga cuando el visitante hace clic. No hay JS en la página (RF-004, RF-025, CE-008).
- YouTube usa `youtube-nocookie.com/embed/<id>` y la miniatura `i.ytimg.com/vi/<id>/hqdefault.jpg`.
- Vimeo usa `player.vimeo.com/video/<id>` y un fondo de tokens con el título. Vimeo no expone una miniatura sin su API.
- Debajo del iframe hay un enlace "Ver en YouTube/Vimeo". Así se cubre el caso borde del proveedor caído.
- **Descartadas**: `lite-youtube` (agrega una dependencia y JS) y un iframe directo (descarga ≈ 1 MB del reproductor y empeora el LCP).

## D7. Imágenes

- `Imagen.ruta` puede ser absoluta (`https://…`, como las de picsum en el seed) o relativa al bucket `medios`. Un helper puro, `urlImagen(ruta, supabaseUrl)` en `apps/web/src/lib/imagenes.ts`, devuelve la URL pública.
- `apps/web` provee el componente `Imagen` para `<Bloques>` y para las tarjetas:
  - genera `srcset` con `getImage()` de `astro:assets` antes del render. Las páginas precalculan las variantes de las imágenes del artículo y pasan un mapa ruta → `{ src, srcset }`, porque React no puede esperar;
  - pone `width`, `height` y `alt`. Si la imagen es decorativa, `alt=""`;
  - usa `loading="lazy"`, salvo la imagen principal (`eager` + `fetchpriority="high"`).
- `imageService: true` (Vercel), con `image.remotePatterns` para el host de Supabase, `picsum.photos` y `fastly.picsum.photos`.
- **Riesgo**: picsum responde con un 302 a fastly. Si el optimizador de Vercel no sigue la redirección, el quickstart lo detecta, y el plan B es un script de demo que sube las imágenes al bucket `medios` y actualiza las rutas del seed.

## D8. Contenido de la landing: módulo TypeScript validado con `astro/zod`

- El contenido vive en `apps/web/src/contenido/landing.ts` y el esquema en `apps/web/src/contenido/esquema.ts`, con `import { z } from 'astro/zod'`. No suma dependencias.
- El esquema se parsea al cargar el módulo: un campo faltante hace fallar `astro build` con la ruta del campo (RF-013c).
- El contenido incluye estos campos:
  - `sitio`: nombre, lema y descripción (el logo es identidad visual y vive en `packages/ui/src/identidad.ts`, §VII.6);
  - `hero`;
  - `propuesta`;
  - `servicios[]`: título, descripción e ícono (un nombre de un set cerrado);
  - `testimonios[]`;
  - `contacto`: número de WhatsApp en formato E.164 sin `+`, mensaje, correo y asunto.
- Los íconos son SVG inline en `apps/web/src/components/iconos/`, en un set cerrado. No hay librería de íconos.
- **Descartadas**:
  - una colección de contenido (`file()` loader): pensada para listas de entradas y no para un objeto único;
  - tablas en la base (lo descartó el usuario).

## D9. Contacto

`enlaceWhatsapp(numero, mensaje)` → `https://wa.me/<numero>?text=<encodeURIComponent(mensaje)>` y `enlaceCorreo(correo, asunto)` → `mailto:<correo>?subject=<…>`. Son puras y tienen tests, en `apps/web/src/lib/contacto.ts`. Los enlaces externos llevan `rel="noopener noreferrer"` (H1-E6).

## D10. Slug de autores: columna en `perfiles` con la maquinaria de slugs de la spec 001

- Se agrega `'autor'` a `tipo_entidad`, se extienden `slug_disponible` y `asignar_slug`, y la columna `perfiles.slug` se completa al crear el perfil. Detalle en [data-model.md](data-model.md).
- La inmutabilidad (aclaración del 2026-10-19) la impone un trigger propio, que rechaza el cambio si viene de un cliente. **No** se toca `proteger_perfil`, para no pisar la ampliación que hará la H6 de la spec 001.
- `ALTER TYPE … ADD VALUE` no se puede usar en la misma transacción que lo crea, así que el enum va en una migración separada.
- **Descartada**: usar el `id` en la URL (no es legible, va contra RSEO y RF-011).

## D11. Notificación de cambios de autor (adelantada de la spec 001, T063)

- El trigger `z90_notificar_cambio_autor` estaba previsto en la H6 de la spec 001, que sigue pendiente. La H4-E7 de esta spec lo necesita, así que se implementa acá y T063 lo deja de incluir.
- Con tags (D1), el mensaje ya no necesita los slugs de los artículos: `{ tipo: 'autor', id, slugs: [<slug del autor>] }`. Se actualiza el contrato de la spec 001.

## D12. URLs canónicas: minúsculas y sin barra final

- `trailingSlash: 'never'` en Astro, y Vercel redirige con un 308 permanente.
- Un middleware (`src/middleware.ts`) redirige con un **301** toda ruta con mayúsculas a su versión en minúsculas, conservando la query (RF-022).
- El mismo middleware agrega `X-Robots-Tag: noindex` cuando `VERCEL_ENV !== 'production'` (RSEO-007, H5-E6).

## D13. 404 y errores

- Si una página dinámica no encuentra la entidad, devuelve `Astro.rewrite('/404')` con estado 404. `src/pages/404.astro` se prerenderiza.
- Los errores de datos (`ErrorDominio` distinto de `no_encontrado`) se propagan a `src/pages/500.astro`, con estado 500. El CDN no cachea 5xx y, mientras tanto, sigue sirviendo la versión anterior por `swr`.
- En la implementación se verifica que `Astro.rewrite('/404')` conserve el estado 404 en el adaptador de Vercel. Si no lo conserva, se usa `new Response(html404, { status: 404 })`.

## D14. Sitemap y RSS propios (se quita `@astrojs/sitemap`)

- `@astrojs/sitemap` solo conoce las rutas estáticas del build. Acá todas son dinámicas y tienen que cambiar con cada aviso.
- `/sitemap.xml` es un endpoint propio sobre `listarParaSitemap` (RPC `entradas_sitemap`, ampliado con autores). Lo genera un helper puro, `xmlSitemap(entradas, sitio)`, con tests.
- `/rss.xml` usa **`@astrojs/rss@4.0.19`**, que está en la tabla de la constitución §II y es anterior al límite de `minimumReleaseAge`, con `listarArticulosPublicados({ porPagina: 20 })`.
- Se quita `@astrojs/sitemap` de `package.json` y de la configuración. knip detectaría la dependencia muerta.

## D15. Variables de entorno: `astro:env`

Se declaran con `env.schema` en `astro.config.mjs`:

| Variable | Contexto | Acceso |
|---|---|---|
| `PUBLIC_URL_SITIO` | server | public |
| `PUBLIC_SUPABASE_URL` | server | public |
| `PUBLIC_SUPABASE_ANON_KEY` | server | public |
| `SECRETO_REVALIDACION` | server | secret, con mínimo de 32 caracteres |

Ya están cargadas en Vercel. Un único módulo, `src/lib/datos.ts`, crea el cliente con `crearClientePublico` (constitución §III.2).

## D16. Tipografías: API de fuentes de Astro 7

- `fonts: [{ provider: fontProviders.fontsource(), name: identidad.fuentes.cuerpo, cssVariable: '--font-cuerpo' }, { name: identidad.fuentes.titulos, cssVariable: '--font-titulos' }]`.
- Los nombres de las familias salen de `packages/ui/src/identidad.ts` (`@blog/ui/identidad`), no de `astro.config.mjs`: así la tipografía se cambia solo en `packages/ui` (§VII.6, análisis C1).
- Las fuentes se descargan en el build y se sirven desde el propio dominio, con `<link rel=preload>` de la fuente del cuerpo. Mejoran el LCP y el CLS (CE-002) y no suman dependencias.
- `tokens.css` conserva el *fallback* de sistema.

## D17. Fechas

Un helper `fechaLarga(iso)` usa `Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' })` y se muestra en un `<time datetime>`. Es el supuesto de la spec.

## D18. Relacionados

`listarRelacionados(c, { id, categoriaId }, 3)` en `@blog/db`:
1. trae hasta 3 artículos publicados de la misma categoría, sin el propio;
2. si faltan, completa con los más recientes, excluyendo los ya elegidos.

Son a lo sumo 2 peticiones (RF-005).
