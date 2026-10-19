# Validación: 002-sitio-publico

**Fecha**: 2026-10-19 · **Commit**: 07a61d8 · **Ronda**: 2 (la ronda 1 fue sobre fa9f572)
**Alcance**: `git diff 61e92f4...HEAD` (61e92f4 es la punta de la 001, ya validada; la PR a `main` es conjunta 001 + 002).
**Resultado global**: ✅ **APROBADO** (ronda 2). La ronda 1 dio CAMBIOS REQUERIDOS con 3 bloqueantes, todos corregidos.

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm test` | ✅ (bloques 278, db 121 de integración, web 146, ui 27) |
| `pnpm calidad` | ✅ jscpd 0 %, knip sin hallazgos |
| `pnpm test:db` | ✅ 525 pgTAP |
| `pnpm test:e2e --project=web` | ✅ 145 (incluye axe WCAG 2.1 AA y 4 anchos) |
| `pnpm build` | ✅ |

## arquitecto-db — APROBADO

Migraciones fieles al data-model; orden real de triggers `a10 → a15 → a20 → a90 → z90`; vista con `security_barrier`; funciones nuevas sin execute para clientes; advisors solo con el `security_definer_view` ya aceptado en la 001; `db lint` sin errores. `config.toml`: el registro sigue bloqueado (`signup_disabled`) y el login por correo funciona.

**Menores**
- [x] A-M1 `supabase/tests/autores_slug.test.sql`: falta el test de que el backfill no cambia `actualizado_en` (data-model "Tests pgTAP").
- [x] A-M2 `autores_slug.test.sql:152-166`: `z90_notificar_cambio_autor` solo se prueba con `nombre`; faltan `biografia`, `avatar` y el cambio de slug por mantenimiento (`slugs = [nuevo, anterior]`).
- [x] A-M3 Falta el test de que `a10_asignar_slug` normaliza un slug explícito.
- [x] A-M4 `supabase/seed.sql:252-253`: el comentario dice "galería de una imagen" (son 2).

**Observaciones**
- Corregir a mano el slug de un autor (postgres o service_role) no genera 301: si alguna vez se hace, insertar también la fila en `redirecciones` con `tipo_entidad = 'autor'`. Documentarlo.
- Fuera de alcance (001): `20261018120100_perfiles.sql:4` menciona `20261018120900_equipo.sql`; el nombre real será `20261019120900_equipo.sql`.

## revisor-ux-ui — CAMBIOS REQUERIDOS

**Bloqueantes**
- [x] U-B1 `packages/bloques/src/render/TextoEnLinea.tsx:77`: los enlaces del Markdown inline heredan color y decoración del texto (preflight de Tailwind): no se distinguen (WCAG 1.4.1, 2.4.4). Subrayarlos y probarlo.
- [x] U-B2 `Boton.astro:14` y `Cta.tsx:5`: `hover:bg-marca/90` baja el contraste del texto del botón primario a ≈ 3,95:1 (WCAG 1.4.3). Token `--color-marca-hover` más oscuro y su par en `tokens.test.ts`.

**Menores**
- [x] U-M1 `tokens.test.ts`: sumar los pares en uso (`marca` sobre `fondo` y `superficie`, `texto-suave` sobre `marca-suave`, `borde` sobre `marca-suave`); `marca` sobre `superficie` da 4,49:1: oscurecer `--color-marca` para tener margen.
- [x] U-M2 Clases del botón duplicadas entre `Boton.astro` y `Cta.tsx` (§VII.3): una sola fuente.
- [x] U-M3 `Titulo.tsx:15`: títulos repetidos generan `id` duplicados; "Contenido" choca con `id="contenido"` del `<main>`; un título solo de símbolos da `id=""`.
- [~] U-M4 **Aceptado con justificación**: en escritorio el orden visual y el del DOM coinciden (logo → navegación → WhatsApp); en 360 px los tres no entran en una fila y cualquier reordenamiento desalinea una de las dos vistas. El orden actual preserva el significado (WCAG 2.4.3). `Cabecera.astro:24`: en móvil el orden de tabulación (logo → nav → WhatsApp) no coincide con el visual (logo → WhatsApp → nav) (WCAG 2.4.3).
- [x] U-M5 `Paginacion.astro:25,50`: las flechas se leen en voz alta; borde con `--color-separador` en lugar de `--color-borde`.
- [x] U-M6 `TextoEnLinea.tsx:77` y `Cita.tsx:18`: los enlaces externos no avisan "se abre en otra pestaña"; la cita usa "fuente" como texto genérico.
- [x] U-M7 `Video.tsx:40`: el texto sobre la miniatura depende de la imagen; agregar un velo.
- [x] U-M8 `AvatarAutor` repite el nombre que está al lado (artículo, ficha y página de autor): prop `decorativo`.
- [x] U-M9 `404.astro:3`: el comentario todavía menciona `Astro.rewrite`.
- [x] U-M10 `Seo.astro`: falta `twitter:image:alt`; `TarjetaArticulo.astro:54`: el `title` repite el texto del enlace.
- [→] U-M11 **Tarea T104.** `Pie.astro:31`: el teléfono se muestra como dígitos crudos; campo de visualización con formato en `landing.ts`.

## consistencia-codigo — CAMBIOS REQUERIDOS

Límites de capas, convenciones y cobertura (§IX.5: todo criterio tiene al menos un test) sin hallazgos.

**Dependencias (§II)**: todas **APROBADAS**: `@astrojs/rss@4.0.19`, `zod@4.6.7` en `@blog/db`, `react@19.3.0` (peer `^19.3.0`) + `react-dom` + `@types` en `@blog/bloques`, `@blog/db` y `@blog/bloques` en web, `@axe-core/playwright@4.14.0` (solo test), baja de `@astrojs/sitemap` y versiones fijas en web.

**Bloqueantes**
- [x] C-B1 `apps/web/src/lib/paginacion.ts:12`: la regex acepta `'<n>'`, el formato de la ruta eliminada `/blog/pagina/[n]`. `/blog/categoria/<slug>/2` responde 200 y duplica `/…/pagina/2`; `/…/1` responde 301 en lugar de 404. Regex `^pagina\/([1-9]\d*)$`, mover `'2'` y `'1'` a 404 en `paginacion.test.ts`, limpiar los comentarios de `listados.ts:13` y `paginacion.ts:7`, y un E2E con `/blog/categoria/<slug>/2` → 404.

**Menores**
- [x] C-M1 `packages/bloques/package.json:19-20`: React 19.3.0 en los tests de bloques y 19.3.1 en web (dos copias en el lockfile): alinear.
- [→] C-M2 **Tarea T103.** `constitucion.md:48`: la tabla §II lista `@astrojs/sitemap`, que ya no se usa (próxima enmienda PARCHE).
- [x] C-M3 `plan.md` (Reutilización y estructura) no refleja lo implementado: `lib/listados.ts`, `lib/taxonomias.ts`, `PaginaTaxonomia.astro`, `AvatarAutor.astro`, `pages/logo.svg.ts`, `e2e/web/ayudas.ts`, `[...pagina]` único y el logo como data URI.
- [x] C-M4 El sufijo "— página n" y las migas `Inicio › Blog › X` se arman igual en tres listados: helper.
- [x] C-M5 El helper que firma avisos está duplicado en `aviso.test.ts` y `revalidar.test.ts`; `e2e/` queda fuera del patrón de jscpd.

## Correcciones de la ronda 1 (2026-10-19)

- **C-B1**: `resolverPagina` solo acepta `pagina/<n>`; tests unitarios y E2E de `/blog/categoria/diseno/1` → 404.
- **U-B1**: los enlaces del texto llevan `CLASE_ENLACE` (subrayado con `decoration-marca`); test en `texto-en-linea.test.tsx`.
- **U-B2**: token `--color-marca-hover` (oklch 0.46) y `--color-marca` a 0.53; `hover:bg-marca-hover` en `clasesBoton` (`packages/ui/src/clases.ts`), que comparten `Boton.astro` y `Cta.tsx`; pares nuevos en `tokens.test.ts`.
- Menores corregidos: anclas únicas en `Bloques` (`anclas.test.tsx`), `AvisoOtraPestania` compartido, "ver la fuente", velo del video, avatar `decorativo` con "Foto de <nombre>", flechas `aria-hidden` y borde `--color-borde` en la paginación, `twitter:image:alt`, sin `title` en la tarjeta, React 19.3.1 en bloques, `sufijoPagina` y `migasDelBlog`, `firmarAviso` compartido en tests, `e2e/` en jscpd con `e2e/web/ayudas.ts`, tres pgTAP nuevos en `autores_slug.test.sql`, comentario del seed y `plan.md` al día.
- Observación de mantenimiento del slug de autor documentada en `data-model.md`. La observación de la 001 queda como T105.
- Verificaciones tras las correcciones: lint, typecheck, test, calidad (jscpd 0 % con `e2e/`, knip limpio), test:db (531), build y 146 E2E en verde.

## Ronda 2 (commit 07a61d8)

| Agente | Veredicto | Notas |
|---|---|---|
| arquitecto-db | APROBADO | A-M1 a A-M4 resueltos; `autores_slug.test.sql` 41/41. |
| revisor-ux-ui | APROBADO | U-B1 y U-B2 verificados en el navegador: subrayado de los enlaces a 4,89:1 sobre el fondo y hover del botón a 7,02:1. De acuerdo con U-M4 aceptado y U-M11 en T104. Sin hallazgos nuevos. |
| consistencia-codigo | APROBADO | C-B1, C-M1, C-M3, C-M4 y C-M5 corregidos; aprueba `@blog/ui` (workspace) como dependencia de `@blog/bloques` y React 19.3.1 en bloques. Sin hallazgos nuevos. |

**Observación para el admin (spec futura)**: cuando `apps/admin` consuma `@blog/bloques/render`, su CSS de Tailwind tiene que incluir `@source` hacia `packages/bloques/src/render` y `packages/ui/src`; si no, el bloque CTA queda sin estilos.

## T099: mediciones sobre el preview del PR #1 (2026-10-19)

Preview `blog-web-git-002-sitio-publico-…vercel.app`, con Deployment Protection (se accede con un secreto de *Protection Bypass for Automation*, revocable en Vercel → Deployment Protection). La base de la nube tiene las migraciones de la 002 y el seed de la 001.

**Lighthouse móvil** (13.5, medición final, commit con anchos de imagen):

| Página | Perf | A11y | Buenas prácticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 61* | 2,07 s | 0 | 0 ms |
| `/blog` | 100 | 100 | 100 | 61* | 1,62 s | 0 | 0 ms |
| artículo | 99–100 | 100 | 100 | 61* | 1,77 s | 0 | 0 ms |
| `/blog/categoria/diseno` | 100 | 100 | 100 | 61* | 1,77 s | 0 | 0 ms |

\* Solo fallan `is-crawlable` (el preview lleva `X-Robots-Tag: noindex` a propósito, H5-E6) y `robots-txt` (Lighthouse pide `robots.txt` sin la cabecera de bypass y recibe el login de Vercel). Las demás auditorías de SEO pasan; en producción esas dos también. INP no se mide en laboratorio: TBT 0 ms en todas.

**Verificaciones con `curl`**: los 404 de las rutas dinámicas y de las rutas sin coincidencia muestran la página completa; `/blog/` → 308 a `/blog`; `/Blog` y `/Blog/Categoria/Diseno?x=1` → 301 a minúsculas conservando la query; `/blog/pagina/1` → 301; `X-Robots-Tag: noindex` en el preview; sin `<script>` propios salvo JSON-LD (el único extra es Vercel Live, que Vercel inyecta solo en previews); imágenes por `/_vercel/image` en AVIF/WebP con `srcset` de 480 y 800 en tarjetas (picsum funciona: no hace falta el plan B de D7); sitemap con los 3 autores; RSS con los 9 publicados; robots con `Sitemap:` del dominio de producción.

**Problemas que encontró T099 y quedaron corregidos**:
1. Los 404 dinámicos salían vacíos (la función no lee el `404.html` prerenderizado) y `/Blog` daba 404: la 404 pasa a renderizarse en la función, cacheada una hora (research D13).
2. LCP de `/blog` en 3,5 s: la primera tarjeta de cada listado carga con prioridad.
3. Todas las imágenes salían en 1920 px y calidad 100: anchos declarados a Vercel (`src/lib/anchos-imagen.ts`), AVIF/WebP y calidad 75 (`CALIDAD_IMAGEN`).

**Pendiente para producción (T101)**: validadores de schema.org, sitemap y feed de W3C (necesitan una URL pública) y la medición de CE-004.

## T101: producción (2026-10-19, después del merge de #1)

- **Migraciones** `20261019120000` y `20261019120100` aplicadas en la nube antes del merge (la segunda, desde el SQL Editor): 3 perfiles con slug, vista con `security_barrier`, sitemap con 3 autores; advisors sin hallazgos nuevos.
- **Vault**: `url_web_revalidacion` = URL de producción y `secreto_revalidacion` rotado (el primer valor no coincidía con Vercel y el sitio respondía 401). El nuevo se cargó en Vercel por la API y se redesplegó producción; el hash del Vault coincide con el valor cargado.
- **CE-004**: un cambio de título en la base se vio en producción a los **5 s**, en dos muestras (cambio y restauración). `net._http_response`: 200 con `{"tags":["articulos","articulo:<id>"],"rutas":["/blog/<slug>"]}`.
- **H4-E6**: al renombrar la categoría "Diseño" (nombre y slug), el artículo mostró el nombre nuevo a los **6 s**, y la URL vieja respondió 301 desde la segunda petición (la primera recibe la copia vencida por `swr`, riesgo previsto en research D1). Se restauró la categoría; queda la redirección de prueba `diseno-grafico` → `diseno`, inocua.
- **Lighthouse móvil en producción**: 100 / 100 / 100 / 100 (rendimiento, accesibilidad, buenas prácticas y SEO) en `/`, `/blog`, un artículo y una categoría; LCP 1,31–1,38 s; CLS 0.
- **Validadores**: schema.org sin errores ni avisos en portada, artículo, autor y categoría; feed válido en W3C con un aviso (`atom:link rel="self"`, se corrige en el PR de cierre).
- **Sin `X-Robots-Tag` en producción**; `/api/revalidar` rechaza un aviso sin firma con 401.

## Acciones

1. ~~Corregir los bloqueantes C-B1, U-B1 y U-B2, con sus tests.~~ Hecho.
2. ~~Corregir los menores o registrarlos como tareas (constitución §XI).~~ Hecho (T103–T105).
3. ~~Volver a ejecutar `/validar` (ronda 2).~~ APROBADO.
4. Después: T099 (mediciones sobre el preview de Vercel) y el PR conjunto 001 + 002.
