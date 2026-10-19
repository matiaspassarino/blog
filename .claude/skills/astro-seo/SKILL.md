---
name: astro-seo
description: Patrones del sitio público en Astro de este proyecto (apps/web): rutas del blog, caché de rutas con tags en Vercel, invalidación por avisos firmados de la base, metadatos SEO, JSON-LD, sitemap, RSS, imágenes y renderizado de bloques. Usar SIEMPRE antes de crear o modificar páginas, layouts o componentes en apps/web, o al tocar la invalidación entre la base y web.
---

# Astro + SEO en apps/web

Fuente de verdad: `/constitucion.md` §III, §IV y §VI, y `specs/002-sitio-publico/` (research D1–D18, `contracts/`). Si una API de Astro o de `@astrojs/vercel` no coincide con lo que se describe acá, verificá contra `apps/web/node_modules/astro/dist` (versión fijada en `apps/web/package.json`).

## 1. Render y caché

Todo es SSR (`output: 'server'`) cacheado en el CDN de Vercel con el **caché de rutas de Astro y tags** (research D1). Equivale a ISR on-demand (constitución 1.0.2, §IV.1): se sirve HTML generado y solo se regenera ante una invalidación.

```js
// apps/web/astro.config.mjs (resumen)
adapter: vercel({ imageService: true }),   // sin isr
cache: { provider: cacheVercel() },        // de '@astrojs/vercel/cache'
trailingSlash: 'never',
```

- Cada página declara su política con los helpers de `src/lib/cache.ts`: `cacheArticulo(a, relacionados)`, `cacheListado(entidad?)`, `cacheNoEncontrado()` y `cacheRedireccion()`. **Nunca** escribas tags a mano: el formato sale de `packages/db/src/tags.ts`.
- Prerender (`export const prerender = true`) solo en `/robots.txt` y `/logo.svg`. **La 404 no se prerenderiza**: en Vercel la función no puede leer el `404.html` estático y los 404 dinámicos salían vacíos (T099).
- `astro dev` no cachea: los E2E locales siempre ven datos frescos.

## 2. Invalidación (base → web)

- La base emite un aviso firmado (HMAC-SHA256, contrato de la 001: `X-Blog-Marca-Tiempo`, `X-Blog-Firma: sha256=<hex>`) a `POST /api/revalidar`.
- `src/pages/api/revalidar.ts` es una capa fina sobre `procesarAviso` (`src/lib/revalidar.ts`): firma → 401, contrato (`leerCambioPublico`) → 400, `invalidacionesDe(cambio)` de `@blog/db` → `cache.invalidate({ tags })` e `invalidate({ path })` → 200 o 502.
- Los tests nunca van dentro de `src/pages/`: Astro los tomaría como rutas.
- Para probarlo en local con Docker Desktop en Windows, la URL del Vault apunta a `http://host.docker.internal:4321` y el dev server se levanta con `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=host.docker.internal`.

## 3. Rutas y resolución

| Ruta | Archivo |
|---|---|
| `/` | `pages/index.astro` |
| `/blog`, `/blog/pagina/<n>` | `pages/blog/[...pagina].astro` |
| `/blog/<slug>` | `pages/blog/[slug].astro` |
| `/blog/categoria/<slug>[/pagina/<n>]`, ídem etiqueta | `pages/blog/{categoria,etiqueta}/[slug]/[...pagina].astro` (finas, sobre `lib/taxonomias.ts` y `PaginaTaxonomia.astro`) |
| `/blog/autor/<slug>[/pagina/<n>]` | `pages/blog/autor/[slug]/[...pagina].astro` |
| `/sitemap.xml`, `/rss.xml`, `/robots.txt`, `/api/revalidar` | endpoints `.ts` |

- **Un solo flujo**: `resolverEntidad` (entidad → 301 por slug anterior → 404) y `resolverListado` (página → 301 de `/pagina/1` → 404 fuera de rango o formato inválido). No lo repitas en las páginas.
- **404 de una página dinámica**: `return respuestaNoEncontrado()` (`new Response(null, { status: 404 })`); Astro renderiza `404.astro`. Comprobalo siempre sobre el preview de Vercel, no solo en `astro dev`.
- **Middleware**: 301 a minúsculas (salvo `/_astro`) y `X-Robots-Tag: noindex` cuando `VERCEL_ENV !== 'production'`.
- Un segmento dinámico como `blog/[x]/[y]/[...pagina]` capturaría `/blog/pagina/<n>`: usá segmentos estáticos.

## 4. Metadatos: componente único `<Seo />`

`src/components/Seo.astro`, usado solo a través de `layouts/Base.astro`. Props: `titulo`, `descripcion`, `ruta`, `imagen?`, `tipo` (`website` | `article` | `profile`), `articulo?`, `noindex?`, `jsonLd?: object[]`.

- Agrega ` | <sitio>` al título solo si entra en 60 caracteres; recorta la descripción a 160.
- Canónica absoluta con `PUBLIC_URL_SITIO`, Open Graph (imagen genérica `/og-generica.png` 1200×630), Twitter `summary_large_image`, `article:*` y el `link rel=alternate` del feed.
- JSON-LD con los helpers puros de `src/lib/json-ld.ts` y los datos del sitio de `src/lib/sitio.ts`: `organizacion` + `sitioWeb` (portada), `blogPosting` + `migas` (artículo), `coleccion` + `migas` (listados), `perfil` + `migas` (autor). Se serializa escapando `<`.

## 5. Datos

- Solo `@blog/db`, con la instancia única de `src/lib/datos.ts` (clave anon). Nada de `createClient` en `apps/web`.
- Una página fuera de rango no lanza: `paginaDeArticulos` devuelve vacía con el total real.

## 6. Bloques

- Los renderers son React **sin hidratar** en `@blog/bloques/render` (compartidos con el admin). En Astro: `<Bloques contenido componentes={{ Imagen: crearImagenWeb(variantes) }} />`, **sin** directiva `client:`.
- Párrafos, citas y listas interpretan el Markdown inline de la 001 (`**`, `_`, `` ` ``, `[texto](url)`) con `TextoEnLinea`: nunca HTML crudo. `dangerouslySetInnerHTML` está prohibido por ESLint.
- Enlaces: solo `/…`, `http(s):` y `mailto:` (`hrefSeguro`); los externos con `rel="noopener noreferrer"`.
- Video: `iframe srcdoc` con miniatura y enlace al reproductor; cero JS (research D6).
- Los títulos del cuerpo empiezan en `h2`.

## 7. Imágenes

- Cuerpo del artículo: `precalcularVariantes()` (`src/lib/imagenes.ts`) antes del render y `crearImagenWeb(variantes)`.
- Tarjetas, destacada, avatar y landing: `<Image>` de `astro:assets` con `width`/`height`. Remotas permitidas en `image.remotePatterns` (Supabase, picsum).
- La imagen principal lleva `loading="eager"` y `fetchpriority="high"`; el resto, `lazy`. Decorativas con `alt=""`.

## 8. Identidad y contenido

- Colores, tipografía y logo: solo `packages/ui` (`tokens.css` e `identidad.ts`). `/logo.svg` se genera desde `identidad`.
- Textos de la landing: `src/contenido/landing.ts`, validado con `esquemaLanding` (si falta un campo, falla el build).
- `public/og-generica.png` repite el nombre del sitio: regenerarlo al adaptar la demo a un cliente.

## 9. Checklist antes de dar por terminada una página

- [ ] Un único `h1` y jerarquía sin saltos (`e2e/web/accesibilidad.spec.ts`)
- [ ] `<Seo />` con título y descripción propios, y su JSON-LD (`e2e/web/seo.spec.ts`)
- [ ] Política de caché con los helpers de `lib/cache.ts`
- [ ] En el sitemap si es indexable, o `noindex` si no
- [ ] Sin `client:` salvo justificación en el plan
- [ ] Sin desborde en 360, 768, 1024 y 1440 px (`e2e/web/responsive.spec.ts`)
- [ ] Lighthouse móvil sobre el preview: SEO ≥ 95, Performance ≥ 90, Accesibilidad ≥ 95
