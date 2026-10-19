# Quickstart: validar el sitio público

Esta es una guía para comprobar la feature de punta a punta. Los detalles de cada pieza están en [contracts/](contracts/) y en [data-model.md](data-model.md).

## Requisitos previos

- Supabase local levantado y con el seed cargado: `pnpm db:start && pnpm db:reset`.
- `apps/web/.env.local` con `PUBLIC_URL_SITIO=http://localhost:4321`, `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (sacados de `supabase status`) y `SECRETO_REVALIDACION` (el valor de `.env.example`).

### En Windows

- Docker Desktop necesita la virtualización activada en el BIOS. Desde Git Bash, Docker no está en el `PATH`: `export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"`.
- `astro build` necesita el **Modo de desarrollador** de Windows: el adaptador de Vercel crea *symlinks* en `.vercel/output`.
- El repo tiene `.gitattributes` con `eol=lf`; si un clon viejo muestra avisos de Prettier por CRLF, volver a hacer checkout.
- Para recibir avisos de la base en local (sección 5 en local), el contenedor llega al host por `host.docker.internal` y no por `172.17.0.1` (el valor del seed, que es de Linux):
  ```sql
  select vault.update_secret(id, 'http://host.docker.internal:4321') from vault.secrets where name = 'url_web_revalidacion';
  ```
  y el servidor se levanta con `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=host.docker.internal pnpm --filter web dev --ignore-lock --host`.

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
| `/blog` → `/blog/pagina/2` | 13 o más publicados del seed: 12 en `/blog` y el resto en `/blog/pagina/2`. `/blog/pagina/1` redirige con 301 a `/blog` y `/blog/pagina/99` da 404. |
| "Guía visual: todos los bloques del blog" | Todos los bloques se ven en orden, el código aparece literal, el video no hace peticiones a YouTube hasta el clic y la ficha del autor enlaza a `/blog/autor/<slug>`. |
| `/blog/categoria/diseno`, una etiqueta, un autor | Presentación y sus artículos. |
| Un slug anterior del seed (artículo cambiado dos veces, categoría y etiqueta) | 301 en un salto a la URL vigente. |
| `/Blog/` | Redirección permanente a `/blog`. |
| `/blog/no-existe`, `/cualquier-cosa` | 404 con cabecera y pie. |
| `/sitemap.xml`, `/rss.xml`, `/robots.txt` | XML válido con autores; tantos ítems en el feed como publicados (hasta 20); `Sitemap:` declarado. |

## 4. E2E

```bash
pnpm test:e2e --project=web
```

**Esperado**: pasan todos los `e2e/web/*.spec.ts`, incluidos axe (sin violaciones AA) y los 4 anchos.

**Aviso en local** (opcional, ver "En Windows"): un `update` de un artículo publicado deja en `net._http_response` un `200` con `{"tags":[…],"rutas":[…]}`. Así se comprueba que la firma de `pg_net` valida en el sitio (verificado el 2026-10-19).

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

- Lighthouse móvil sobre el **preview del PR** (constitución §IV.8), antes de `/validar`, en `/`, `/blog`, un artículo y una categoría. Se anotan los puntajes y las CWV en `validacion.md`.
- Validar el JSON-LD de un artículo y de la portada en https://validator.schema.org: sin errores.
- `/sitemap.xml` y `/rss.xml` en los validadores de W3C (feed) y de sitemaps: sin errores.
