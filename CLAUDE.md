# Blog — guía para Claude

**La ley del proyecto es [constitucion.md](constitucion.md).** Leela antes de cualquier tarea; ante un conflicto, prevalece sobre este archivo. Todo se escribe en español (código, DB, commits, specs). Los identificadores van sin tildes ni ñ.

## Flujo obligatorio (SDD)
`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → agente `escritor-tests` (rojo) → `/speckit-implement` (verde) → `/validar` → PR.
No escribas código de features fuera de este flujo. Cada feature vive en `specs/NNN-nombre/`, en su propia rama.

## Agentes (.claude/agents)
- `arquitecto-db`: migraciones, RLS, índices, pgTAP. Consultalo al cerrar el `data-model.md`.
- `revisor-ux-ui`: tokens, WCAG AA, responsive, SEO on-page.
- `consistencia-codigo`: duplicación, límites entre apps y packages, dependencias, convenciones.
- `escritor-tests`: tests a partir de los criterios de aceptación, antes de implementar.

## Skills clave
`astro-seo` (siempre antes de tocar `apps/web`), `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `turborepo`, `frontend-design`, `web-design-guidelines`, `webapp-testing`.
Next.js 16: antes de escribir código en `apps/admin`, leé las guías de `apps/admin/node_modules/next/dist/docs/` (ver `apps/admin/AGENTS.md`).

## Comandos
| Comando | Qué hace |
|---|---|
| `pnpm db:start` / `db:stop` / `db:reset` | Supabase local (API :56321, DB :56322, Studio :56323, Mailpit :56324) |
| `pnpm db:tipos` | Regenera `packages/db/src/tipos.ts` (después de cada migración) |
| `pnpm dev` | web en :4321 y admin en :3100 (el :3000 lo ocupa libro-visitas) |
| `pnpm build` · `lint` · `typecheck` · `test` | Turborepo sobre todos los workspaces |
| `pnpm test:db` | pgTAP (`supabase/tests/`) |
| `pnpm test:e2e` | Playwright (`e2e/web`, `e2e/admin`) |
| `pnpm calidad` | jscpd (≤ 3 %) + knip |

## Notas del entorno
- Astro 7 pasa `astro dev` a segundo plano cuando detecta un agente. Para tener un servidor en primer plano usá `pnpm --filter web dev --ignore-lock`. Para manejar el que está en segundo plano: `pnpm --filter web astro dev stop|status|logs`.
- Las versiones del stack están fijadas en la constitución, §II. Agregar dependencias requiere justificarlas en el plan.
- La protección `minimumReleaseAge` de pnpm está activa: no agregues exclusiones; elegí una versión anterior.

## Infraestructura en la nube
Sin secretos: las contraseñas de los usuarios demo de la nube y el `SECRETO_REVALIDACION` las guarda el usuario fuera del repo.

| Servicio | Recurso | Notas |
|---|---|---|
| GitHub | `matiaspassarino/blog` (público) | Una rama por spec y PR a `main`. CI en `.github/workflows/ci.yml`. |
| Supabase | proyecto `blog-demo`, ref `kgavzwzlhbzjkvreqhbu`, sa-east-1, org "Sama Desing", plan gratuito | URL `https://kgavzwzlhbzjkvreqhbu.supabase.co`. Tiene el registro público desactivado y el seed cargado con contraseñas aleatorias. |
| Vercel | `blog-web` (root `apps/web`): https://blog-web-navy-gamma.vercel.app | Variables de entorno: `PUBLIC_URL_SITIO`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` y `SECRETO_REVALIDACION` (sensitive). `blog-web.vercel.app` es de otra cuenta. |
| Vercel | `blog-admin` (root `apps/admin`): https://blog-admin-mocha-kappa.vercel.app | Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |

- Los dos proyectos de Vercel están vinculados al repo: cada push genera un preview y `main` va a producción.
- **Historial de migraciones en la nube desalineado**: parte se aplicó con el MCP (versiones generadas) y parte con el SQL Editor (sin registro). Hay que ejecutar `supabase migration repair` antes de usar `supabase db push` por primera vez.
- En el SQL Editor, una migración que agrega un valor a un enum (por ejemplo `20261019120000_tipo_entidad_autor.sql`) se ejecuta **sola**, separada de la siguiente, porque el editor corre todo el texto en una transacción.
- **Vault en la nube, pendiente**: cuando `/api/revalidar` esté en producción (spec 002), crear `url_web_revalidacion` con la URL de producción de `blog-web` y `secreto_revalidacion` con el mismo valor que la variable de Vercel. Sin estos secretos la base no emite avisos, que es lo normal hasta entonces.

## Estado actual (2026-10-19, fin de la sesión)
- **PR #1 mergeado a `main`** (commit `ae6a035`): spec 001 (F1, F2, H1–H3, seed) y **spec 002 completa** (sitio público). Producción: https://blog-web-navy-gamma.vercel.app, con Lighthouse 100 en todo.
- **Spec 002**: `/validar` APROBADO (ronda 2), T099 (preview) y T101 (producción) hechas; detalle en `specs/002-sitio-publico/validacion.md`. En la nube ya están sus migraciones y el Vault (`url_web_revalidacion`, `secreto_revalidacion` rotado el 2026-10-19; el valor lo guarda el usuario).
- **Rama `002-cierre`** (en GitHub, sin PR todavía): registro de T101. Falta, en esa rama:
  - T102: este archivo (hecho);
  - T103: enmienda PARCHE de la constitución (1.0.3) para quitar `@astrojs/sitemap` de la tabla §II (hecho);
  - T104: teléfono con formato en el pie (`contacto.whatsappVisible`);
  - T105: comentario de `20261018120100_perfiles.sql:4` (nombre de la migración de equipo);
  - `atom:link rel="self"` en `/rss.xml` (aviso del validador de W3C);
  - después, PR de cierre a `main`.
- **Spec 001**: H4 (programación), H5 (búsqueda) y H6 (equipo), T067–T072 y los menores C6-M1 a C6-M5 siguen pendientes. Retomar en la rama `001-modelo-de-contenido` rebasada sobre `main`. Leer la nota de T063 sobre la activación de perfiles creados por la API de admin.
- **Pendientes manuales**: borrar la redirección de prueba `diseno-grafico` en la nube (opcional) y revocar en Vercel el *Protection Bypass for Automation* de `blog-web` si no se usa.
- **Notas de Windows**: ver `specs/002-sitio-publico/quickstart.md` ("En Windows"). Desde Git Bash, `vercel curl` necesita `MSYS_NO_PATHCONV=1`; el CLI no crea el bypass del preview cuando corre como agente.

## Retomar en otra PC
```bash
git clone https://github.com/matiaspassarino/blog.git && cd blog
git checkout main   # o la rama en curso (002-cierre, 001-modelo-de-contenido)
corepack enable && pnpm install          # Node 24, pnpm 12
pnpm exec playwright install chromium
pnpm db:start && pnpm db:reset           # Docker + Supabase CLI 2.121
cp .env.example .env.local               # completar las claves con `supabase status`; repetir en apps/web y apps/admin si hace falta
gh auth login && vercel login            # cuenta matiaspassarino
```
- Spec Kit: `uv` instalado y `specify` v1.2.1 (`uvx --from git+https://github.com/github/spec-kit.git@v1.2.1 specify ...`). Las skills `/speckit-*` ya están en `.claude/skills/`.
- Verificar que esté todo en verde: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build`.
