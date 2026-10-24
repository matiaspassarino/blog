# Constitución del Proyecto Blog

<!--
Informe de sincronización
- Versión: 1.0.3 → 2.0.0 (MAYOR, 2026-10-22). Pedida por el usuario en la spec 005 (editor estilo documento con
  Tiptap): el contenido deja de ser un arreglo de bloques y pasa a ser el documento JSON de Tiptap/ProseMirror,
  para aprovechar más funciones del editor (más marcas en línea, alineación de párrafos y títulos, y tablas).
  - Principio redefinido: §VI "Contenido en bloques" → "Contenido como documento estructurado" (6 puntos).
  - §I (MVP, punto 2): artículos escritos como un documento estructurado.
  - §II: nueva fila "Editor de texto: Tiptap 3.31" (absorbe la T085 de la spec 005).
  - §III: árbol y §III.5 hablan del documento y de su editor; §IX.1 y §IX.3 también.
  - Secciones agregadas o quitadas: ninguna.
  - Plantillas revisadas:
    - ⚠ pendiente: .specify/templates/overrides/plan-template.md (fila "VI. Bloques (esquema único en
      packages/bloques)" del chequeo de constitución → "VI. Documento (esquema único en packages/bloques)").
    - ✅ spec-template.md, tasks-template.md (y sus overrides) y checklist-template.md: sin cambios necesarios.
  - Impacto en el código (pendiente, lo resuelve la spec 005 reabierta):
    - packages/bloques: esquema Zod del documento (lista blanca de nodos, marcas y atributos) y renderers.
    - apps/admin: extensiones de Tiptap derivadas del esquema; se deja de convertir a bloques.
    - apps/web: render del documento JSON.
    - supabase: privado.tipos_bloque y la validación de contenido (fundacion.sql), la extracción de texto
      para la búsqueda (busqueda.sql), las imágenes en uso y la migración de los artículos existentes
      con verificación de ida y vuelta y pgTAP.
  - TODO: ninguno en la constitución; la plantilla del plan queda pendiente (arriba).
- Versión: 1.0.2 → 1.0.3 (PARCHE, 2026-10-19). Aclaración surgida de /validar en la spec 002 (C-M2); no cambia principios:
  - §II: la fila de SEO ya no lista `@astrojs/sitemap`; el sitemap es un endpoint propio (research D14 de la spec 002).
  - Impacto: plantillas revisadas, sin cambios; código: ningún workspace depende de `@astrojs/sitemap` (se quitó en la 002).
- Versión: 1.0.1 → 1.0.2 (PARCHE, 2026-10-19). Aclaraciones surgidas de /speckit-analyze en la spec 002; no cambian principios:
  - §III.6 y §IV.1: "ISR on-demand" incluye el caché de rutas en el CDN con invalidación por tags
    (research D1 de la spec 002), y el aviso de invalidación puede emitirlo el admin o la base.
- Versión: 1.0.0 → 1.0.1 (PARCHE, 2026-10-18). Aclaraciones surgidas de /speckit-analyze en la spec 001; no cambian principios:
  - §V.3: los timestamps son obligatorios en tablas de entidades; las tablas puente y de registro quedan exentas.
  - §V.4: el editor no elimina artículos (solo archiva), según la decisión del usuario en la spec 001.
  - §V.6: el tsvector puede mantenerse por trigger si incluye datos de otras tablas.
- Plantillas revisadas: sin cambios necesarios.
- Archivo canónico: /constitucion.md (`.specify/memory/constitution.md` es un symlink a este archivo)
- Plantillas a revisar cuando se enmiende: .specify/templates/{spec,plan,tasks}-template.md
-->

Este documento es la ley del proyecto. Toda spec, plan, tarea, línea de código y revisión debe
cumplirlo. Ante un conflicto entre este documento y cualquier otra guía, prevalece este.
Las palabras **DEBE**, **NO DEBE** y **DEBERÍA** tienen sentido normativo.

---

## I. Propósito y alcance

- El producto es un **sitio estilo landing con un blog autoadministrable**. Su función es servir de
  **demo genérica** reutilizable para presentar a clientes. Se publica en Vercel.
- **El blog es el motor del sitio**: el posicionamiento orgánico (SEO) es el criterio de decisión
  de mayor peso en todo lo público.
- El **alcance del MVP** es:
  1. Una landing con secciones configurables (hero, servicios/beneficios, testimonios, CTA, contacto).
  2. Un blog con artículos escritos como un **documento estructurado** (§VI).
  3. **Categorías y etiquetas**, cada una con su página indexable.
  4. **Búsqueda** full-text en español.
  5. **Artículos programados**, que se publican en una fecha y hora futuras.
  6. Un **panel de administración** con los roles `admin` y `editor`.
- Lo que no figura en esta lista queda fuera del MVP. Para sumarlo hace falta una spec nueva.

## II. Stack cerrado (NO NEGOCIABLE)

El stack está cerrado. Para agregar, quitar o reemplazar una dependencia de runtime hacen falta
una justificación en el `plan.md` de la spec y la aprobación del agente `consistencia-codigo`.

| Capa | Tecnología | Versión base |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | pnpm 12 · turbo 2.11 |
| Lenguaje | TypeScript (strict) — 5.x hasta que typescript-eslint soporte 7 | 5.9 |
| Sitio público | Astro + `@astrojs/vercel` (ISR) + `@astrojs/react` (islas) | astro 7.4 |
| SEO | `@astrojs/rss`, sitemap y JSON-LD propios | 4.0 |
| Panel admin | Next.js App Router + React | next 16.4 · react 19 |
| UI admin | shadcn/ui sobre `packages/ui` | — |
| Estilos | Tailwind CSS v4 con tokens de `packages/ui` | 4.3 |
| Backend | Supabase (Postgres, Auth, Storage, pg_cron) | CLI 2.121 |
| Cliente datos | `@supabase/supabase-js` + `@supabase/ssr` | 2.118 / 0.12 |
| Validación | Zod | 4.6 |
| Editor de texto | Tiptap (`@tiptap/*`, sin colaboración ni `yjs`) | 3.31 |
| Tests | Vitest · Playwright · pgTAP | 5.0 · 1.64 |
| Calidad | ESLint · Prettier · knip · jscpd | 9 · 3.9 · 6 · 5 |
| Deploy | Vercel (2 proyectos: `web` y `admin`) + GitHub | — |

- Runtime: Node 24 LTS. Las versiones se fijan en `package.json` y `pnpm-lock.yaml` se commitea.
- Las versiones mayores **NO DEBEN** actualizarse sin una spec propia.

## III. Arquitectura y límites

```
apps/
  web/      Astro: landing + blog público (SEO). Solo lectura de datos públicos.
  admin/    Next.js: panel, auth, editor de documento, gestión de usuarios.
packages/
  db/       Clientes Supabase, tipos generados, consultas reutilizables.
  bloques/  Esquema Zod del documento + renderers compartidos.
  ui/       Tokens de diseño (CSS/Tailwind) y primitivas compartidas.
  config/   tsconfig, eslint, prettier compartidos.
supabase/   migrations/, tests/ (pgTAP), seed.sql, config.toml
specs/      Una carpeta por feature (NNN-nombre) generada por Spec Kit.
```

1. Las apps **NO DEBEN** importarse entre sí. Lo que se comparte vive en `packages/*`.
2. El acceso a datos **DEBE** pasar por `packages/db`. Ninguna app crea clientes Supabase sueltos
   ni escribe SQL inline.
3. `apps/web` usa **solo la clave pública (anon)** y lee datos publicados. Toda escritura ocurre en
   `apps/admin` (Server Actions / Route Handlers) o en la base de datos.
4. La `service_role` key **NO DEBE** salir del servidor ni aparecer en el cliente o en `apps/web`.
5. La lógica de dominio (slugs, validación del documento, permisos, programación) **DEBE** escribirse
   como funciones puras en `packages/*`, testeables sin framework.
6. La comunicación entre admin y web se hace por **revalidación ISR on-demand**: al publicar o
   editar, el admin o la base de datos invalidan las páginas afectadas (artículo, listados,
   categoría, etiquetas, sitemap, RSS) mediante un endpoint protegido con secreto. La invalidación
   puede ser por ruta o por tags de caché.

## IV. SEO primero (NO NEGOCIABLE en `apps/web`)

1. Las páginas públicas **DEBEN** servirse como HTML pre-renderizado (estático o ISR). Cuenta como
   ISR el HTML cacheado en el CDN que solo se regenera ante una invalidación on-demand (por ruta o
   por tags). El SSR por request, sin caché, queda restringido a la búsqueda.
2. **JS cero por defecto**: la hidratación de una isla React **DEBE** justificarse en el plan.
3. Toda ruta pública **DEBE** tener `title`, `meta description`, `canonical`, Open Graph y Twitter
   Card. Los artículos **DEBEN** tener además JSON-LD `BlogPosting` y `BreadcrumbList`. La landing
   **DEBE** tener `Organization`/`WebSite`.
4. **DEBEN** existir `sitemap.xml`, `robots.txt` y un feed RSS, que se actualizan con cada publicación.
5. Las URLs son en español, legibles y estables: `/blog/[slug]`, `/blog/categoria/[slug]`,
   `/blog/etiqueta/[slug]`. Cambiar un slug **DEBE** generar una redirección 301.
6. Las imágenes van optimizadas (`astro:assets` o la transformación de Supabase Storage), con
   `alt` obligatorio, dimensiones explícitas y lazy loading debajo del pliegue.
7. Cada página debe tener exactamente un `h1` y una jerarquía de encabezados correcta.
8. **Metas medibles** (Lighthouse en móvil, sobre preview de Vercel): SEO ≥ 95, Performance ≥ 90,
   Accesibilidad ≥ 95. Core Web Vitals: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

## V. Datos y Supabase

1. Todo cambio de esquema **DEBE** hacerse con una migración versionada en `supabase/migrations/`.
   **NO DEBEN** hacerse cambios manuales desde Studio.
2. **RLS activado en todas las tablas**, sin excepción. Cada política **DEBE** tener su test pgTAP.
3. **Nomenclatura**: español, `snake_case`, tablas en plural (`articulos`, `categorias`,
   `etiquetas`, `articulos_etiquetas`, `perfiles`), sin tildes ni ñ (`anio`, `disenio`). Las PK son
   `id uuid` y los timestamps `creado_en` / `actualizado_en` (`timestamptz`) en las tablas de
   entidades. Las tablas puente (`articulos_etiquetas`) y de registro (`redirecciones`) quedan exentas.
4. **Roles**: se guardan en `perfiles.rol` (`admin` | `editor`), ligado a `auth.users`. Las
   políticas leen el rol con una función `security definer` estable.
   - `admin`: CRUD de todo (incluida la eliminación definitiva de artículos) y gestión de usuarios.
   - `editor`: crea, edita, publica, programa y archiva cualquier artículo (no los elimina);
     CRUD de taxonomías; no gestiona usuarios.
   - `anon`: lectura de lo publicado (`estado = 'publicado' and publicado_en <= now()`).
5. Los **estados de un artículo** son `borrador` → `programado` → `publicado` (y `archivado`).
   La programación se resuelve con `pg_cron`, que pasa los artículos a `publicado` y dispara la
   revalidación.
6. La **búsqueda** usa una columna `tsvector` (generada, o mantenida por trigger si incluye
   datos de otras tablas) con la configuración `spanish` y `unaccent`, con índice GIN.
7. Los **tipos TypeScript** se regeneran (`pnpm db:tipos`) con cada migración y se commitean en
   `packages/db`.
8. Toda clave foránea y toda columna que se filtre u ordene **DEBE** tener índice.
9. `seed.sql` **DEBE** dejar un entorno de demo navegable: usuarios demo, categorías y artículos
   de ejemplo.

## VI. Contenido como documento estructurado

1. El contenido de un artículo se guarda en `articulos.contenido` (`jsonb`) como un documento JSON
   de Tiptap/ProseMirror (`{ "type": "doc", "content": [...] }`). **NO DEBE** guardarse HTML.
2. El **único** esquema válido es el esquema Zod de `packages/bloques`: una **lista blanca** de
   nodos, marcas y atributos, con sus límites. Lo que no figure en ella se rechaza.
   - Nodos iniciales: `parrafo`, `titulo` (niveles 2 a 4), lista con viñetas y numerada, `cita`
     (con autor y fuente), `codigo`, `separador`, `imagen`, `galeria`, `cta`, `video` y `tabla`.
   - Marcas iniciales: negrita, cursiva, subrayado, tachado, resaltado, código en línea, enlace,
     superíndice y subíndice.
   - Atributos iniciales: alineación (izquierda, centro, derecha, justificado) en párrafos y títulos.
   - Colores, tipografías y tamaños **NO DEBEN** formar parte del contenido: salen de los tokens (§VII).
3. Ese esquema es la **fuente de verdad compartida**: las extensiones de Tiptap de `admin` y el
   renderer de `web` se derivan de él. **NO DEBEN** existir definiciones paralelas. `web` renderiza
   el JSON con componentes propios, sin `dangerouslySetInnerHTML` y sin interpretar HTML del contenido.
4. El contenido se valida en el servidor antes de guardarse. Un `jsonb` inválido **NO DEBE**
   llegar a la base. La base verifica la forma mínima del documento y deriva de él el texto de
   búsqueda.
5. Para agregar un nodo, una marca o un atributo hay que tocar, en la misma spec, el esquema, la
   extensión del editor, el renderer, la extracción de texto para la búsqueda y de imágenes en uso,
   y los tests.
6. Cambiar el formato del contenido guardado exige una migración de datos con verificación de ida
   y vuelta (que no se pierda nada) y sus tests pgTAP.

## VII. Design system

1. Los tokens (color, tipografía, espaciado, radios, sombras, breakpoints, movimiento) viven en
   `packages/ui` como variables CSS expuestas a Tailwind v4 (`@theme`).
2. **NO DEBEN** usarse valores hardcodeados (hex, px sueltos, fuentes) en componentes. Cualquier
   valor nuevo se agrega primero como token.
3. Las primitivas (botón, input, tarjeta, badge…) se definen una sola vez. `web` y `admin`
   comparten tokens; `admin` usa shadcn/ui tematizado con esos tokens.
4. **Accesibilidad WCAG 2.1 AA**: contraste, foco visible, navegación por teclado, áreas táctiles
   ≥ 44 px, `prefers-reduced-motion` y etiquetas en formularios.
5. El diseño es mobile-first y se verifica en 360, 768, 1024 y 1440 px.
6. Como el cliente es genérico, la identidad (paleta, tipografía, logo) **DEBE** poder cambiarse
   solo editando tokens.

## VIII. No duplicación (NO NEGOCIABLE)

1. Antes de crear un componente, vista, hook, util, consulta o tipo, **DEBE** buscarse si ya
   existe algo equivalente. El `plan.md` **DEBE** incluir la sección **"Reutilización"**, con lo
   que se reutiliza y lo que se crea y por qué.
2. La misma vista no puede existir dos veces. Las variaciones se resuelven con props o
   composición, no con copias.
3. Una lógica usada en dos lugares **DEBE** extraerse a `packages/*`.
4. `jscpd` (umbral ≤ 3 % de duplicación) y `knip` (sin exports ni dependencias muertas)
   **DEBEN** pasar en CI.

## IX. Testing

1. **Test-first** para la lógica de dominio: esquema del documento, slugs, permisos, transiciones de
   estado y programación. Primero se escribe el test que falla y después la implementación.
2. **Vitest**: unidad e integración en `packages/*` y en la lógica de las apps.
3. **Playwright**, para los E2E de los flujos críticos:
   - login, crear un artículo con contenido, publicarlo y verlo en el blog;
   - programar un artículo;
   - filtrar por categoría o etiqueta;
   - buscar;
   - que un editor no pueda gestionar usuarios.
4. **pgTAP** (`supabase test db`): un test por política RLS, por función y por trigger.
5. Cada criterio de aceptación de una spec **DEBE** mapearse a, por lo menos, un test.
6. Para hacer merge, el CI tiene que estar en verde: lint, typecheck, Vitest, pgTAP, Playwright,
   jscpd y knip.

## X. Flujo de trabajo SDD

Toda feature sigue este flujo, sin saltar fases:

| # | Fase | Comando | Artefacto |
|---|---|---|---|
| 1 | Especificar | `/speckit-specify` | `specs/NNN-nombre/spec.md` |
| 2 | Clarificar | `/speckit-clarify` | preguntas resueltas en la spec |
| 3 | Planificar | `/speckit-plan` | `plan.md`, `data-model.md`, `contracts/` |
| 4 | Desglosar | `/speckit-tasks` | `tasks.md` |
| 5 | Analizar | `/speckit-analyze` | consistencia spec ↔ plan ↔ tareas |
| 6 | Tests | agente `escritor-tests` | tests que fallan (rojo) |
| 7 | Implementar | `/speckit-implement` | código (verde) |
| 8 | Validar | `/validar` | `specs/NNN-nombre/validacion.md` |
| 9 | PR | `gh pr create` | preview de Vercel + CI |

- Las specs describen **qué** y **por qué**, sin detalles de implementación. El plan describe el
  **cómo**.
- Si una spec toca la base de datos, en la fase 3 se consulta al agente `arquitecto-db` antes de
  cerrar el `data-model.md`.

## XI. Gates de validación

Una rama solo puede ir a PR cuando los tres agentes revisores emiten **APROBADO** en
`validacion.md`:

| Agente | Verifica |
|---|---|
| `arquitecto-db` | migraciones, normalización, índices, RLS + pgTAP, nomenclatura, advisors de Supabase |
| `revisor-ux-ui` | uso de tokens, accesibilidad AA, responsive, jerarquía, coherencia web/admin, SEO on-page |
| `consistencia-codigo` | duplicación, reutilización, límites de capas, dependencias, convenciones, cobertura de tests |

Un hallazgo **BLOQUEANTE** frena el PR. Un hallazgo **MENOR** puede quedar como tarea nueva
documentada.

## XII. Convenciones

- **Idioma**: todo en español (UI, contenido, código, base de datos, commits, specs). Los
  identificadores van sin tildes ni ñ. Se aceptan los términos técnicos del framework (`props`,
  `slug`, `layout`).
- **Código**: `camelCase` para variables y funciones, `PascalCase` para componentes y tipos,
  `kebab-case` para archivos que no son componentes, `snake_case` en SQL.
- **Commits**: Conventional Commits en español (`feat(blog): agrega listado por categoría`).
- **Ramas**: `NNN-nombre-corto` (las crea Spec Kit). Se hace PR a `main`; `main` siempre es
  desplegable.
- **Secretos**: solo en `.env.local` (ignorado) y en las variables de entorno de Vercel. Se
  commitea `.env.example`.

## Gobernanza

1. Esta constitución está por encima de cualquier otra práctica o guía (`CLAUDE.md`, skills,
   agentes).
2. Para enmendarla hace falta usar `/speckit-constitution` o un PR que modifique este archivo,
   con justificación, impacto sobre las plantillas y el código existente, y un nuevo número de
   versión:
   - **MAYOR**: elimina o redefine un principio.
   - **MENOR**: agrega un principio o una sección.
   - **PARCHE**: aclaraciones de redacción.
3. Las revisiones de PR **DEBEN** verificar el cumplimiento. Toda complejidad adicional se
   justifica en la tabla "Seguimiento de complejidad" del `plan.md`.

**Versión**: 2.0.0 | **Ratificada**: 2026-10-18 | **Última enmienda**: 2026-10-22
