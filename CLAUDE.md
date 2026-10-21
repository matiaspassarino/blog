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

## Modelo de datos
Referencia: [specs/001-modelo-de-contenido/data-model.md](specs/001-modelo-de-contenido/data-model.md) (tablas, triggers, funciones y privilegios), con los cambios de la 002 en [specs/002-sitio-publico/data-model.md](specs/002-sitio-publico/data-model.md). Reglas para migraciones nuevas:
- **Una migración por historia**, con timestamp posterior a la última existente; nunca editar una ya aplicada en la nube (salvo comentarios). Después de cada una: `pnpm db:reset && pnpm db:tipos` y commitear `packages/db/src/tipos.ts`.
- **Triggers con prefijo** (Postgres los ejecuta por orden alfabético, research D21): `a05_`–`a90_` para los `before` (`a20_campos_sistema`, `a30_controlar_version`, `a40_validar_estado`, `a50_calcular_busqueda`, `a90_actualizado_en`…) y `z10_`–`z90_` para los `after` (`z90_notificar_*` siempre al final). Sin `update of`: cada función compara `old` con `new`. Para cambiar una función de trigger existente, `create or replace`, no un trigger nuevo.
- **Funciones**: siempre `set search_path = ''` y nombres calificados (`public.`, `privado.`, `extensions.`, `pg_catalog.`). Las internas van en `privado`; `security definer` solo cuando hace falta, y los RPC definer chequean permisos (`privado.es_equipo()`, `privado.es_admin()`).
- **Privilegios explícitos** (research D20): los default están revocados. Cada objeto nuevo lleva su `revoke … from public, anon, authenticated` y el `grant` mínimo de la tabla de privilegios del data-model; `privilegios.test.sql` lo verifica.
- **RLS en todas las tablas**, con un pgTAP por política, función y trigger (constitución §V.2 y §IX.4). Las políticas invocan las auxiliares como `(select privado.es_equipo())`.
- **Recálculos** lanzados desde otro trigger (`pg_trigger_depth() > 1`) no suben `version` ni mueven `actualizado_en`; las cargas masivas en una migración desactivan `a30` y `a90` durante el update.

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
- **Vault en la nube**: cargado (`url_web_revalidacion` con la URL de producción de `blog-web` y `secreto_revalidacion`, igual a la variable de Vercel; rotado el 2026-10-19, el valor lo guarda el usuario).

## Estado actual (2026-10-19, fin de la sesión)
- **`main`** (commit `0c87344`; PR #1 y PR #2 mergeados): spec 001 hasta H3 más el seed, y **spec 002 cerrada** (sitio público; `/validar` ronda 3 APROBADO). Producción: https://blog-web-navy-gamma.vercel.app, con Lighthouse 100. En la nube están las migraciones de la 002 y el Vault.
- **Spec 001, rama `001-modelo-de-contenido`** (2026-10-20): **todas las tareas hechas** y `/validar` ronda 7 APROBADO, con sus 9 menores corregidos. Lista para el PR a `main`.
  - H4 (programación, `20261019120700_programacion.sql`), H5 (búsqueda, `20261019120800_busqueda.sql`) y H6 (equipo, `20261019120900_equipo.sql`), con los tests escritos antes por `escritor-tests`; cierre T065–T072. En local todo en verde: 715 pgTAP, 147 Vitest de `@blog/db`, lint, typecheck, calidad, build y 147 E2E. CE-003 medido en vivo: 36 s.
  - **Decisiones de la sesión**:
    - CE-004 da 84,6 % (22 de 26) y queda como **desviación aceptada** (`validacion.md` y research D12); `pg_trgm` para una spec posterior.
    - `buscar_articulos` devuelve la categoría completa (`categoria_id`, `categoria_nombre`, `categoria_slug`) para mapear a `ResumenArticulo`.
    - `cambiarRol` y `cambiarActivo` traducen 0 filas a `no_encontrado`.
    - `z10_garantizar_admin` también aplica a `postgres`.
  - **Lo que sigue**: PR a `main` y, después del merge, aplicar en la nube las tres migraciones nuevas (`20261019120700`, `…0800` y `…0900`). Antes, `supabase migration repair` (ver "Infraestructura en la nube") y el **checklist de la ronda 7** en `specs/001-modelo-de-contenido/validacion.md`: que haya un admin activo, el dry-run de la carga inicial de `busqueda` y revisar los programados vencidos, que el cron publica apenas se aplica la de H4.
- **Pendientes manuales**: borrar la redirección de prueba `diseno-grafico` en la nube (opcional) y revocar en Vercel el *Protection Bypass for Automation* de `blog-web` si no se usa.
- **Notas de Windows**: ver `specs/002-sitio-publico/quickstart.md` ("En Windows"). Desde Git Bash, `vercel curl` necesita `MSYS_NO_PATHCONV=1`; el CLI no crea el bypass del preview cuando corre como agente.

## Retomar en otra PC
```bash
git clone https://github.com/matiaspassarino/blog.git && cd blog
git checkout 001-modelo-de-contenido     # rama en curso
corepack enable && pnpm install          # Node 24, pnpm 12
pnpm exec playwright install chromium
pnpm db:start && pnpm db:reset           # Docker + Supabase CLI 2.121
cp .env.example .env.local               # completar las claves con `supabase status`; repetir en apps/web y apps/admin si hace falta
gh auth login && vercel login            # cuenta matiaspassarino
```
- Spec Kit: `uv` instalado y `specify` v1.2.1 (`uvx --from git+https://github.com/github/spec-kit.git@v1.2.1 specify ...`). Las skills `/speckit-*` ya están en `.claude/skills/`.
- **Windows** (PC armada el 2026-10-19):
  - Git, gh, Node 24 LTS y uv con `winget`. Si `corepack enable` falla sin admin: `npm i -g pnpm@12.14.0 vercel`. Supabase CLI 2.121 desde el release de GitHub (no está en winget).
  - Docker Desktop necesita WSL y no arranca solo: abrirlo antes de `pnpm db:start`.
  - Si `db:start` falla con "bind: Intento de acceso a un socket no permitido", Windows reservó los puertos 563xx (`netsh interface ipv4 show excludedportrange protocol=tcp`). Como admin: `net stop winnat`, `netsh int ipv4 set dynamic tcp start=57000 num=8536` y `net start winnat`.
  - El build de web crea symlinks: si da EPERM aunque el Modo de desarrollador figure activo, apagarlo, prenderlo y reiniciar la sesión de Windows.
- Verificar que esté todo en verde: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build`.
