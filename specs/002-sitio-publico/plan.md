# Plan de implementación: Sitio público (landing y blog)

**Rama**: `002-sitio-publico` | **Fecha**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/002-sitio-publico/spec.md`

## Resumen

`apps/web` pasa de placeholder a sitio completo: landing, blog con artículo, listados, categorías, etiquetas y autores, más sitemap, RSS, robots, 404 y el receptor de avisos. Las decisiones técnicas son estas:

- **Render y caché**: todas las páginas se renderizan en el servidor y se cachean en el CDN de Vercel con el **caché de rutas de Astro 7 y tags por entidad** (research D1–D3). Cada página declara qué entidades muestra. El aviso firmado de la base invalida esos tags, y así se resuelve, sin cambiar el mensaje, la actualización de los artículos cuando cambia una taxonomía.
- **Bloques**: se renderizan con **componentes React sin hidratar** en `@blog/bloques/render`, compartibles con la futura vista previa del admin (D5). El video es un `iframe srcdoc`, sin JS (D6).
- **Landing**: su contenido es un **módulo TypeScript validado con `astro/zod`** (D8). El botón de contacto lleva a WhatsApp, con correo como alternativa (D9).
- **Base de datos**: una sola novedad, el **slug inmutable de autores**, más la notificación de cambios de autor adelantada de la H6 de la 001 (D10 y D11).

## Contexto técnico

**Apps / paquetes afectados**:
- `apps/web`: todo el sitio.
- `packages/bloques`: renderers.
- `packages/db`: consultas, tags, esquema del aviso.
- `packages/ui`: tokens nuevos.
- `supabase/`: 2 migraciones y tests.

**Dependencias nuevas**:

| Paquete | Dónde | Justificación |
|---|---|---|
| `@astrojs/rss@4.0.19` | `apps/web` | Está en la constitución §II. Genera el feed válido (RSEO-006). |
| `zod@4.6.7` | `packages/db` | Ya está en el stack (misma versión que `@blog/bloques`). Valida el aviso con una sola fuente para el tipo y el esquema (D4). |
| `react@19.3.0` (peer) / `react-dom@19.3.0` (dev) | `packages/bloques` | Ya está en el stack. Para los renderers compartidos (D5) y sus tests. |
| `@blog/db`, `@blog/bloques` (workspace) | `apps/web` | Acceso a datos y renderers (constitución §III.2). |
| **Se quita** `@astrojs/sitemap` | `apps/web` | No sirve para rutas dinámicas: el sitemap pasa a ser propio (D14). |

Todas requieren la aprobación de `consistencia-codigo` en `/validar`.

**Almacenamiento**:
- `perfiles` gana la columna `slug`.
- Se recrean la vista `autores_publicos` y la RPC `entradas_sitemap`.
- El enum `tipo_entidad` suma `'autor'`.
- Hay 3 triggers nuevos en `perfiles`.

Detalle en [data-model.md](data-model.md). El bucket `medios` no cambia.

**Rutas públicas afectadas**: todas, en [contracts/rutas.md](contracts/rutas.md).
- Estrategia: SSR con caché de CDN e invalidación por tags (D1). Equivale a ISR on-demand en términos de la constitución §IV.1: se sirve HTML ya generado y se regenera solo ante un aviso.
- Prerender (build): `/404` y `/robots.txt`.
- Sin caché: `/api/revalidar`.

**Rutas admin afectadas**: ninguna.

**Revalidación**: la hace `invalidacionesDe(cambio)` → `{ tags, rutas }` ([contracts/cache.md](contracts/cache.md)), y reemplaza a `rutasAfectadas`.

**Metas de rendimiento**: CE-001 y CE-002 (Lighthouse móvil SEO ≥ 95, Performance ≥ 90, Accesibilidad ≥ 95; LCP < 2,5 s, CLS < 0,1, INP < 200 ms), sin JS de cliente (CE-008).
- Las fuentes se sirven desde el propio dominio con la API de fuentes de Astro (D16).
- Las imágenes se optimizan con Vercel y llevan dimensiones explícitas (D7).

## Verificación constitucional

*Antes de la fase 0: pasa. Después del diseño: pasa, con una excepción justificada (ver "Seguimiento de complejidad").*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado (sin dependencias no aprobadas) | [x] | Solo paquetes de la tabla §II (`@astrojs/rss`, `zod`, `react`). Se quita `@astrojs/sitemap`. Tiene que aprobarlo `consistencia-codigo`. |
| III. Límites de arquitectura (sin imports entre apps, datos vía `packages/db`) | [x] | `apps/web` solo usa `@blog/db` (con la clave anon) y `@blog/bloques`. Un único `src/lib/datos.ts` crea el cliente. Los renderers viven en `packages/bloques` (§III, §VI.3). |
| IV. SEO primero (pre-render, JS mínimo, metadatos) | [x] | HTML cacheado en el CDN e invalidado on-demand (§IV.1, con el mecanismo D1 en lugar del ISR por ruta). Cero islas: el video es un `iframe srcdoc`. Un `<Seo />` único, JSON-LD, sitemap, RSS y robots. 301 de slugs. Un `h1` por página. |
| V. Datos (migraciones, RLS + pgTAP, nomenclatura en español) | [x] | Dos migraciones versionadas. No hay tablas nuevas. La vista conserva sus grants. Cada trigger o función nueva tiene su pgTAP. Índice para el listado por autor. |
| VI. Bloques (esquema único en `packages/bloques`) | [x] | Los renderers consumen `Contenido` del mismo paquete. No hay definiciones paralelas. |
| VII. Design system (solo tokens, WCAG AA) | [x] | Los tokens nuevos van a `packages/ui/src/tokens.css`. Foco visible, enlace para saltar al contenido, áreas de 44 px y `prefers-reduced-motion`. |
| VIII. No duplicación (sección Reutilización completa) | [x] | Ver la tabla. Hay una tarjeta, un listado, un `<Seo />`, un resolvedor de entidades y un resolvedor de páginas, cada uno usado por todas las rutas. |
| IX. Testing (cada criterio de aceptación → test) | [x] | Ver el plan de pruebas. Los E2E de "filtrar por categoría o etiqueta" (§IX.3) quedan cubiertos. |

## Reutilización *(obligatorio, constitución §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Cliente de datos | `crearClientePublico` (`packages/db/src/cliente.ts`) | `apps/web/src/lib/datos.ts` (instancia única con `astro:env`) | Es solo la instancia, no otro cliente. |
| Artículo por slug | `obtenerArticuloPublicado` | — (se amplía el embebido con `id`/`slug`) | — |
| Redirecciones | `resolverRedireccion` (RPC `resolver_redireccion`) | `apps/web/src/lib/resolver.ts` (entidad → 301 → 404) | Une las 3 ramas para artículo, categoría y etiqueta en un solo lugar. |
| Listados | `listarArticulosPublicados`, `listarPorCategoria`, `listarPorEtiqueta`, `paginaDeArticulos` (privada) | `listarPorAutor`, `listarRelacionados` en `packages/db/src/consultas/listados.ts` | Reutilizan `paginaDeArticulos` con el filtro `autorId`. |
| Paginación | `Pagina<T>`, `rangoDe`, `aPagina` (`packages/db/src/paginacion.ts`) | `apps/web/src/lib/paginacion.ts` (`resolverPagina(param)`: página, 301 o 404) | Lógica de rutas que no existe en `db`. |
| Sitemap | `listarParaSitemap` + RPC `entradas_sitemap` | `apps/web/src/lib/sitemap.ts` (`xmlSitemap`, pura) | Reemplaza la integración `@astrojs/sitemap`, que no ve rutas dinámicas. |
| Invalidación | `CambioPublico`, `rutasAfectadas` (`packages/db/src/rutas-afectadas.ts`) | `packages/db/src/invalidaciones.ts` (`invalidacionesDe`, `esquemaCambioPublico`, `leerCambioPublico`) y `packages/db/src/tags.ts` | **Reemplaza** a `rutas-afectadas.ts` (se borra junto con su test, D1). No convive con él. |
| Esquema de imagen y contenido | `esquemaImagen`, `Imagen`, `Contenido`, `TIPOS_BLOQUE` (`@blog/bloques`) | `packages/bloques/src/render/*` | Los renderers no existían. Se comparten con el admin (D5). |
| Errores | `ErrorDominio`, `traducirError` (`packages/db/src/errores.ts`) | — | `leerCambioPublico` lanza `ErrorDominio('validacion')`. |
| Slug de autor | `privado.slugificar`, `slug_disponible`, `asignar_slug` | `privado.impedir_cambio_slug`, `privado.notificar_cambio_autor` | Inmutabilidad y aviso propios del autor (D10 y D11). |
| Envío del aviso | `privado.notificar_cambio_publico`, `privado.es_publico` | — | El trigger de autor los reutiliza. |
| Tokens | `packages/ui/src/tokens.css` | tokens de espaciado, ancho de lectura y foco (ver "Impacto en UI") | Hoy no hay escala de espaciado ni ancho de lectura. |
| Identidad (fuentes y logo) | `packages/ui` | `packages/ui/src/identidad.ts` + `packages/ui/src/assets/logo.svg` | §VII.6: la identidad se cambia solo en `packages/ui`. `astro.config.mjs` lee las fuentes y la cabecera lee el logo de ahí (análisis C1). |
| Metadatos | — | `apps/web/src/components/Seo.astro` y `src/lib/json-ld.ts` | Componente único (skill `astro-seo` §3). |
| Tarjeta de artículo | — | `apps/web/src/components/TarjetaArticulo.astro` | Una sola, para `/`, listados y relacionados (RF-009). |
| Listado paginado | — | `apps/web/src/components/ListadoArticulos.astro` + `Paginacion.astro` | Uno solo para `/blog`, categoría, etiqueta y autor. |
| Primitivas web | — | `apps/web/src/components/ui/{Boton,Contenedor,Etiqueta}.astro` | Para Astro sin JS. El admin usará shadcn sobre los mismos tokens (§VII.3). |

**Revisado y sin equivalente**: no existen en el repo componentes Astro, helpers de fechas, JSON-LD, firma HMAC del lado receptor ni enlaces de contacto. Se buscó en `apps/`, `packages/` y `.claude/skills/astro-seo`.

## Impacto en base de datos *(revisado con el agente `arquitecto-db`)*

**Revisión del 2026-10-19**: el resultado fue CAMBIOS REQUERIDOS, y ya están aplicados en [data-model.md](data-model.md).
- **Bloqueantes**:
  1. La rama de autores del sitemap ahora pasa por la vista definer, porque `anon` no lee `perfiles`.
  2. La spec 001 se ajustó: T063 ya no crea el trigger de autor y las migraciones de H4–H6 se renumeraron a `20261019…`.
  3. Quedó previsto el test `columns_are` de `autores_publicos`.
- **Menores aplicados**:
  - se ejecutan dos corridas separadas en la nube;
  - el backfill no pisa `actualizado_en`;
  - `default ''` en el slug;
  - un índice no parcial reemplaza a `articulos_autor_idx`;
  - el aviso incluye el cambio de slug por mantenimiento;
  - se suman tests de `activo` y de las opciones de la vista.

- **Migraciones**: `20261019120000_tipo_entidad_autor.sql` y `20261019120100_autores_publicos.sql`.
- **Tablas y columnas**: `perfiles.slug text not null unique`, con un check de formato.
- **Índices**: `perfiles_slug_key` (unique) y `articulos_autor_publicado_idx (autor_id, publicado_en desc)`, que reemplaza a `articulos_autor_idx`.
- **Políticas RLS**: sin cambios. La vista `autores_publicos` sigue siendo la única vía pública a los perfiles (prueba: `autores_slug.test.sql`, que no expone a autores sin publicados).
- **Funciones y triggers**:
  - se redefinen `slug_disponible`, `asignar_slug` y `entradas_sitemap`;
  - son nuevas `impedir_cambio_slug` y `notificar_cambio_autor`;
  - triggers nuevos: `a10_asignar_slug`, `a15_slug_inmutable` y `z90_notificar_cambio_autor`.
- **Cron**: ninguno.
- **Seed**: sin cambios. El slug se genera solo, y `seed.test.sql` verifica que exista.
- **Spec 001**:
  - de T063 se quita el trigger `z90_notificar_cambio_autor`, que pasa a esta spec;
  - en `contracts/revalidacion.md` se actualizan la fila "autor" y la sección `rutasAfectadas` (→ `invalidacionesDe`);
  - las migraciones pendientes de la 001 (H4–H6) tienen que llevar un *timestamp* posterior a `20261019120100`, para que el orden de aplicación coincida con el de autoría.
- **Nube**: se aplican las 2 migraciones (por SQL Editor, que es el mecanismo vigente; ver los pendientes de infraestructura) y se cargan los secretos de Vault `url_web_revalidacion` (la URL de producción de `blog-web`) y `secreto_revalidacion` (igual a la variable de Vercel).

## Impacto en UI y tokens *(revisar con `revisor-ux-ui`)*

**Componentes nuevos**

| Ubicación | Componentes |
|---|---|
| `apps/web/src/layouts/` | `Base.astro` (html, `<Seo />`, cabecera, pie, enlace para saltar al contenido) |
| `apps/web/src/components/` | `Cabecera`, `Pie`, `Seo`, `TarjetaArticulo`, `ListadoArticulos`, `Paginacion`, `Migas`, `FichaAutor`, `Relacionados`, `EstadoVacio`, `ImagenWeb.tsx` (React, para `<Bloques>`) |
| `apps/web/src/components/landing/` | `Hero`, `Propuesta`, `Servicios`, `Testimonios`, `UltimosArticulos`, `Contacto` |
| `apps/web/src/components/iconos/` | set cerrado de SVG |
| `apps/web/src/components/ui/` | `Boton`, `Contenedor`, `Etiqueta` |
| `packages/bloques/src/render/` | un componente por tipo + `Bloques` |

**Tokens nuevos** (`packages/ui/src/tokens.css`)
- Escala de espaciado semántica: `--spacing-seccion`, `--spacing-bloque`.
- `--container-lectura` (≈ 68ch) y `--container-sitio` (≈ 72rem).
- Tipografía fluida para títulos: `--text-titulo-1` a `--text-titulo-3` con `clamp`.
- `--color-foco` y `--color-marca-suave` (fondo de las CTA y del hero).
- `--aspect-tarjeta` (16/9).
- El contraste de cada par texto/fondo se verifica en el test de tokens (≥ 4,5:1 para texto y ≥ 3:1 para UI).

**Estados**
- **Vacío**: listado o taxonomía sin artículos (`EstadoVacio` + `noindex`), y portada sin artículos (la sección se oculta).
- **Error**: `404.astro` y `500.astro`.
- **Carga**: no hay, porque es HTML servido completo.

**Accesibilidad**
- Enlace para saltar al contenido.
- `:focus-visible` con `--color-foco`.
- Navegación con `aria-current="page"`.
- Paginación con `<nav aria-label="Paginación">`.
- Áreas táctiles de 44 px o más.
- `prefers-reduced-motion` desactiva las transiciones.
- `lang="es"`.
- Imágenes decorativas con `alt=""`.
- El iframe del video tiene `title`.
- `<pre tabindex=0>`.

## Plan de pruebas

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| H1-E1 (artículo completo, un único `h1`) | Playwright | `e2e/web/articulo.spec.ts` |
| H1-E1 y RF-002 (10 tipos, orden y variantes) | Vitest | `packages/bloques/src/render/bloques.test.tsx` |
| H1-E2 y RF-003 (texto escapado, esquemas de enlace) | Vitest | `packages/bloques/src/render/seguridad.test.tsx` |
| H1-E3 (decorativa `alt=""`) | Vitest | `packages/bloques/src/render/bloques.test.tsx` |
| H1-E4 y RF-004 (video sin reproductor hasta el clic) | Vitest + Playwright | `render/video.test.tsx`, `e2e/web/articulo.spec.ts` (sin peticiones a youtube al cargar) |
| H1-E5 y RF-006 (404 de borrador, programado, archivado e inexistente) | Playwright | `e2e/web/estados.spec.ts` |
| H1-E6 (CTA externa con `noopener`) | Vitest | `render/seguridad.test.tsx` |
| RF-005 (relacionados) | Vitest (integración) | `packages/db/src/consultas/listados.test.ts` |
| H2-E1, H2-E5, H2-E6 y RF-010 (paginación, fuera de rango, `/pagina/1`) | Vitest + Playwright | `apps/web/src/lib/paginacion.test.ts`, `e2e/web/listados.spec.ts` |
| H2-E2 y H2-E3 (categoría y etiqueta) | Playwright | `e2e/web/listados.spec.ts` |
| H2-E4 (autor sin datos privados) | pgTAP + Playwright | `supabase/tests/autores_slug.test.sql`, `e2e/web/listados.spec.ts` |
| H2-E7 y RSEO-009 (taxonomía vacía con `noindex`) | Playwright | `e2e/web/listados.spec.ts` |
| RF-011 (slug de autor inmutable, homónimos) | pgTAP | `supabase/tests/autores_slug.test.sql` |
| `listarPorAutor` | Vitest (integración) | `packages/db/src/consultas/listados.test.ts` |
| H3-E1 a H3-E3 (secciones, orden, últimos 3, sin artículos) | Playwright + Vitest | `e2e/web/landing.spec.ts`, `apps/web/src/contenido/esquema.test.ts` |
| H3-E4 y RF-013b (WhatsApp y correo) | Vitest + Playwright | `apps/web/src/lib/contacto.test.ts`, `e2e/web/landing.spec.ts` |
| H3-E5 y RF-013c (contenido inválido rompe el build) | Vitest | `apps/web/src/contenido/esquema.test.ts` |
| H4-E1 y RF-019 (tags y rutas por aviso) | Vitest | `packages/db/src/invalidaciones.test.ts`, `apps/web/src/lib/cache.test.ts` |
| H4-E2 y CE-009 (firma inválida o vencida → 401; cuerpo malo → 400) | Vitest | `apps/web/src/lib/aviso.test.ts`, `apps/web/src/lib/revalidar.test.ts` |
| H4-E3 (idempotencia) | Vitest | `apps/web/src/lib/revalidar.test.ts` (el endpoint es una capa fina sobre `procesarAviso` de `lib/revalidar.ts`: un `.test.ts` dentro de `src/pages/` sería una ruta) |
| H4-E4, H4-E5 y CE-005 (301 en un salto) | Playwright | `e2e/web/redirecciones.spec.ts` |
| H4-E6 (taxonomía → páginas de artículos) | Vitest | `apps/web/src/lib/cache.test.ts` (el artículo lleva `categoria:<id>`, y el aviso de categoría invalida ese tag) |
| H4-E7 (aviso de autor) | pgTAP + Vitest | `supabase/tests/autores_slug.test.sql`, `invalidaciones.test.ts` |
| RF-020 y CE-004 (menos de 60 s en producción) | Manual medido | [quickstart.md](quickstart.md) §5 |
| RF-022 (mayúsculas y barra final) | Playwright | `e2e/web/redirecciones.spec.ts` |
| H5-E1 y RSEO-005 (sitemap) | Vitest + Playwright | `apps/web/src/lib/sitemap.test.ts`, `e2e/web/seo.spec.ts` |
| H5-E2 y RSEO-006 (RSS con 20 ítems) | Playwright | `e2e/web/seo.spec.ts` |
| H5-E3, RSEO-001 y CE-003 (metadatos en todas las rutas) | Playwright | `e2e/web/seo.spec.ts` (recorre una muestra de cada tipo de ruta) |
| H5-E4, RSEO-002 y RSEO-003 (JSON-LD) | Vitest + Playwright | `apps/web/src/lib/json-ld.test.ts`, `e2e/web/seo.spec.ts` |
| H5-E5 (robots) y H5-E6 (noindex en preview) | Vitest + Playwright | `apps/web/src/middleware.test.ts`, `e2e/web/seo.spec.ts` |
| RSEO-008 (un `h1`, sin saltos de encabezado) | Playwright | `e2e/web/accesibilidad.spec.ts` |
| CE-006 (WCAG AA, teclado) | Playwright + axe | `e2e/web/accesibilidad.spec.ts` |
| CE-007 (360, 768, 1024 y 1440 px sin desborde) | Playwright | `e2e/web/responsive.spec.ts` |
| CE-008 (sin JS) | Playwright | `e2e/web/accesibilidad.spec.ts` (ningún `<script>` que no sea JSON-LD) |
| CE-001, CE-002 y CE-010 (Lighthouse, validadores) | Manual medido | [quickstart.md](quickstart.md) §6 |
| Casos borde (sin imagen destacada, títulos largos, autor desactivado, ruta inexistente) | Playwright | `e2e/web/estados.spec.ts` |
| Fechas en `es-AR` | Vitest | `apps/web/src/lib/fechas.test.ts` |
| Contraste de tokens | Vitest | `packages/ui/src/tokens.test.ts` |

**Dependencias de test**: `@axe-core/playwright` (devDependency de la raíz) para CE-006. Es una herramienta de test, no de runtime, así que no necesita aprobación §II, pero se justifica igual: es el estándar para verificar WCAG en Playwright.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/002-sitio-publico/
├── plan.md          # Este archivo
├── research.md      # Fase 0: D1–D18
├── data-model.md    # Fase 1: slug de autores
├── quickstart.md    # Fase 1
├── contracts/       # cache.md, rutas.md, bloques-render.md, landing.md
├── tasks.md         # Fase 2 (/speckit-tasks)
└── validacion.md    # Informe de /validar
```

### Código fuente (afectado por esta feature)

```text
apps/web/
├── astro.config.mjs        # isr:false, cache provider, env.schema, fonts, image.remotePatterns, trailingSlash, sin sitemap()
├── public/                 # og-generica.png, favicon
└── src/
    ├── middleware.ts       # minúsculas (301), X-Robots-Tag fuera de producción
    ├── contenido/          # landing.ts, esquema.ts
    ├── assets/landing/     # imágenes de la landing
    ├── layouts/Base.astro
    ├── components/         # Seo, Cabecera, Pie, TarjetaArticulo, ListadoArticulos, Paginacion, Migas,
    │   ├── landing/        #   FichaAutor, Relacionados, EstadoVacio, ImagenWeb.tsx
    │   ├── iconos/
    │   └── ui/
    ├── lib/                # datos, resolver, paginacion, cache, aviso, contacto, imagenes, json-ld, sitemap, fechas
    └── pages/
        ├── index.astro, 404.astro, 500.astro, robots.txt.ts, sitemap.xml.ts, rss.xml.ts
        ├── api/revalidar.ts
        └── blog/
            ├── index.astro, [slug].astro, pagina/[n].astro
            ├── categoria/[slug]/[...pagina].astro
            ├── etiqueta/[slug]/[...pagina].astro
            └── autor/[slug]/[...pagina].astro
packages/
├── db/src/                 # invalidaciones.ts, tags.ts (nuevos); rutas-afectadas.ts (se borra);
│                           # consultas/listados.ts (+listarPorAutor, listarRelacionados); tipos-publicos.ts
├── bloques/src/render/     # un componente por tipo + Bloques (subpath ./render)
└── ui/src/tokens.css       # tokens nuevos
supabase/
├── migrations/20261019120000_tipo_entidad_autor.sql
├── migrations/20261019120100_autores_publicos.sql
└── tests/autores_slug.test.sql (+ privilegios, seed)
e2e/web/                    # articulo, estados, listados, landing, redirecciones, seo, accesibilidad, responsive
```

**Decisión de estructura**:
- Las páginas y los helpers de rutas están en `apps/web`.
- Los datos, los tags y el esquema del aviso están en `packages/db`, porque los comparten el receptor y las páginas.
- Los renderers están en `packages/bloques`, porque los compartirá el admin.

## Seguimiento de complejidad

| Excepción | Por qué es necesaria | Alternativa simple descartada porque |
|---|---|---|
| Skill `astro-seo` §1–2 prevé "ISR on-demand" por ruta. Acá se usa el caché de rutas de Astro con tags (SSR + CDN), que la constitución 1.0.2 (§III.6 y §IV.1) reconoce como ISR. | Es la única forma de cubrir RF-019 (los artículos de una taxonomía renombrada o borrada) y la paginación completa sin ampliar el mensaje de la base (D1). | ISR por ruta: no puede enumerar los artículos de una etiqueta borrada, y obliga a fijar un tope de páginas. La **skill `astro-seo` se actualiza** en esta spec para reflejar el patrón nuevo. |
| §III / §VI.3 piden renderers compartidos, y acá el resaltado de código queda afuera. | Shiki es asíncrono y no encaja en un render React síncrono compartido (D5). | Renderers `.astro`: duplicarían la vista en el admin (§VIII). |
