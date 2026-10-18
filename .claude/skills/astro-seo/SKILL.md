---
name: astro-seo
description: Patrones del sitio público en Astro de este proyecto (apps/web): rutas del blog, ISR on-demand en Vercel, revalidación desde el admin, metadatos SEO, JSON-LD, sitemap, RSS, imágenes y renderizado de bloques. Usar SIEMPRE antes de crear o modificar páginas, layouts o componentes en apps/web, o al tocar la revalidación entre admin y web.
---

# Astro + SEO en apps/web

Fuente de verdad: `/constitucion.md` §III, §IV y §VI. Si una API de Astro o de `@astrojs/vercel` no coincide con lo que se describe acá, verificá contra https://docs.astro.build y priorizá la documentación de la versión instalada (`apps/web/package.json`).

## 1. Estrategia de render por ruta

| Ruta | Render | Motivo |
|---|---|---|
| `/` (landing) | estático (build) | No depende del blog, o solo de los últimos artículos (ISR) |
| `/blog`, `/blog/pagina/[n]` | ISR | Listados que cambian al publicar |
| `/blog/[slug]` | ISR | Artículo |
| `/blog/categoria/[slug]`, `/blog/etiqueta/[slug]` | ISR | Taxonomías indexables |
| `/blog/buscar` | SSR (`prerender = false`) + `noindex` | Depende de la query del usuario |
| `/sitemap.xml`, `/rss.xml` | ISR | Se regeneran al publicar |
| `/api/revalidar` | SSR | Endpoint protegido |

Configuración base (`apps/web/astro.config.mjs`):
```js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.PUBLIC_URL_SITIO,
  output: 'server',            // las rutas estáticas se marcan con `export const prerender = true`
  adapter: vercel({
    isr: {
      expiration: false,       // solo se invalida on-demand
      bypassToken: process.env.SECRETO_REVALIDACION, // ≥ 32 caracteres
      exclude: [/^\/api\/.*/, /^\/blog\/buscar/],
    },
    imageService: true,
  }),
  integrations: [react(), sitemap()],
});
```

## 2. Revalidación on-demand (admin → web)

- Las páginas ISR en Vercel se regeneran cuando reciben un `GET`/`HEAD` con el header `x-prerender-revalidate: <bypassToken>`.
- Hay un helper ÚNICO en `packages/db` (o `packages/revalidacion` si el plan lo justifica) llamado `rutasAfectadas(articulo)`, que devuelve: `/blog/<slug>`, `/blog`, las páginas de listado, `/blog/categoria/<cat>`, `/blog/etiqueta/<tag>` de cada etiqueta, `/sitemap.xml`, `/rss.xml` y `/` si la landing muestra artículos. Si cambió el slug, también incluye el slug anterior.
- `apps/admin` llama a `revalidar(rutas)` después de publicar, editar, archivar o borrar.
- El job de `pg_cron` de los artículos programados llama a la Edge Function o al webhook que hace lo mismo.
- **Nunca** dupliques la lista de rutas: siempre se usa `rutasAfectadas`.

## 3. Metadatos: componente único `<Seo />`

Hay UN componente, `apps/web/src/components/Seo.astro`, que usan todos los layouts:
```astro
---
interface Props {
  titulo: string;           // ≤ 60 caracteres; el layout agrega " | <Sitio>"
  descripcion: string;      // 120–160 caracteres
  canonical?: string;       // por defecto: new URL(Astro.url.pathname, Astro.site)
  imagen?: string;          // OG 1200×630
  tipo?: 'website' | 'article';
  noindex?: boolean;
  publicadoEn?: string; actualizadoEn?: string; autor?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}
---
```
Emite `<title>`, `meta description`, `link rel=canonical`, `og:*`, `twitter:*`, `article:*` (si es un artículo), `robots` (si es `noindex`) y `<script type="application/ld+json">`.

Los helpers de JSON-LD van en `apps/web/src/lib/json-ld.ts`: `jsonLdArticulo()`, `jsonLdBreadcrumbs()`, `jsonLdOrganizacion()` y `jsonLdSitio()`, con tests en Vitest.

## 4. Datos

- Solo se usa `packages/db` (cliente anon). Nada de `createClient` en `apps/web`.
- Las consultas seleccionan solo las columnas necesarias e incluyen las relaciones (categoría, etiquetas, autor) en una sola consulta.
- Si el slug no existe, la respuesta es `404` real (`return new Response(null, { status: 404 })` o `Astro.rewrite('/404')`).
- Si el slug cambió, se responde con un `301` a la URL nueva (se consulta la tabla de redirecciones).

## 5. Bloques

- `apps/web/src/components/bloques/RenderBloques.astro` recorre `contenido` y delega en un componente `.astro` por tipo (`Parrafo.astro`, `Imagen.astro`…).
- Los tipos se importan de `packages/bloques`. Si aparece un tipo desconocido, no se renderiza y se registra en log; la página no se rompe.
- Los bloques son HTML estático. Solo `galeria` o `video` pueden usar una isla React, y con `client:visible`.
- El primer bloque `titulo` del contenido es `h2`, porque el `h1` es el título del artículo.

## 6. Imágenes

- Se usa `<Image />` / `<Picture />` de `astro:assets` con `width`/`height` explícitos. Para las imágenes remotas de Supabase Storage hay que configurar `image.remotePatterns`.
- El `alt` es obligatorio (viene del bloque).
- La imagen principal (LCP) lleva `loading="eager"` y `fetchpriority="high"`; el resto va `lazy`.

## 7. Islas React

- Por defecto no hay JS. Cada `client:*` tiene que estar justificado en el plan.
- Se prefiere `client:visible` o `client:idle` antes que `client:load`.
- Los componentes compartidos con admin salen de `packages/ui`.

## 8. Checklist antes de dar por terminada una página

- [ ] Hay un único `h1` y una jerarquía correcta
- [ ] `<Seo />` tiene título y descripción propios y no genéricos
- [ ] JSON-LD válido (verificable con https://validator.schema.org)
- [ ] La ruta está en el sitemap (o excluida a propósito)
- [ ] Está cubierta por `rutasAfectadas` si depende del contenido
- [ ] Lighthouse móvil: SEO ≥ 95, Performance ≥ 90, Accesibilidad ≥ 95
