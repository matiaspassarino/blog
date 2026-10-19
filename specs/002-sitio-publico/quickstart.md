# Quickstart: validar el sitio público

Esta es una guía para comprobar la feature de punta a punta. Los detalles de cada pieza están en [contracts/](contracts/) y en [data-model.md](data-model.md).

## Requisitos previos

- Supabase local levantado y con el seed cargado: `pnpm db:start && pnpm db:reset`.
- `apps/web/.env.local` con `PUBLIC_URL_SITIO=http://localhost:4321`, `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (sacados de `supabase status`) y `SECRETO_REVALIDACION` (el valor de `.env.example`).

## 1. Base de datos

```bash
pnpm test:db          # incluye autores_slug.test.sql
pnpm db:tipos && git diff --stat packages/db/src/tipos.ts   # aparece perfiles.slug y autores_publicos.slug
```

**Esperado**:
- pgTAP queda en verde.
- `select slug from perfiles` devuelve 3 slugs legibles.

## 2. Unidad e integración

```bash
pnpm test             # bloques/render, db (invalidaciones, listados), web/lib
pnpm lint && pnpm typecheck && pnpm calidad
```

**Esperado**:
- Todo queda en verde.
- knip no reporta `rutasAfectadas` ni `@astrojs/sitemap`.
- jscpd da 3 % o menos.

## 3. Recorrido local

```bash
pnpm --filter web dev --ignore-lock
```

| Abrir | Esperado |
|---|---|
| `/` | Hero, propuesta, servicios, testimonios ("de ejemplo"), 3 artículos y la sección de contacto. El botón abre `wa.me/…`. |
| `/blog` → `/blog/pagina/2` | 9 publicados del seed: entran en una sola página. `/blog/pagina/2` da 404 y `/blog/pagina/1` redirige con 301 a `/blog`. |
| El artículo del seed con los 10 bloques | Todos los bloques se ven en orden, el código aparece literal, el video no hace peticiones a YouTube hasta el clic y la ficha del autor enlaza a `/blog/autor/<slug>`. |
| `/blog/categoria/diseno`, una etiqueta, un autor | Presentación y sus artículos. |
| Un slug anterior (tras renombrar un artículo en Studio) | 301 a la URL nueva. |
| `/Blog/` | Redirección permanente a `/blog`. |
| `/blog/no-existe`, `/cualquier-cosa` | 404 con cabecera y pie. |
| `/sitemap.xml`, `/rss.xml`, `/robots.txt` | XML válido con autores; 9 ítems en el feed; `Sitemap:` declarado. |

## 4. E2E

```bash
pnpm test:e2e --project=web
```

**Esperado**: pasan todos los `e2e/web/*.spec.ts`, incluidos axe (sin violaciones AA) y los 4 anchos.

## 5. Aviso firmado y caché (en Vercel, que es donde está activo el caché de rutas)

1. Cargar los secretos en el Vault de la nube con el SQL Editor: `url_web_revalidacion` con la URL de producción de `blog-web` y `secreto_revalidacion` con el mismo valor que la variable de Vercel.
2. Hacer el merge a `main`, para que se despliegue en producción.
3. Probar el rechazo: `curl -i -X POST <url>/api/revalidar -d '{}'` tiene que devolver **401**.
4. Medir CE-004:
   - abrir un artículo y anotar su título;
   - en la nube, cambiar el título de un artículo publicado (`update articulos set titulo = … where slug = …`);
   - volver a pedir la página cada 5 s hasta que cambie.
   - **Esperado**: menos de 60 s. Anotar la medición en `validacion.md`.
5. Renombrar una categoría. **Esperado**: las páginas de sus artículos muestran el nombre nuevo (H4-E6), y la URL vieja de la categoría responde 301.
6. Abrir una URL de preview y revisar los encabezados: tiene que tener `X-Robots-Tag: noindex`.
7. Revisar las imágenes: las de picsum se ven optimizadas (`/_vercel/image?…`, con código 200). Si no, aplicar el plan B de research D7.

## 6. Calidad medida (CE-001, CE-002, CE-003, CE-010)

- Lighthouse móvil sobre producción en `/`, `/blog`, un artículo y una categoría. Se anotan los puntajes y las CWV en `validacion.md`.
- Validar el JSON-LD de un artículo y de la portada en https://validator.schema.org: sin errores.
- `/sitemap.xml` y `/rss.xml` en los validadores de W3C (feed) y de sitemaps: sin errores.
