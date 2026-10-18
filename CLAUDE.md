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
