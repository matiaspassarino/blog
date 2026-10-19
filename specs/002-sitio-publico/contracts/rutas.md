# Contrato: rutas públicas de `apps/web`

Todas son dinámicas (`output: 'server'`) y quedan cacheadas en el CDN según [cache.md](cache.md), salvo las marcadas como prerender.

| Ruta | Archivo | Datos | Respuestas |
|---|---|---|---|
| `/` | `pages/index.astro` | `landing` + `listarArticulosPublicados({porPagina:3})` | 200 |
| `/blog` y `/blog/pagina/[n]` | `pages/blog/[...pagina].astro` | `listarArticulosPublicados` | 200; si `n = 1`, 301 a `/blog`; si `n` no es entero o está fuera de rango, 404 |
| `/blog/[slug]` | `pages/blog/[slug].astro` | `obtenerArticuloPublicado` → si falta, `resolverRedireccion('articulo')` | 200, 301 o 404 |
| `/blog/categoria/[slug]` y `/blog/etiqueta/[slug]`, con `/pagina/[n]` | `pages/blog/categoria/[slug]/[...pagina].astro` y `pages/blog/etiqueta/[slug]/[...pagina].astro`: páginas finas sobre `resolverTaxonomia` (`src/lib/taxonomias.ts`) y `PaginaTaxonomia.astro`. Un segmento dinámico `[taxonomia]` capturaría `/blog/pagina/<n>` | `listarPorCategoria` / `listarPorEtiqueta` → si falta, `resolverRedireccion` | 200 (vacío = `noindex`), 301 o 404 |
| `/blog/autor/[slug]` y `/pagina/[n]` | `pages/blog/autor/[slug]/[...pagina].astro` | `listarPorAutor` | 200 o 404 (sin redirecciones) |
| `/sitemap.xml` | `pages/sitemap.xml.ts` | `listarParaSitemap` | 200 `application/xml` |
| `/rss.xml` | `pages/rss.xml.ts` | `listarArticulosPublicados({porPagina:20})` | 200 `application/rss+xml` |
| `/robots.txt` | `pages/robots.txt.ts` (prerender) | `VERCEL_ENV` | 200 `text/plain` |
| `/404` | `pages/404.astro` (en la función, cacheada una hora; T099: prerenderizada salía vacía en Vercel) | — | 404 |
| `/500` | `pages/500.astro` | — | 500 |
| `/api/revalidar` | `pages/api/revalidar.ts` | — | ver [cache.md](cache.md) |

## Reglas transversales

- **Middleware** (`src/middleware.ts`):
  - si la ruta tiene mayúsculas, redirige con un 301 a su versión en minúsculas;
  - fuera de producción agrega `X-Robots-Tag: noindex`.
- La barra final la resuelve `trailingSlash: 'never'`.
- Todos los listados usan un archivo `[...pagina]`. Acepta `undefined` (la página 1) o `pagina/<n>`; `/blog/pagina` sin número cae en `[slug]` y da 404.
- Un único helper, `resolverPagina(param)` en `src/lib/paginacion.ts`, decide entre página, redirección o 404, y `resolverListado` en `src/lib/listados.ts` lo combina con `resolverEntidad` para todos los listados (implementación de la H2, §VIII).
- La resolución "entidad, si no redirección, si no 404" está en un único helper, `resolverEntidad()` en `src/lib/resolver.ts`, que usan el artículo y las taxonomías.

## Metadatos por ruta (componente único `<Seo />`, RSEO-001 a RSEO-009)

| Ruta | `title` | `description` | JSON-LD | `og:type` |
|---|---|---|---|---|
| `/` | `landing.sitio.nombre` + lema | `landing.sitio.descripcion` | `Organization`, `WebSite` | website |
| `/blog`, `/blog/pagina/n` | "Blog" (+ " — página n") | fija, en `landing.blog` | `CollectionPage`, `BreadcrumbList` | website |
| Artículo | `seo.titulo` | `seo.descripcion` | `BlogPosting`, `BreadcrumbList` | article (+ `article:*`) |
| Categoría o etiqueta | nombre (+ página) | descripción o texto genérico con el nombre | `CollectionPage`, `BreadcrumbList` | website |
| Autor | nombre (+ página) | biografía recortada a 160 caracteres o texto genérico | `ProfilePage` con `Person`, `BreadcrumbList` | profile |
| 404 | "Página no encontrada" | genérica | — | website (`noindex`) |

- Al título se le agrega ` | <nombre del sitio>`, siempre que no supere los 60 caracteres. Si los supera, va sin sufijo.
- La imagen OG es la destacada del artículo o, si no hay, `public/og-generica.png` (1200 × 630).
- Toda página tiene `<link rel="alternate" type="application/rss+xml" href="/rss.xml">`.
