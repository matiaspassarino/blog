---

description: "Lista de tareas: sitio público (landing y blog)"
---

# Tareas: Sitio público (landing y blog)

**Entrada**: Documentos de diseño en `/specs/002-sitio-publico/`: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (D1–D18), [data-model.md](data-model.md), [contracts/](contracts/) y [quickstart.md](quickstart.md).

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBLIGATORIOS (constitucion.md §IX). En cada fase, las tareas de test van primero, las escribe el agente `escritor-tests` y **deben fallar** antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario (H1 a H5 de spec.md). La fase fundacional deja lista la base de datos, el layout, los metadatos base y el contenido de la landing, que usan todas las historias.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo: toca archivos distintos y no depende de tareas incompletas.
- **[Historia]**: H1 a H5, según spec.md.

## Convenciones de rutas

- Sitio público: `apps/web/src/` (páginas en `pages/`, componentes en `components/`, helpers puros en `lib/`).
- Renderers de bloques: `packages/bloques/src/render/` (subpath `@blog/bloques/render`).
- Datos: `packages/db/src/`. Ninguna página crea clientes ni escribe consultas (constitución §III.2).
- Migraciones: `supabase/migrations/20261019120000_*.sql` y `20261019120100_*.sql`. Las migraciones pendientes de la 001 (H4–H6) ya llevan *timestamps* posteriores.
- pgTAP: `supabase/tests/<nombre>.test.sql`, con `begin; select plan(N);` … `select * from finish(); rollback;` y los helpers de `00_helpers.test.sql` (`pruebas.como_anon()`, `pruebas.como(email)`, `pruebas.como_postgres()`).
- Vitest: `packages/<pkg>/src/**/*.test.ts(x)` y `apps/web/src/**/*.test.ts`.
- E2E: `e2e/web/*.spec.ts` (proyecto `web` de `playwright.config.ts`, Pixel 7, `http://localhost:4321`).
- Reglas transversales:
  - SQL: `set search_path = ''`, nombres calificados, triggers con prefijo de orden, grants explícitos.
  - UI: solo tokens de `packages/ui/src/tokens.css`, sin hex ni px sueltos (§VII.2); un `h1` por página; nada de directivas `client:` (§IV.2, RF-025).
  - Antes de crear un archivo, revisar la tabla "Reutilización" de [plan.md](plan.md) (§VIII).

---

## Fase 1: Preparación

**Propósito**: Dependencias, configuración de Astro, entorno de tests, CI y datos de demo que necesitan las pruebas.

- [X] T001 Corregir el `typecheck` de `apps/admin`, que hoy falla en CI de `main` (`Cannot find name 'LayoutProps'`): en `apps/admin/package.json` cambiar el script a `"typecheck": "next typegen && tsc --noEmit"`. Confirmar antes que `next typegen` existe en `apps/admin/node_modules/next/dist/docs/` (ver `apps/admin/AGENTS.md`). Verificar que `pnpm typecheck` pase después de borrar `apps/admin/.next`.
- [X] T002 Dependencias de `apps/web/package.json`: agregar `@blog/db: workspace:*`, `@blog/bloques: workspace:*` y `@astrojs/rss@4.0.19` (research D14), y **quitar** `@astrojs/sitemap`. Además, fijar sin `^` las versiones que ya usa (las que resuelve `pnpm-lock.yaml`), porque §II pide versiones fijas (análisis C5). Si `minimumReleaseAge` bloquea una versión, elegir la anterior; no agregar exclusiones.
- [X] T003 [P] Agregar `zod@4.6.7` a `packages/db/package.json` (la misma versión que `@blog/bloques`, research D4).
- [X] T004 [P] Preparar `packages/bloques` para los renderers (research D5, [contracts/bloques-render.md](contracts/bloques-render.md)):
  - en `package.json`: `peerDependencies` `react: ^19.3.0` (web usa 19.3.1 y admin 19.3.0); `devDependencies` `react@19.3.0`, `react-dom@19.3.0` y `@types/react`/`@types/react-dom` (19.x, la misma que usa `apps/web`); en `exports`, agregar `"./render": "./src/render/index.ts"`;
  - en `tsconfig.json`: `"jsx": "react-jsx"` y que `include` cubra `src/**/*.tsx`.
- [X] T005 [P] En `packages/bloques/eslint.config.js`, prohibir `dangerouslySetInnerHTML` (RF-003, research D5) con `no-restricted-syntax` sobre `JSXAttribute[name.name='dangerouslySetInnerHTML']` y un mensaje en español. No agregar plugins nuevos.
- [X] T006 [P] Agregar `@axe-core/playwright` como devDependency de la raíz (`package.json`), en la última versión que permita `minimumReleaseAge` (justificado en plan.md, "Plan de pruebas").
- [X] T007 [P] Crear `apps/web/vitest.config.ts` con `getViteConfig()` de `astro/config`, para que los tests de `src/lib`, `src/middleware.ts` y `src/pages/api` resuelvan los módulos virtuales (`astro:env/server`, `astro:middleware`). Excluir `e2e/`.
- [X] T008 Reescribir `apps/web/astro.config.mjs` (research D1, D7, D12, D15, D16). Verificar cada nombre de API contra `apps/web/node_modules/astro/dist` y `@astrojs/vercel/dist` antes de escribirlo:
  - `adapter: vercel({ imageService: true })`, **sin** `isr` y sin `bypassToken`;
  - caché de rutas con el proveedor `cacheVercel()` de `@astrojs/vercel/cache`;
  - `env.schema` con `PUBLIC_URL_SITIO`, `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (`context: 'server', access: 'public'`) y `SECRETO_REVALIDACION` (`context: 'server', access: 'secret'`, mínimo de 32 caracteres);
  - `fonts`: `fontProviders.fontsource()` con `identidad.fuentes.cuerpo` → `--fuente-cuerpo` e `identidad.fuentes.titulos` → `--fuente-titulos` (research D16), importando `identidad` de `@blog/ui/identidad` (T031; §VII.6, análisis C1). Ningún nombre de fuente queda escrito en `astro.config.mjs`;
  - `image.remotePatterns` para el host de `PUBLIC_SUPABASE_URL`, `picsum.photos` y `fastly.picsum.photos`;
  - `trailingSlash: 'never'`;
  - `integrations: [react()]` (sin `sitemap()`);
  - reemplazar el comentario de cabecera para que apunte a research D1 y no a "ISR".
- [X] T009 [P] En `apps/web/src/styles/global.css`, agregar `@source` hacia `packages/bloques/src/render` para que Tailwind vea sus clases y la regla `@media (prefers-reduced-motion: reduce)` que anula transiciones y animaciones. (El estilo de `:focus-visible` va en T031, cuando exista `--color-foco`.)
- [X] T010 [P] Variables de entorno:
  - en `.env.example`, cambiar el comentario de `SECRETO_REVALIDACION` a "firma HMAC de los avisos de la base (≥ 32 caracteres)" (ya no hay ISR ni `bypassToken`, research D1);
  - crear `apps/web/.env.local` (ignorado por git) con los valores de `supabase status`, como dice [quickstart.md](quickstart.md#requisitos-previos).
- [X] T011 [P] En `.github/workflows/ci.yml`:
  - job `calidad`: definir en `env` valores ficticios de `PUBLIC_URL_SITIO`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` y `SECRETO_REVALIDACION` (32 caracteres o más) para que `astro build` pase la validación de `astro:env`;
  - job `e2e`: después de `supabase start`, generar `apps/web/.env.local` a partir de `supabase status -o env` (URL y clave anon) y `SECRETO_REVALIDACION` de `.env.example`.
- [X] T012 Completar `supabase/seed.sql` con los datos que necesitan las pruebas de esta spec. **Es un desvío del data-model.md original, ya documentado en su sección "Seed" (análisis I5)**, justificado porque la prueba independiente de H1, H2-E1 y CE-005 no tienen datos con el seed actual:
  - un artículo publicado **"Guía visual: todos los bloques del blog"** con los 10 tipos de bloque, en este orden: párrafo, título nivel 2, imagen con leyenda, imagen decorativa (`decorativa: true`), cita con autor y fuente, lista ordenada, galería de 4 imágenes, CTA con URL externa `https://…`, separador, título nivel 3, código cuyo texto incluya `<script>alert(1)</script>` y video de YouTube;
  - un artículo publicado **sin imagen destacada**, con un título de 120 caracteres y un extracto de 300 caracteres (casos borde);
  - los artículos publicados que falten para llegar a **13 o más publicados** (H2-E1: hace falta `/blog/pagina/2`);
  - una galería con el **mínimo de 2 imágenes** (el esquema de la 001 no admite menos) en otro artículo publicado (caso borde de galerías);
  - después de insertar, cambiar como `postgres` la columna **`slug`** (`update … set slug = …`) de un artículo **publicado** dos veces (a → b → c) y de una categoría y una etiqueta una vez, para que `redirecciones` tenga entradas (H4-E4, H4-E5, CE-005). El trigger `z10_registrar_redireccion` de artículos solo actúa si `publicado_en` no es nulo. El seed ya desactiva las notificaciones durante la carga: mantenerlo así.
  - `supabase/tests/seed.test.sql` usa `>=` y debería seguir valiendo; agregar una afirmación de que existe al menos una redirección de artículo con dos saltos resueltos a la misma entidad, y ajustar `plan()`.

---

## Fase 2: Fundacional (bloqueante)

**Propósito**: Slug de autores en la base, tipos públicos ampliados, tokens, helpers puros, metadatos base, contenido de la landing, layout y páginas de error. Todas las historias dependen de esto.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase.

### Tests (escribir primero, deben fallar)

- [X] T013 [P] Crear `supabase/tests/autores_slug.test.sql` ([data-model.md](data-model.md#tests-pgtap-supabasetestsautores_slugtestsql)). Debe verificar:
  - un insert en `auth.users` crea un perfil con slug normalizado ("José Núñez" → `jose-nunez`);
  - dos homónimos reciben `ana-perez` y `ana-perez-2` (RF-011, caso borde);
  - un cliente `authenticated` (editor o el propio dueño) que cambia `slug` recibe `P0001 sin_permiso` con `detail = 'slug'`; si cambia `nombre`, el slug se conserva (aclaración del 2026-10-19);
  - `postgres` sí puede cambiar el slug;
  - `perfiles.slug` es `not null`, tiene `default ''`, `unique` (`perfiles_slug_key`) y el check `perfiles_slug_formato` (`^[a-z0-9]+(-[a-z0-9]+)*$`);
  - como anon, `autores_publicos` expone `slug` solo de autores con publicados; no hay filas de autores sin publicados; un autor con `activo = false` y publicados sigue visible (caso borde);
  - las opciones de la vista conservan `security_barrier=true` y `security_invoker=false` (`pg_class.reloptions`);
  - existe `articulos_autor_publicado_idx` sobre `(autor_id, publicado_en desc)` y ya no existe `articulos_autor_idx`;
  - si un autor con publicados cambia `nombre`, se encola **un** mensaje `tipo = 'autor'` con `slugs = [slug]` (H4-E7). Usar secretos de Vault creados dentro de la transacción, igual que `notificaciones.test.sql`;
  - si cambia el `nombre` de un autor sin publicados, o si solo cambian `rol`, `activo` o `actualizado_en`, no se encola nada.
- [X] T014 [P] Actualizar `supabase/tests/autores_publicos.test.sql`: el `columns_are` de la línea ~48 pasa a `id, nombre, biografia, avatar, slug, actualizado_en`. Ajustar `plan()`.
- [X] T015 [P] Actualizar `supabase/tests/sitemap.test.sql`: con `pruebas.como_anon()`, `entradas_sitemap()` incluye `{tipo: 'autor', slug}` solo de autores con publicados, y su `actualizado_en` es el máximo entre el del perfil y el de sus artículos publicados. Ajustar `plan()`.
- [X] T016 [P] Actualizar `supabase/tests/privilegios.test.sql`: `function_privs_are` de `privado.impedir_cambio_slug()` y `privado.notificar_cambio_autor()` sin `execute` para `public`, `anon` ni `authenticated`; `public.entradas_sitemap()` sigue ejecutable por `anon` y `authenticated`. Ajustar `plan()`.
- [X] T017 [P] Actualizar `supabase/tests/seed.test.sql`: los 3 perfiles demo tienen slug no vacío. Ajustar `plan()`. (Hacer después de T012, que toca el mismo archivo.)
- [X] T018 [P] Ampliar `packages/db/src/consultas/articulos-publicos.test.ts` (integración): `obtenerArticuloPublicado` devuelve `categoria.id`, `etiquetas[].id` y `autor.{id, slug}`.
- [X] T019 [P] Crear `packages/ui/src/tokens.test.ts`: lee `tokens.css`; exige que `identidad.ts` exporte `fuentes.cuerpo`, `fuentes.titulos` y `logo` (`src`, `alt`, `ancho`, `alto`), y que los nombres de `fuentes` coincidan con las familias de `--font-cuerpo` y `--font-titulos` de `tokens.css` (una sola identidad, §VII.6); exige que existan los tokens nuevos de T031 y verifica el contraste WCAG (≥ 4,5:1 para `--color-texto` y `--color-texto-suave` sobre `--color-fondo` y `--color-superficie`; `--color-marca-contraste` sobre `--color-marca`; `--color-texto` sobre `--color-marca-suave`; ≥ 3:1 para `--color-foco` y `--color-borde` sobre `--color-fondo`). La conversión OKLCH → sRGB → luminancia relativa se escribe en el test; no agregar dependencias.
- [X] T020 [P] Crear `apps/web/src/lib/fechas.test.ts`: `fechaLarga('2026-10-18T15:00:00Z')` → `"18 de octubre de 2026"`; una fecha a las 01:00 UTC se muestra con el día anterior (zona `America/Argentina/Buenos_Aires`, research D17).
- [X] T021 [P] Crear `apps/web/src/lib/imagenes.test.ts`: `urlImagen(ruta, supabaseUrl)` devuelve igual una ruta `https://…` y convierte una ruta relativa en `<supabaseUrl>/storage/v1/object/public/medios/<ruta>` (research D7).
- [X] T022 [P] Crear `apps/web/src/lib/cache.test.ts` ([contracts/cache.md](contracts/cache.md#tags-que-declara-cada-página-appswebsrclibcachets)):
  - `cacheArticulo(a, relacionados)` → `maxAge 31536000`, `swr 60` y tags `articulo:<a.id>`, `categoria:<id>`, `etiqueta:<id>` de cada etiqueta, `autor:<id>` y `articulo:<r.id>` de cada relacionado, sin repetidos (H4-E6: el artículo lleva el tag de su categoría);
  - `cacheListado()` → `['articulos']`; `cacheListado({ tipo: 'categoria', id })` agrega `categoria:<id>` (ídem etiqueta y autor);
  - `cacheNoEncontrado()` → `maxAge 3600`, `swr 60`, sin tags; `cacheRedireccion()` → `maxAge 31536000`, `swr 0`;
  - los tags se arman con los constructores de `@blog/db` (`tagArticulo`, etc.), no con texto literal.
- [X] T023 [P] Crear `apps/web/src/lib/resolver.test.ts`: `resolverEntidad({ buscar, redireccion, prefijo })` devuelve `{ tipo: 'entidad', valor }` si `buscar` encuentra; si no, `{ tipo: 'redireccion', destino: '<prefijo><slugNuevo>' }` cuando `redireccion` devuelve un slug; si no, `{ tipo: 'no_encontrado' }`. No llama a `redireccion` cuando encuentra la entidad. Si `buscar` lanza un `ErrorDominio` distinto de `no_encontrado`, lo propaga sin convertirlo en 404 (caso borde "la base no responde", research D13).
- [X] T024 [P] Crear `apps/web/src/contenido/esquema.test.ts` (RF-013c, H3-E5): el contenido de `landing.ts` es válido; quitar `hero.titulo` o poner `contacto.whatsapp: '+54 11'` hace fallar el parseo con un error cuya ruta nombra el campo (`hero.titulo`, `contacto.whatsapp`); `servicios.items` con 2 elementos falla (mínimo 3); `sitio.descripcion` de menos de 50 caracteres falla.
- [X] T025 [P] Crear `apps/web/src/lib/contacto.test.ts` (research D9, H3-E4): `enlaceWhatsapp('5491100000000', 'Hola, quiero info')` → `https://wa.me/5491100000000?text=Hola%2C%20quiero%20info`; `enlaceCorreo('a@b.com', 'Consulta & demo')` → `mailto:a@b.com?subject=Consulta%20%26%20demo`.

### Implementación

- [X] T026 Crear `supabase/migrations/20261019120000_tipo_entidad_autor.sql` con **solo** `alter type public.tipo_entidad add value if not exists 'autor';` (research D10; va sola porque el valor nuevo no se puede usar en la misma transacción).
- [X] T027 Crear `supabase/migrations/20261019120100_autores_publicos.sql` siguiendo [data-model.md](data-model.md#migración-2-20261019120100_autores_publicossql) al pie de la letra:
  1. `alter table public.perfiles add column slug text;`
  2. `create or replace function privado.slug_disponible(...)` con la rama `when 'autor' then exists (select 1 from public.perfiles where slug = candidato and id is distinct from excluir)`, misma firma;
  3. `create or replace function privado.asignar_slug()` con `when 'perfiles' then 'autor'`;
  4. backfill **fila por fila** (`for r in select id, nombre from public.perfiles order by creado_en, id loop …`) entre `disable trigger a90_actualizado_en` y `enable trigger a90_actualizado_en`;
  5. `alter column slug set default ''`, `set not null`, `add constraint perfiles_slug_key unique (slug)`, `add constraint perfiles_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`;
  6. triggers `a10_asignar_slug` (`before insert`, `privado.asignar_slug('nombre')`), `a15_slug_inmutable` (`before update`, `when (new.slug is distinct from old.slug)`, `privado.impedir_cambio_slug()` invoker que lanza `sin_permiso`/`slug` si `privado.es_cliente()`) y `z90_notificar_cambio_autor` (`after update`, `when ((old.nombre, old.biografia, old.avatar, old.slug) is distinct from (new.nombre, new.biografia, new.avatar, new.slug))`, `privado.notificar_cambio_autor()` definer que, si el autor tiene publicados, llama a `privado.notificar_cambio_publico` con `{ tipo: 'autor', id, slugs: privado.slugs_afectados(new.slug, old.slug) }`);
  7. `create or replace view public.autores_publicos with (security_invoker = false, security_barrier = true)` agregando `slug` y `actualizado_en` **al final**, más `revoke all` y `grant select` a `anon, authenticated`;
  8. `create or replace function public.entradas_sitemap()` con la rama `'autor'` **a través de la vista** (`group by v.id, v.slug, v.actualizado_en`);
  9. `drop index public.articulos_autor_idx;` + `create index articulos_autor_publicado_idx on public.articulos (autor_id, publicado_en desc);`
  10. `revoke execute` de las dos funciones nuevas para `public, anon, authenticated`.
  Ejecutar `pnpm db:reset && pnpm test:db`. Deben pasar T013–T017.
- [X] T028 Ejecutar `pnpm db:tipos` y revisar que `packages/db/src/tipos.ts` incluya `perfiles.slug`, `autores_publicos.slug`/`actualizado_en` y `'autor'` en `tipo_entidad`.
- [X] T029 Ampliar los tipos y la consulta del artículo en `packages/db` ([data-model.md](data-model.md#tipos-de-dominio-blogdb)):
  - `packages/db/src/consultas/tipos-publicos.ts`: `AutorPublico = { id, slug, nombre, biografia, avatar }` y `ReferenciaTaxonomia = { id, nombre, slug }`;
  - `packages/db/src/consultas/articulos-publicos.ts` (y `mapeo.ts` si corresponde): el embebido agrega `id` en `categoria` y `etiquetas`, e `id, slug` en `autor`.
  Debe pasar T018 y no romper `listados.test.ts`.
- [X] T030 [P] Crear `packages/db/src/tags.ts` con `TAG_ARTICULOS = 'articulos'` y los constructores `tagArticulo(id)`, `tagCategoria(id)`, `tagEtiqueta(id)` y `tagAutor(id)` ([contracts/cache.md](contracts/cache.md)). Exportarlos desde `packages/db/src/index.ts`.
- [X] T031 [P] Identidad y tokens en `packages/ui` (plan.md, "Impacto en UI y tokens"; análisis C1):
  - en `packages/ui/src/tokens.css`, `--font-cuerpo: var(--fuente-cuerpo, 'Inter', …)` y `--font-titulos: var(--fuente-titulos, 'Inter Tight', …)` (research D16), oscurecer `--color-borde` hasta ≥ 3:1 sobre el fondo (hoy da 1,31:1, lo detectó T019), y agregar `--spacing-seccion`, `--spacing-bloque`, `--container-lectura` (≈ 68ch), `--container-sitio` (≈ 72rem), `--text-titulo-1` a `--text-titulo-3` con `clamp`, `--color-foco`, `--color-marca-suave` y `--aspect-tarjeta` (16/9);
  - crear `packages/ui/src/identidad.ts` con `fuentes: { cuerpo: 'Inter', titulos: 'Inter Tight' }` y `logo: { src, alt, ancho, alto }`, con un logo genérico en `packages/ui/src/assets/logo.svg`; exportar `./identidad` en `packages/ui/package.json`;
  - agregar a `apps/web/src/styles/global.css` el estilo base de `:focus-visible` con `--color-foco`.
  Debe pasar T019.
- [X] T032 [P] Crear `apps/web/src/lib/datos.ts`: la **única** instancia del cliente público, con `crearClientePublico` de `@blog/db` y las variables de `astro:env/server` (research D15).
- [X] T033 [P] Crear `apps/web/src/lib/fechas.ts` con `fechaLarga(iso)` (`Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' })`). Debe pasar T020.
- [X] T034 [P] Crear `apps/web/src/lib/imagenes.ts` con `urlImagen(ruta, supabaseUrl)` (pura) y `precalcularVariantes(imagenes)`, que usa `getImage()` de `astro:assets` y devuelve un mapa ruta → `{ src, srcset, width, height }` (research D7). Debe pasar T021.
- [X] T035 [P] Crear `apps/web/src/lib/cache.ts` con `cacheArticulo`, `cacheListado`, `cacheNoEncontrado` y `cacheRedireccion`, que devuelven el objeto que recibe `Astro.cache.set(...)` y usan `packages/db/src/tags.ts`. Ninguna página escribe tags a mano. Debe pasar T022.
- [X] T036 [P] Crear `apps/web/src/lib/resolver.ts` con `resolverEntidad` (entidad → 301 → 404) sobre `resolverRedireccion` de `@blog/db` ([contracts/rutas.md](contracts/rutas.md#reglas-transversales)). Debe pasar T023.
- [X] T037 [P] Crear `apps/web/src/lib/contacto.ts` con `enlaceWhatsapp(numero, mensaje)` y `enlaceCorreo(correo, asunto)`. Debe pasar T025.
- [X] T038 [P] Crear el set cerrado de íconos SVG inline en `apps/web/src/components/iconos/` (un `Icono.astro` que recibe `nombre: NombreIcono`, más el tipo `NombreIcono` exportado desde `apps/web/src/components/iconos/nombres.ts`), con `aria-hidden="true"` y color `currentColor`. Incluir los íconos que use la landing de demo (6 como mínimo) y los de WhatsApp, correo y RSS.
- [X] T039 Crear `apps/web/src/contenido/esquema.ts` (con `import { z } from 'astro/zod'`) y `apps/web/src/contenido/landing.ts` según [contracts/landing.md](contracts/landing.md), copiando los límites tal cual (el logo **no** va acá: está en `@blog/ui/identidad`): `sitio.nombre` 1..40, `sitio.lema` 1..60, `sitio.descripcion` 50..160, `hero.titulo` 1..80, `hero.bajada` 1..200, `hero.cta` 1..30, `propuesta.texto` 1..400, `propuesta.puntos` 1..4, `servicios.items` 3..6 (título 1..60, descripción 1..200, `icono: NombreIcono`), `testimonios.items` 1..6 (cita 1..300, `foto` opcional), `blog.descripcion` 50..160, `contacto.whatsapp` `^\d{8,15}$`, `contacto.mensaje` 1..200, `contacto.correo` email y `contacto.asunto` 1..80. `landing.ts` exporta el contenido **ya parseado**, así que un campo inválido hace fallar `astro build`. Textos de demo genéricos en español. Debe pasar T024 (depende de T038).
- [X] T040 [P] Crear las primitivas `apps/web/src/components/ui/Boton.astro` (como `<a>` o `<button>`, variantes `primaria`/`secundaria`, área táctil de 44 px o más), `Contenedor.astro` (ancho `sitio` o `lectura`) y `Etiqueta.astro` (badge enlazable).
- [X] T041 Crear `apps/web/src/components/Seo.astro`, el **único** componente de metadatos ([contracts/rutas.md](contracts/rutas.md#metadatos-por-ruta-componente-único-seo-rseo-001-a-rseo-009), RSEO-001). Props: `titulo`, `descripcion`, `ruta`, `imagen?` (con dimensiones), `tipo` (`website` | `article` | `profile`), `articulo?` (fechas, sección, etiquetas), `noindex?`, `jsonLd?: object[]`. Emite:
  - `<title>` con el sufijo ` | <sitio.nombre>` solo si el total no supera 60 caracteres;
  - `meta description` (recortada a 160), `link rel=canonical` absoluta (con `PUBLIC_URL_SITIO`), Open Graph (`og:type`, `og:title`, `og:description`, `og:image` + `og:image:width`/`height`, `og:url`, `og:locale es_AR`), Twitter Card `summary_large_image`;
  - `article:published_time`, `article:modified_time`, `article:section` y `article:tag` si viene `articulo`;
  - `meta robots noindex` si `noindex`;
  - `<link rel="alternate" type="application/rss+xml" href="/rss.xml">`;
  - un `<script type="application/ld+json">` por cada objeto de `jsonLd`, serializado con escape de `<` (`<`).
  Si no hay imagen, usa `/og-generica.png` (1200 × 630).
- [X] T042 Crear `apps/web/src/layouts/Base.astro` con `<html lang="es">`, `<Seo />` (recibe sus props), enlace "Saltar al contenido" como primer foco (RF-017), `<Cabecera />`, `<main id="contenido">` y `<Pie />`. Crear `apps/web/src/components/Cabecera.astro` (logo de `@blog/ui/identidad` y navegación Inicio, Blog y Contacto, con `aria-current="page"`, y el botón de WhatsApp) y `apps/web/src/components/Pie.astro` (enlaces al blog y al feed, número de WhatsApp y correo como texto y como enlace, RF-013b y RF-015). Usan `landing.ts` y `contacto.ts`.
- [X] T043 Crear `apps/web/src/pages/404.astro` (`export const prerender = true`, título "Página no encontrada", `noindex`, enlaces a la portada y al blog, RF-016) y `apps/web/src/pages/500.astro` (mensaje amable, sin datos técnicos). Verificar en `pnpm --filter web build && pnpm --filter web preview` que `Astro.rewrite('/404')` conserva el estado 404; si no, documentar en research D13 y usar `new Response(html404, { status: 404 })` en un helper único de `lib/resolver.ts`.

**Checkpoint**: `pnpm test:db`, `pnpm test` y `pnpm --filter web build` en verde. La base y el esqueleto del sitio están listos.

> Nota de implementación (2026-10-19): el adaptador de Vercel no admite `astro preview`, así que la verificación de `Astro.rewrite('/404')` de T043 se hace en `astro dev` con la primera página dinámica (T058). En Windows, `astro build` necesita el Modo de desarrollador activado: el adaptador crea *symlinks* en `.vercel/output`.

---

## Fase 3: Historia 1 - Leer un artículo (Prioridad: P1) 🎯 MVP

**Objetivo**: `/blog/{slug}` muestra un artículo publicado completo, con los 10 tipos de bloque, ficha del autor y relacionados; todo lo no publicado responde 404.

**Prueba independiente**: Abrir "Guía visual: todos los bloques del blog" (T012) y comprobar que cada bloque se ve en su orden, que hay un único `h1` y que las imágenes no decorativas tienen `alt`.

### Tests de la Historia 1 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T044 [P] [H1] Crear `packages/bloques/src/render/bloques.test.tsx` con `renderToStaticMarkup` (RF-002, H1-E1, H1-E3, [contracts/bloques-render.md](contracts/bloques-render.md#salida-html-por-tipo)):
  - un contenido con los 10 tipos sale en el mismo orden del arreglo;
  - `titulo` con `nivel` 2, 3 y 4 produce `h2`, `h3` y `h4`, con `id` = slug del texto;
  - `parrafo`: doble salto → dos `<p>`, salto simple → `<br>`;
  - `lista` ordenada → `<ol>`, no ordenada → `<ul>`;
  - `imagen` con leyenda → `<figure>` + `<figcaption>`; decorativa → `alt=""` y sin `figcaption`;
  - `cita` → `<blockquote>` con `cite` y `<figcaption>` con autor y fuente;
  - `galeria` → `<ul role="list">` con un `<li>` por imagen y la clase de grilla según `columnas`;
  - `codigo` → `<pre tabindex="0"><code data-lenguaje="…">` y el lenguaje visible en `<figcaption>`;
  - `separador` → `<hr>`;
  - un tipo desconocido no rompe el render (devuelve nada y llama a `console.warn`);
  - `<Bloques>` usa el `componentes.Imagen` que recibe por props.
- [X] T045 [P] [H1] Crear `packages/bloques/src/render/seguridad.test.tsx` (RF-003, H1-E2, H1-E6, caso borde de esquemas peligrosos): un párrafo, un título y un bloque de código con `<script>alert(1)</script>` o `{{x}}` salen escapados (`&lt;script&gt;`); una CTA o una cita con `javascript:alert(1)` o `data:` como URL se renderizan como texto, sin `href`; una CTA `http://…` se acepta como enlace; una CTA `https://…` lleva `target="_blank"`, `rel="noopener noreferrer"` y el aviso "se abre en otra pestaña" para lectores de pantalla; una CTA interna (`/…`) no lleva `target`; `mailto:` se acepta.
- [X] T046 [P] [H1] Crear `packages/bloques/src/render/video.test.tsx` (RF-004, research D6): el bloque YouTube produce un `<iframe>` con `title`, `loading="lazy"` y `srcdoc` que contiene la miniatura `i.ytimg.com/vi/<id>/hqdefault.jpg` y un enlace a `youtube-nocookie.com/embed/<id>?autoplay=1`; **no** tiene `src` hacia el proveedor; debajo hay un enlace "Ver en YouTube". Vimeo usa `player.vimeo.com/video/<id>` y "Ver en Vimeo".
- [X] T047 [P] [H1] Ampliar `packages/db/src/consultas/listados.test.ts` (integración, RF-005, research D18): `listarRelacionados(c, { id, categoriaId }, 3)` devuelve hasta 3 publicados, primero de la misma categoría, sin el propio artículo, completando con los más recientes sin repetir.
- [X] T048 [P] [H1] Crear `e2e/web/articulo.spec.ts` (H1-E1, H1-E4, RF-001, RF-005): en la guía de bloques hay un único `h1` con el título, el nombre y la foto del autor, la fecha en `<time datetime>`, la categoría y las etiquetas enlazadas, los 10 bloques en orden, la ficha del autor que enlaza a `/blog/autor/<slug>` y hasta 3 relacionados; al cargar la página **no** sale ninguna petición a `youtube.com`, `youtube-nocookie.com` ni `ytimg.com` fuera del `srcdoc` (escuchar `page.on('request')`); el bloque de código muestra `<script>` como texto; toda `<img>` tiene `width` y `height`, la imagen destacada tiene `fetchpriority="high"` y no es `lazy`, y las imágenes del cuerpo tienen `loading="lazy"` (RF-026).
- [X] T049 [P] [H1] Crear `e2e/web/estados.spec.ts` (H1-E5, RF-006 y casos borde): los slugs del seed en borrador, programado y archivado, y `/blog/no-existe`, responden 404 con cabecera, pie y enlaces a la portada y al blog, sin diferencias entre sí; `/cualquier-cosa` responde 404; el artículo sin imagen destacada se ve con la imagen genérica en su tarjeta y en `og:image`; el título de 120 caracteres no desborda la tarjeta (`scrollWidth <= clientWidth`) y conserva el texto completo accesible.

### Implementación de la Historia 1

- [X] T050 [P] [H1] Crear `packages/bloques/src/render/enlaces.ts` con `hrefSeguro(url): string | null` (acepta `/…` interno, `https:`, `http:` y `mailto:`, y devuelve `null` para el resto) y `esExterno(url)`. Para el `id` de los títulos, reutilizar el slugificador de `packages/bloques/src/utilidades.ts` si existe; si no, agregarlo ahí (no en `render/`).
- [X] T051 [P] [H1] Crear los renderers de texto en `packages/bloques/src/render/`: `TextoEnLinea.tsx` (Markdown inline de la 001, research D9: `**negrita**`, `_cursiva_`, `` `código` `` y `[texto](url)` con `hrefSeguro`, generando elementos React y nunca HTML; debe pasar `texto-en-linea.test.tsx`), `Parrafo.tsx`, `Titulo.tsx`, `Lista.tsx`, `Cita.tsx`, `Separador.tsx` y `Codigo.tsx`. Componentes puros, sin hooks; solo clases Tailwind sobre tokens.
- [X] T052 [P] [H1] Crear los renderers con medios en `packages/bloques/src/render/`: `ImagenBloque.tsx`, `Galeria.tsx` (1 o 2 columnas en móvil y `columnas` desde 768 px), `Cta.tsx` (usa `hrefSeguro`) y `Video.tsx` (iframe `srcdoc`, research D6).
- [X] T053 [H1] Crear `packages/bloques/src/render/Bloques.tsx` y `packages/bloques/src/render/index.ts`, que exportan `Bloques`, `PropsImagen` y `ComponentesBloques` ([contracts/bloques-render.md](contracts/bloques-render.md#api)). Deben pasar T044–T046 y `pnpm --filter @blog/bloques lint`.
- [X] T054 [P] [H1] Agregar `listarRelacionados(c, { id, categoriaId }, cantidad = 3)` a `packages/db/src/consultas/listados.ts` (a lo sumo 2 peticiones) y exportarlo desde `packages/db/src/index.ts`. Debe pasar T047.
- [X] T055 [P] [H1] Crear `apps/web/src/components/ImagenWeb.tsx` con `crearImagenWeb(variantes)`, que devuelve el componente `Imagen` para `<Bloques>`: usa el mapa de T034, pone `width`, `height`, `alt` (vacío si es decorativa), `sizes`, `loading="lazy"` o, si `prioridad`, `loading="eager"` + `fetchpriority="high"`.
- [X] T056 [P] [H1] Crear `apps/web/src/components/TarjetaArticulo.astro`, la **única** tarjeta (RF-009): imagen (o la genérica) con `--aspect-tarjeta`, título enlazado como encabezado de nivel configurable, extracto, categoría y fecha; recorte visual con `line-clamp` sin perder el texto completo.
- [X] T057 [P] [H1] Crear `apps/web/src/components/FichaAutor.astro` (foto, nombre enlazado a `/blog/autor/<slug>` y biografía), `apps/web/src/components/Relacionados.astro` (usa `TarjetaArticulo`) y `apps/web/src/components/Migas.astro` (navegación de migas de pan visible, `<nav aria-label="Migas de pan">`).
- [X] T058 [H1] Crear `apps/web/src/pages/blog/[slug].astro`:
  - `resolverEntidad` con `obtenerArticuloPublicado` y `resolverRedireccion('articulo')`: 301 con `cacheRedireccion()`, 404 con `cacheNoEncontrado()` y `respuestaNoEncontrado()` (research D13: Astro no permite reescribir hacia la 404 prerenderizada);
  - `listarRelacionados`, `precalcularVariantes` de la imagen destacada y de las imágenes del contenido;
  - `Astro.cache.set(cacheArticulo(articulo, relacionados))`;
  - `<Base>` con `Seo` tipo `article` (`seo.titulo`, `seo.descripcion`, fechas, sección y etiquetas);
  - cabecera del artículo con `h1`, autor, `<time datetime>` de publicación y de actualización (si difiere), categoría y etiquetas; imagen destacada con `prioridad`; `<Bloques contenido componentes={{ Imagen: crearImagenWeb(variantes) }} />` **sin** directiva `client:`; `FichaAutor` y `Relacionados`.
  Deben pasar T048 y T049.

**Checkpoint**: H1 funciona y se prueba sola. Es el MVP.

---

## Fase 4: Historia 2 - Recorrer el blog por listados (Prioridad: P1)

**Objetivo**: `/blog`, su paginación y las páginas de categoría, etiqueta y autor, con estados vacíos y 404 fuera de rango.

**Prueba independiente**: Con el seed, recorrer `/blog`, `/blog/pagina/2`, una categoría, una etiqueta y un autor, y comprobar orden, paginación y contenido.

### Tests de la Historia 2 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T059 [P] [H2] Crear `apps/web/src/lib/paginacion.test.ts` (RF-010, H2-E5, H2-E6): `resolverPagina(undefined)` → página 1; `'pagina/2'` (formato de `[...pagina]`) y `'2'` (formato de `pagina/[n]`) → página 2; `'pagina/1'` o `'1'` → redirección a la URL sin paginar; `'0'`, `'-1'`, `'2.5'`, `'abc'`, `'pagina/x'` → 404; y `fueraDeRango(pagina, totalPaginas)` → 404 cuando `pagina > max(totalPaginas, 1)`.
- [X] T060 [P] [H2] Ampliar `packages/db/src/consultas/listados.test.ts` (integración, H2-E4): `listarPorAutor(c, slug)` devuelve `{ autor: { id, slug, nombre, biografia, avatar }, articulos }` solo con sus publicados por fecha descendente; un slug inexistente o de un autor sin publicados devuelve `null`; el objeto `autor` no tiene `email`, `rol` ni `activo`. (Hacer después de T047, mismo archivo.)
- [X] T061 [P] [H2] Crear `e2e/web/listados.spec.ts` (H2-E1 a H2-E7, RF-007 a RF-010, RSEO-004, RSEO-009): `/blog` muestra 12 tarjetas por fecha descendente y `<nav aria-label="Paginación">` con la página actual marcada (`aria-current="page"`) y enlace a `/blog/pagina/2`; `/blog/pagina/2` muestra el resto con canónica propia y "página 2" en el título; `/blog/pagina/1` responde 301 a `/blog`; `/blog/pagina/99` responde 404; `/blog/categoria/diseno` muestra su nombre como `h1`, su descripción y solo sus publicados; lo mismo con una etiqueta; `/blog/autor/<slug>` muestra nombre, foto, biografía y sus artículos, y el HTML no contiene `@demo.local` ni los textos `admin`/`editor`; una categoría o etiqueta sin publicados muestra el estado vacío con enlace al blog y `meta robots noindex`.

### Implementación de la Historia 2

- [X] T062 [H2] En `packages/db/src/consultas/listados.ts`, agregar el filtro `autorId` a `paginaDeArticulos` y crear `listarPorAutor(c, slug, opciones)` (≤ 2 peticiones: `autores_publicos` por `slug` y después la página). Exportarlo desde `packages/db/src/index.ts`. Debe pasar T060 (depende de T054, mismo archivo).
- [X] T063 [P] [H2] Crear `apps/web/src/lib/paginacion.ts` con `resolverPagina(param)` y `fueraDeRango(...)`, reutilizando `Pagina<T>` de `@blog/db`. Debe pasar T059.
- [X] T064 [P] [H2] Crear `apps/web/src/components/Paginacion.astro` (`<nav aria-label="Paginación">`, anterior, siguiente y página actual con `aria-current="page"`; áreas táctiles de 44 px), `apps/web/src/components/EstadoVacio.astro` (mensaje y enlace al blog) y `apps/web/src/components/ListadoArticulos.astro` (encabezado de la página con `h1`, presentación opcional, grilla de `TarjetaArticulo`, `Paginacion` o `EstadoVacio`). Es el **único** listado para `/blog`, categoría, etiqueta y autor.
- [X] T065 [H2] Crear `apps/web/src/pages/blog/[...pagina].astro` (una sola página para `/blog` y `/blog/pagina/<n>`, sobre `resolverListado` de `src/lib/listados.ts`) con `listarArticulosPublicados`, `resolverPagina`, `Astro.cache.set(cacheListado())` y `Seo` ("Blog" + " — página n", descripción de `landing.blog.descripcion`, canónica propia).
- [X] T066 [H2] Crear `apps/web/src/pages/blog/categoria/[slug]/[...pagina].astro` y `apps/web/src/pages/blog/etiqueta/[slug]/[...pagina].astro` como páginas finas sobre `resolverTaxonomia` (`src/lib/taxonomias.ts`) y `components/PaginaTaxonomia.astro` (§VIII; un segmento `[taxonomia]` capturaría `/blog/pagina/<n>`): `resolverEntidad` (con `resolverRedireccion('categoria' | 'etiqueta')`) + `resolverPagina`, `cacheListado({ tipo, id })`, `noindex` si no hay publicados (RSEO-009). Si la lógica de carga se repite entre las dos páginas, extraerla a `apps/web/src/lib/listados.ts` (§VIII; jscpd ≤ 3 %).
- [X] T067 [H2] Crear `apps/web/src/pages/blog/autor/[slug]/[...pagina].astro` con `listarPorAutor`, `resolverPagina`, `cacheListado({ tipo: 'autor', id })`, `Seo` tipo `profile` (biografía recortada a 160 o texto genérico) y 404 sin redirecciones (RF-011). Deben pasar T061.

**Checkpoint**: H1 y H2 funcionan de forma independiente.

---

## Fase 5: Historia 3 - Conocer la propuesta en la landing (Prioridad: P2)

**Objetivo**: la portada con sus seis secciones en orden, configurable por cliente y con contacto por WhatsApp y correo.

**Prueba independiente**: Abrir `/`, ver las seis secciones en orden, los 3 últimos publicados y el contacto; cambiar un texto de `landing.ts` y un color de `tokens.css` y ver el cambio sin tocar componentes.

### Tests de la Historia 3 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T068 [P] [H3] Reescribir `e2e/web/humo.spec.ts` como `e2e/web/landing.spec.ts` (H3-E1 a H3-E4, RF-012 a RF-014): un único `h1` (el del hero); las secciones hero, propuesta, servicios, testimonios (con el texto "Testimonios de ejemplo"), últimos artículos y contacto aparecen en ese orden en el DOM; hay 3 tarjetas y coinciden con los 3 publicados más recientes de `/blog`; el CTA del hero, el de la cabecera y el final apuntan a `https://wa.me/<numero>?text=…`; hay un enlace `mailto:` con `subject`; el pie muestra el número y el correo como texto y enlaza al blog y a `/rss.xml`; la cabecera tiene el logo y la navegación Inicio, Blog y Contacto (RF-015); la imagen del hero tiene `width`, `height` y `fetchpriority="high"` (RF-026). Borrar `e2e/web/humo.spec.ts`.
- [X] T069 [P] [H3] Crear `apps/web/src/components/landing/UltimosArticulos.test.ts` con el Container API de Astro (`experimental_AstroContainer`): con una lista vacía no renderiza nada (H3-E3, RF-014); con 3 artículos renderiza 3 `TarjetaArticulo`.

### Implementación de la Historia 3

- [X] T070 [P] [H3] Agregar las imágenes de demo a `apps/web/src/assets/landing/` (hero y fotos de testimonios, con licencia libre o generadas) y referenciarlas desde `landing.ts`.
- [X] T071 [P] [H3] Crear `apps/web/src/components/landing/Hero.astro` (`h1`, bajada, `Boton` hacia WhatsApp e imagen con `<Image>` de `astro:assets`, `loading="eager"` y `fetchpriority="high"`), `Propuesta.astro` y `Servicios.astro` (íconos de T038), cada uno con su `h2`.
- [X] T072 [P] [H3] Crear `apps/web/src/components/landing/Testimonios.astro` (con la leyenda visible "Testimonios de ejemplo", [contracts/landing.md](contracts/landing.md)), `UltimosArticulos.astro` (usa `TarjetaArticulo`; no renderiza nada si la lista está vacía) y `Contacto.astro` (`id="contacto"`, WhatsApp como acción principal y correo como alternativa visible). Debe pasar T069.
- [X] T073 [H3] Reescribir `apps/web/src/pages/index.astro`: `<Base>` con `Seo` (`sitio.nombre` + lema, `sitio.descripcion`), las seis secciones en orden, `listarArticulosPublicados({ porPagina: 3 })` y `Astro.cache.set(cacheListado())`. Debe pasar T068.

**Checkpoint**: la demo se puede mostrar completa (portada + blog).

---

## Fase 6: Historia 4 - Ver siempre la versión vigente (Prioridad: P2)

**Objetivo**: el receptor de avisos firmados invalida los tags y las rutas afectadas; los slugs viejos y las URLs no canónicas redirigen con 301.

**Prueba independiente**: con el seed, `/blog/<slug-a>` redirige en un salto a `/blog/<slug-c>`; un aviso firmado devuelve 200 con los tags esperados y uno mal firmado devuelve 401. La medición de menos de 60 s se hace en Vercel (T101).

### Tests de la Historia 4 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T074 [P] [H4] Crear `packages/db/src/invalidaciones.test.ts` ([contracts/cache.md](contracts/cache.md), H4-E1, H4-E3, H4-E6, H4-E7): `invalidacionesDe` para cada `tipo` según la tabla del contrato (por ejemplo, `articulo` con slugs `['b', 'a']` → tags `['articulos', 'articulo:<id>']` y rutas `['/blog/b', '/blog/a']`; `autor` → sin rutas), sin repetidos y en orden estable; llamarla dos veces da el mismo resultado; `leerCambioPublico` acepta un aviso válido e ignora campos desconocidos, y lanza `ErrorDominio('validacion')` si falta `tipo`, si `id` no es uuid, si `slugs` está vacío o tiene más de 50 elementos, si un slug no tiene formato de slug o si `ocurrido_en` no es ISO.
- [X] T075 [P] [H4] Crear `apps/web/src/lib/aviso.test.ts` (research D4, H4-E2, CE-009): `verificarAviso({ cuerpo, marca, firma, secreto, ahora })` acepta la firma HMAC-SHA256 correcta sobre `marca + '.' + cuerpo`; rechaza sin firma, sin marca, con firma de otro cuerpo, con firma de largo distinto (sin lanzar excepción) y con `|ahora − marca| > 300 s` en ambos sentidos; acepta justo en 300 s.
- [X] T076 [P] [H4] Crear `apps/web/src/lib/revalidar.test.ts` (no dentro de `src/pages/`, donde Astro lo tomaría como ruta; análisis I2) sobre `procesarAviso({ request, cache, secreto, ahora })`, con `cache.invalidate` espiado ([contracts/cache.md](contracts/cache.md#post-apirevalidar)): `GET` → 405; firma inválida → 401 `{"error":"no_autorizado"}` sin llamar a `invalidate`; firma válida con cuerpo no JSON o fuera del esquema → 400 `{"error":"peticion_invalida"}` sin llamar a `invalidate` (la firma se verifica primero: un cuerpo malo mal firmado da 401); aviso válido → 200 `{ tags, rutas }` y `invalidate` recibe los tags y cada ruta; el mismo aviso dos veces da respuestas idénticas (H4-E3); si `invalidate` falla → 502 `{"error":"invalidacion_fallida"}`; la respuesta no se cachea.
- [X] T077 [P] [H4] Crear `apps/web/src/middleware.test.ts` (RF-022, research D12): `/Blog/Mi-Articulo?x=1` → 301 a `/blog/mi-articulo?x=1`; una ruta en minúsculas pasa sin cambios.
- [X] T078 [P] [H4] Crear `e2e/web/redirecciones.spec.ts` (H4-E4, H4-E5, RF-021, RF-022, CE-005), con `maxRedirects: 0`: el slug original del artículo renombrado dos veces (T012) responde 301 directo a la URL vigente (un solo salto); el slug intermedio también; el slug anterior de la categoría y el de la etiqueta responden 301 a sus URLs vigentes; `/Blog` responde 301 a `/blog`. (La barra final la redirige Vercel con 308, no `astro dev`: se verifica sobre el preview en T099, análisis I6.)

### Implementación de la Historia 4

- [X] T079 [H4] Crear `packages/db/src/invalidaciones.ts` con `esquemaCambioPublico` (Zod, no estricto: `tipo` `'articulo' | 'categoria' | 'etiqueta' | 'autor'`, `id` uuid, `slugs` 1..50 con formato slug, `categorias?` y `etiquetas?` aceptados y no usados, `ocurrido_en` ISO), `type CambioPublico = z.infer<…>`, `leerCambioPublico(json)` y `invalidacionesDe(cambio)` sobre `tags.ts`. **Borrar** `packages/db/src/rutas-afectadas.ts` y `rutas-afectadas.test.ts`, y actualizar `packages/db/src/index.ts` (fuera `rutasAfectadas`; dentro `invalidacionesDe`, `leerCambioPublico`, `esquemaCambioPublico` y `CambioPublico`). Debe pasar T074.
- [X] T080 [P] [H4] Crear `apps/web/src/lib/aviso.ts` con `verificarAviso` (`createHmac` y `timingSafeEqual` de `node:crypto`, comparación de largos antes de `timingSafeEqual`). Debe pasar T075.
- [X] T081 [H4] Crear `apps/web/src/lib/revalidar.ts` con `procesarAviso`: lee `X-Blog-Marca-Tiempo` y `X-Blog-Firma`, `await request.text()`, `verificarAviso` → `leerCambioPublico` → `invalidacionesDe` → `await cache.invalidate({ tags })` e `invalidate({ path })` por ruta, y devuelve la `Response`. Crear `apps/web/src/pages/api/revalidar.ts` como capa fina (`export const prerender = false`, `context.cache.set(false)`; `POST` llama a `procesarAviso` con `context.cache` y `SECRETO_REVALIDACION`; `ALL` → 405). Debe pasar T076.
- [X] T082 [H4] Crear `apps/web/src/middleware.ts` con la redirección 301 a minúsculas conservando la query. Debe pasar T077 y, con T058 y T066, T078.
- [X] T083 [P] [H4] Actualizar `specs/001-modelo-de-contenido/contracts/revalidacion.md`: la sección "Rutas que calcula `rutasAfectadas`" (línea ~45) se reemplaza por una referencia a `invalidacionesDe` en [contracts/cache.md](contracts/cache.md), y se aclara que `SECRETO_REVALIDACION` solo firma (data-model 002, "Cambios en la spec 001", punto 3).

**Checkpoint**: H1 a H4 funcionan; el sitio queda listo para recibir avisos en Vercel.

---

## Fase 7: Historia 5 - Ser encontrado por buscadores y lectores de feeds (Prioridad: P3)

**Objetivo**: JSON-LD en todas las páginas, sitemap y RSS propios, robots y `noindex` fuera de producción.

**Prueba independiente**: validar `/sitemap.xml`, `/rss.xml` y el JSON-LD con validadores estándar, y que cada tipo de página tiene sus metadatos.

### Tests de la Historia 5 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T084 [P] [H5] Crear `apps/web/src/lib/json-ld.test.ts` (RSEO-002, RSEO-003): `blogPosting(articulo, sitio)` incluye `headline`, `image`, `author` (`Person` con URL de autor), `publisher` (`Organization` con logo), `datePublished`, `dateModified`, `mainEntityOfPage` y URL absoluta; `migas([...])` produce un `BreadcrumbList` con `position` desde 1 e `item` absoluto; `organizacion(sitio)` y `sitioWeb(sitio)` para la portada; `coleccion(...)` (`CollectionPage`) y `perfil(autor)` (`ProfilePage` con `mainEntity` `Person`).
- [X] T085 [P] [H5] Crear `apps/web/src/lib/sitemap.test.ts` (RSEO-005, H5-E1): `xmlSitemap(entradas, sitio)` produce un XML con `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, la portada y `/blog`, una `<url>` por entrada con `<loc>` absoluta según el tipo (`/blog/<slug>`, `/blog/categoria/<slug>`, `/blog/etiqueta/<slug>`, `/blog/autor/<slug>`) y `<lastmod>` en ISO; escapa `&` y `<`.
- [X] T086 [P] [H5] Ampliar `apps/web/src/middleware.test.ts` (RSEO-007, H5-E6): con `VERCEL_ENV` distinto de `production` (o ausente), la respuesta lleva `X-Robots-Tag: noindex`; con `production`, no. (Hacer después de T077, mismo archivo.)
- [X] T087 [P] [H5] Crear `e2e/web/seo.spec.ts` (H5-E1 a H5-E5, RSEO-001 a RSEO-007, CE-003): recorre `/`, `/blog`, `/blog/pagina/2`, un artículo, una categoría, una etiqueta, un autor y una URL inexistente, y verifica en cada una `<html lang="es">`, `title` de 60 caracteres o menos, `meta description` de 160 o menos, canónica absoluta, `og:type`, `og:title`, `og:description`, `og:image` con dimensiones, `og:url`, `twitter:card = summary_large_image` y el `link rel=alternate` del feed; los JSON-LD esperados por tipo de página se parsean sin error; `/sitemap.xml` incluye la guía de bloques, una categoría y un autor, y **no** incluye una taxonomía vacía, un borrador ni un slug anterior; `/rss.xml` tiene exactamente `min(20, publicados)` ítems con `link` absoluto, `description`, `pubDate` y `category`; `/robots.txt` tiene `Allow: /`, `Disallow: /api/` y `Sitemap: <PUBLIC_URL_SITIO>/sitemap.xml`.

### Implementación de la Historia 5

- [X] T088 [P] [H5] Crear `apps/web/src/lib/json-ld.ts` con `blogPosting`, `migas`, `organizacion`, `sitioWeb`, `coleccion` y `perfil`, puras. Debe pasar T084.
- [X] T089 [H5] Pasar `jsonLd` a `<Seo />` desde cada página, según [contracts/rutas.md](contracts/rutas.md#metadatos-por-ruta-componente-único-seo-rseo-001-a-rseo-009): `pages/index.astro` (`Organization`, `WebSite`), `pages/blog/[slug].astro` (`BlogPosting`, `BreadcrumbList` Inicio › Blog › Categoría › Artículo), las páginas de listado y taxonomía (`CollectionPage`, `BreadcrumbList`) y la de autor (`ProfilePage`, `BreadcrumbList`). Si las migas de `Migas.astro` y las de JSON-LD salen de la misma lista, armarla una sola vez por página.
- [X] T090 [P] [H5] Crear `apps/web/src/lib/sitemap.ts` con `xmlSitemap(entradas, sitio)` y `apps/web/src/pages/sitemap.xml.ts` (`listarParaSitemap`, `Content-Type: application/xml`, `Astro.cache.set(cacheListado())`). Debe pasar T085.
- [X] T091 [P] [H5] Crear `apps/web/src/pages/rss.xml.ts` con `@astrojs/rss` sobre `listarArticulosPublicados({ porPagina: 20 })`: título y descripción del sitio, `link` absoluto, `description` = extracto, `pubDate`, `categories` = categoría; `cacheListado()`.
- [X] T092 [H5] Crear `apps/web/src/pages/robots.txt.ts` (`prerender = true`): `User-agent: *`, `Allow: /`, `Disallow: /api/` y `Sitemap:` absoluto. Agregar a `apps/web/src/middleware.ts` el encabezado `X-Robots-Tag: noindex` cuando `VERCEL_ENV !== 'production'` (depende de T082). Deben pasar T086 y T087.
- [X] T093 [P] [H5] Crear `apps/web/public/og-generica.png` (1200 × 630, con los colores de los tokens y el nombre genérico del sitio) y revisar que `favicon.svg` y `favicon.ico` sean genéricos.

**Checkpoint**: las 5 historias están completas.

---

## Fase 8: Validación y cierre

**Propósito**: Accesibilidad, responsive, documentación, verificación en Vercel y gates.

- [X] T094 [P] Crear `e2e/web/accesibilidad.spec.ts` (CE-006, CE-008, RSEO-008, RF-017): con `@axe-core/playwright` (etiquetas `wcag2a`, `wcag2aa`, `wcag21aa`), cero violaciones en `/`, `/blog`, la guía de bloques, una categoría, un autor y la 404; un único `h1` y sin saltos de nivel de encabezado en cada página; el primer `Tab` enfoca "Saltar al contenido" y lleva a `#contenido`; recorrer con `Tab` todos los enlaces muestra un foco visible; ningún `<script>` salvo `type="application/ld+json"` (sin JS de cliente).
- [X] T095 [P] Crear `e2e/web/responsive.spec.ts` (CE-007, caso borde de galerías): en 360, 768, 1024 y 1440 px, `/`, `/blog`, la guía de bloques (con la galería de 4 imágenes), el artículo con la galería de 2 imágenes y un autor no tienen desborde horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- [X] T096 Actualizar `.claude/skills/astro-seo/SKILL.md` (plan.md, "Seguimiento de complejidad"): reemplazar la estrategia de ISR por ruta (§1–2) por el caché de rutas con tags (research D1–D3), los helpers de `lib/cache.ts`, `invalidacionesDe`, el sitemap propio (D14), el `iframe srcdoc` del video (D6) y los renderers de `@blog/bloques/render` (D5).
- [X] T097 Ejecutar `pnpm formato && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build && pnpm test:e2e --project=web`. Corregir lo que falle. knip no debe reportar `rutasAfectadas` ni `@astrojs/sitemap`; jscpd ≤ 3 %. Buscar colores y medidas literales (`#[0-9a-f]{3,8}`, `oklch(`, `rgb(`, `[0-9]+px`) en `apps/web/src` y `packages/bloques/src/render`: no debe haber ninguno fuera de `tokens.css` (§VII.2, RF-013).
- [X] T098 Recorrer [quickstart.md](quickstart.md) §1–4 y confirmar cada "Esperado". Corregir el quickstart si algo cambió.
- [X] T099 Mediciones sobre el **preview del PR** (constitución §IV.8, [quickstart.md](quickstart.md) §6; análisis C3), antes de `/validar`: Lighthouse móvil en `/`, `/blog`, la guía de bloques y una categoría (CE-001, CE-002); schema.org sobre un artículo y la portada, y validadores de sitemap y feed (CE-003, CE-010); `X-Robots-Tag: noindex` (H5-E6); `/blog/` redirige de forma permanente a `/blog` (RF-022); las imágenes de picsum salen optimizadas por `/_vercel/image` (si no, plan B de research D7). Anotar los resultados en `validacion.md`.
- [X] T100 Ejecutar `/validar` (`arquitecto-db`, `revisor-ux-ui` y `consistencia-codigo`, que debe aprobar las dependencias de T002–T006) y resolver todos los BLOQUEANTES en `specs/002-sitio-publico/validacion.md`.
- [ ] T101 Nube y producción ([quickstart.md](quickstart.md) §5), después del merge a `main`:
  - aplicar `20261019120000_tipo_entidad_autor.sql` y `20261019120100_autores_publicos.sql` en el SQL Editor **en dos corridas separadas** (o, si antes se hizo `supabase migration repair`, con `supabase db push`). Aplicar antes las migraciones de la 001 que la nube no tenga (ver D1 en "Dependencias");
  - crear los secretos de Vault `url_web_revalidacion` (URL de producción de `blog-web`) y `secreto_revalidacion` (igual a la variable de Vercel);
  - medir CE-004 (menos de 60 s) y H4-E6, y anotarlo en `validacion.md`;
  - pasar validator.schema.org (artículo y portada) y los validadores de W3C de sitemap y feed sobre producción (CE-003, CE-010), que el preview protegido no permite.
- [ ] T103 [P] Enmienda PARCHE de `constitucion.md`: quitar `@astrojs/sitemap` de la tabla §II, porque el sitemap es propio (research D14; validación C-M2).
- [ ] T104 [P] Teléfono del pie con formato legible: campo `contacto.whatsappVisible` (por ejemplo "+54 9 11 0000-0000") en `contracts/landing.md`, `esquema.ts`, `landing.ts` y `Pie.astro` (validación U-M11).
- [ ] T105 [P] Spec 001: corregir el encabezado de `supabase/migrations/20261018120100_perfiles.sql:4`, que nombra `20261018120900_equipo.sql`; el archivo real será `20261019120900_equipo.sql` (validación, observación fuera de alcance).
- [ ] T102 Actualizar la sección "Estado actual" de `CLAUDE.md` (spec 002 completa, Vault cargado, pendientes de la 001) y quitar la nota sobre la skill `astro-seo` desactualizada.

---

## Dependencias y orden de ejecución

### Entre fases

- **Preparación (F1)** → **Fundacional (F2)** → historias → **Validación (F8)**.
- T012 (seed) va antes que T017 (mismo archivo `seed.test.sql`) y antes de los E2E de H1, H2 y H4.
- **H1 (P1)** solo depende de F2. Es el MVP.
- **H2 (P1)** depende de F2 y reutiliza `TarjetaArticulo` (T056) de H1. Se puede empezar en paralelo con H1 si alguien hace T056 primero.
- **H3 (P2)** depende de F2 y de `TarjetaArticulo` (T056).
- **H4 (P2)** depende de F2. Sus E2E de redirecciones (T078) necesitan las páginas de T058 y T066. Los tests unitarios y el endpoint (T074–T081) no dependen de H1–H3.
- **H5 (P3)** depende de las páginas de H1–H3 para cablear el JSON-LD (T089) y del middleware de H4 (T092 depende de T082).
- **No hay PR ni merge a `main` sin H5**: los metadatos completos, el JSON-LD, el sitemap, el RSS y robots son DEBE de la constitución (§IV.3 y §IV.4; análisis C4). El MVP se valida en local o en preview, no en producción.

### Relación con la spec 001 (análisis D1)

- Esta rama sale de `001-modelo-de-contenido`, que no está mergeada. **El PR de la 002 a `main` incluye los commits de la 001** (F1, F2, H1–H3 y el seed, validados con APROBADO en la ronda 6), en un PR conjunto.
- H4–H6 y T067–T072 de la 001 siguen pendientes. Después del merge se retoman en la rama `001-modelo-de-contenido`, rebasada sobre `main`.
- Mientras la H4 de la 001 (pg_cron) no exista, un programado no pasa solo a publicado. El caso borde "programado que llega a su hora" se verifica cuando esa historia esté hecha; acá solo se prueba que antes de su hora responde 404 (T049).

### Archivos compartidos (hacer en secuencia)

- `packages/db/src/consultas/listados.ts` y su test: T047 → T054 → T060 → T062.
- `apps/web/src/middleware.ts` y su test: T077 → T082 → T086 → T092.
- `packages/db/src/index.ts`: T030, T054, T062, T079.
- `supabase/tests/seed.test.sql`: T012 → T017.
- Las páginas de `apps/web/src/pages/` se tocan en su historia y otra vez en T089.

### Dentro de cada historia

Tests (rojo) → datos y consultas en `packages/db` → lógica pura en `packages/*` o `apps/web/src/lib` → componentes → páginas.

## Ejemplos de ejecución en paralelo

**Fundacional, tests** (todos [P], archivos distintos):
```text
T013 autores_slug.test.sql   T014 autores_publicos.test.sql   T015 sitemap.test.sql
T016 privilegios.test.sql    T018 articulos-publicos.test.ts  T019 tokens.test.ts
T020–T025 tests de apps/web/src/lib y contenido
```

**Fundacional, implementación** (después de T027–T029): T030, T031, T032, T033, T034, T035, T036, T037, T038 y T040 en paralelo.

**H1**: T044, T045, T046, T047, T048 y T049 en paralelo; después T050, T051, T052, T054, T055, T056 y T057 en paralelo; T053 y T058 al final.

**H2**: T059 y T061 en paralelo (T060 después de T047); T063 y T064 en paralelo; T065 → T066 → T067.

**H4**: T074–T078 en paralelo; T079 y T080 en paralelo; T081, T082 y T083.

**H5**: T084, T085 y T087 en paralelo; T088, T090, T091 y T093 en paralelo; T089 y T092 al final.

## Estrategia

- **MVP primero**: F1 + F2 + H1. Un artículo del blog se ve completo, con metadatos base, en local o en un preview. Es un punto de control, no un release: el PR espera a H5 (ver "Dependencias").
- **Incremental**: H2 (navegación del blog) → H3 (portada de la demo) → H4 (actualización automática y redirecciones) → H5 (descubrimiento por buscadores). Cada historia suma valor sin romper las anteriores.
- **En Vercel**: el caché de rutas solo está activo en Vercel (en `astro dev` está desactivado, research D1). La invalidación se prueba en unidad (T074–T076) y se mide en producción (T101).
- **Sin Docker** (situación actual de esta PC): se pueden avanzar los tests y la implementación pura (T019–T025, T030–T041, T044–T046, T050–T053, T059, T063, T074–T077, T079–T082, T084–T088); los pgTAP, los tests de integración de `packages/db` y los E2E necesitan Supabase local.

## Notas

- Commit por tarea o grupo lógico (Conventional Commits en español, por ejemplo `feat(web): agrega la página de artículo`).
- Verificar que los tests fallen antes de implementar.
- Antes de crear un archivo, buscar si ya existe algo reutilizable (§VIII y tabla "Reutilización" de plan.md).
- Ninguna tarea agrega directivas `client:`: si alguna lo parece necesario, se justifica primero en plan.md (§IV.2).
