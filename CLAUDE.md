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
- **Todas las migraciones del repo están aplicadas en la nube** (hasta `20261019120900_equipo.sql` el 2026-10-20 y `20261021120000_panel_admin.sql` el 2026-10-21 con el MCP). **El historial está desalineado**: unas se aplicaron con el MCP (registradas con versiones generadas: `fundacion`, `perfiles`, `taxonomias`, `articulos`, `storage`, `tipo_entidad_autor`, `programacion` y `panel_admin`, esta última como `20261022003557`) y otras con el SQL Editor (sin registro: `estados_y_publicacion`, `notificacion`, `etiquetado`, `autores_publicos`, `busqueda` y `equipo`). Antes del primer `supabase db push` hay que alinearlo con `supabase migration repair` (necesita `supabase login` y `supabase link --project-ref kgavzwzlhbzjkvreqhbu`).
- En la nube hay **otro proyecto de Supabase, "Indy sur"**, en la misma organización: antes de correr SQL en el editor, verificar que la URL tenga `kgavzwzlhbzjkvreqhbu`.
- En el SQL Editor, una migración que agrega un valor a un enum (por ejemplo `20261019120000_tipo_entidad_autor.sql`) se ejecuta **sola**, separada de la siguiente, porque el editor corre todo el texto en una transacción.
- **Vault en la nube**: cargado (`url_web_revalidacion` con la URL de producción de `blog-web` y `secreto_revalidacion`, igual a la variable de Vercel; rotado el 2026-10-19, el valor lo guarda el usuario).

## Estado actual (2026-10-24)
- **Specs 001, 002 y 003 cerradas y en `main`** (PR #1, #2, #3 y #5 mergeados; #3 en el commit `b94af26` y #5 en `556b11c`). Panel en producción: https://blog-admin-mocha-kappa.vercel.app. Producción: https://blog-web-navy-gamma.vercel.app, con Lighthouse 100. En la nube están **todas las migraciones** y el Vault; los jobs de `pg_cron` (`publicar-programados` y `limpiar-historial-cron`) están activos, y los 2 programados del seed se publican solos el 26-10 y el 02-11.
- **Spec 001** (`/validar` ronda 7 APROBADO, con sus 9 menores corregidos):
  - H4 (programación, `20261019120700_programacion.sql`), H5 (búsqueda, `20261019120800_busqueda.sql`) y H6 (equipo, `20261019120900_equipo.sql`), con los tests escritos antes por `escritor-tests`; cierre T065–T072. En local todo en verde: 715 pgTAP, 147 Vitest de `@blog/db`, lint, typecheck, calidad, build y 147 E2E. CE-003 medido en vivo: 36 s.
  - **Decisiones de la sesión**:
    - CE-004 da 84,6 % (22 de 26) y queda como **desviación aceptada** (`validacion.md` y research D12); `pg_trgm` para una spec posterior.
    - `buscar_articulos` devuelve la categoría completa (`categoria_id`, `categoria_nombre`, `categoria_slug`) para mapear a `ResumenArticulo`.
    - `cambiarRol` y `cambiarActivo` traducen 0 filas a `no_encontrado`.
    - `z10_garantizar_admin` también aplica a `postgres`.
  - **Aplicadas en la nube** (2026-10-20) después del checklist de la ronda 7: 1 admin activo, 0 artículos inválidos y ningún programado vencido. La carga inicial de `busqueda` no cambió `version` ni `actualizado_en` y no encoló avisos.
- **Advisors de la nube** (2026-10-20): intencionales la vista definer `autores_publicos` (002) y los RPC definer `asignar_etiquetas` y `previsualizar_slug` (con chequeo de equipo). Pendientes opcionales: activar la protección de contraseñas filtradas de Auth (en el panel) y unir `perfiles_update_propio` con `perfiles_update_admin` (aviso de rendimiento por dos políticas permisivas; inofensivo con pocas filas).
- **Spec 003 `003-panel-admin`** (**cerrada**: PR #5 mergeado el 2026-10-21, T103 y T106 hechas): las 6 historias (acceso, editor de bloques, publicación, lista, categorías y etiquetas, equipo y perfil) y la Fase 9 (T099–T102) están hechas; `/validar` (`specs/003-panel-admin/validacion.md`) dio APROBADO con los tres agentes. Todo en verde en local: lint, typecheck, 1208 Vitest, 786 pgTAP, calidad (jscpd 0,41 %), build y 443 E2E. T103 hecha (CE-001 unos 2 min, Lighthouse 100 en las 16 mediciones, CE-007 con máximo de 311 ms; ver `validacion.md`). Variables de Vercel `blog-admin` cargadas (solo *Production*). Migración aplicada en la nube e ingreso probado en producción. Auth de la nube pospuesto (ver abajo).
  - **Migración nueva**: `20261021120000_panel_admin.sql` (`listar_articulos_panel`, `listar_equipo`, `rutas_en_uso`, `privado.sin_tildes`, índice `articulos_actualizado_idx`, bucket `medios` sin GIF). **Aplicada en la nube el 2026-10-21** con el MCP (registrada como `20261022003557 panel_admin`); los advisors dieron solo los esperables.
  - **Advisors esperables en la nube** (definer intencionales, con chequeo de permisos): `listar_equipo` (admin) y `rutas_en_uso` (equipo).
  - **Regla de `service_role`**: solo existe en `packages/db/src/servicio.ts` (subpath `@blog/db/servicio`) y se crea en `apps/admin/src/lib/servicio.ts`, desde las acciones de `acciones/equipo.ts` tras `conPermiso('equipo.gestionar')`. `limites.test.ts` lo hace cumplir.
  - **Sesión**: vence a las 8 h sin actividad (cookie `blog_actividad`). El proxy no puede redirigir una Server Action: la deja pasar sin renovar la cookie y `obtenerMiembro()` responde `no_autenticado` con `motivo: 'inactividad'`.
  - **Pruebas del panel**: los Vitest de `apps/admin` y `pnpm test` (`--concurrency=1`) corren de a uno porque comparten la base. Los E2E (`pnpm exec playwright test --project=admin --workers=2`) necesitan Supabase local, `pnpm db:reset` previo y los servidores en caliente (`pnpm --filter admin exec next dev -p 3100`, `rm -rf apps/admin/.next` antes; `pnpm --filter web dev --ignore-lock`). No correr `next typegen` con el servidor levantado.
  - **Deuda aceptada**: `publicadosPorTaxonomia` cuenta en memoria (corta en 1000 filas); búsqueda por título secuencial (`pg_trgm` más adelante); mejoras menores de UX en `validacion.md`.
  - **T106 en la nube** (2026-10-21): migración aplicada y variables de Vercel `blog-admin` cargadas (`SUPABASE_SERVICE_ROLE_KEY` sensitive, `NEXT_PUBLIC_URL_ADMIN` y `NEXT_PUBLIC_URL_SITIO`), **solo en *Production***: los previews de `blog-admin` no las tienen.
  - **Auth de la nube sin configurar: pospuesto** junto con el SMTP (decisión del 2026-10-21: el sitio es una demo, no un proyecto final). Quedan sin hacer *Site URL* y *Redirect URLs* (`https://blog-admin-mocha-kappa.vercel.app` y `…/auth/confirmar`), las plantillas de `supabase/templates` (la nube exige un SMTP propio para personalizarlas), *Email OTP expiration* en 86400 s y la contraseña mínima de 8. **Consecuencia**: con la plantilla por defecto el enlace trae `token=` y no `token_hash` (research D7), así que invitar y "olvidé mi contraseña" **no funcionan en producción**. Para dar de alta a alguien o cambiarle la contraseña: Supabase → *Authentication → Users → Add user* (con *Auto Confirm User*). **El perfil nace como editor desactivado** (no trae `app_metadata.rol`): un admin lo activa y le da el rol desde *Equipo* en el panel. En local no afecta (Mailpit y `config.toml`).
- **Spec 004 `004-jerarquia-visual-panel`** (rama `004-jerarquia-visual-panel`, **implementada y validada, PR #7 abierto**): mejora de UX/UI del panel pedida por el usuario ("todo pesa igual", "tamaños desparejos", falta jerarquía). Las 3 historias y el cierre (T001–T060) están hechos; `/validar` (`specs/004-jerarquia-visual-panel/validacion.md`) dio APROBADO con `revisor-ux-ui` y `consistencia-codigo` (`arquitecto-db` no aplica: sin cambios de base). En verde en local: lint, typecheck, Vitest (admin 493, ui 159, bloques 360 y db 261 en serie), 786 pgTAP, calidad (jscpd 0,39 %), build, `jerarquia.spec.ts` 120/120 y Lighthouse Accesibilidad 100 en las 16 mediciones. **Lo que sigue**: mergear el PR #7 y, después, la spec 005.
  - **Decisiones clave**: cuatro niveles de botón (`primaria`, `secundaria`, `terciaria`, `peligro`) y dos tamaños de 44 px; `variante` obligatoria en el `Button` del panel; `clasesBoton` sin opciones devuelve exactamente lo de hoy (el sitio no cambia); barra fija del editor (`role="group"` "Acciones del artículo") con "Guardar" y las acciones de estado en posiciones fijas, principal = "Publicar" solo en un borrador guardado sin cambios (si no, "Guardar"); "Programar" abre un diálogo con fecha (`ConfirmarAccion` con `esperarResultado`); por debajo de **42 rem** de barra (no 48: a 768 px y a 1024 px con la navegación lateral la barra mide ~44 rem), "Más acciones" (disclosure, container query `@2xl`); sin dependencias nuevas (tests interactivos en Playwright, Vitest solo render estático). Componentes nuevos en `apps/admin/src/componentes/estructura/` (`EncabezadoPagina`, `TituloSeccion`, `EstadoVacio`, `BarraAcciones`, `MasAcciones`).
  - **Deuda aceptada**: E2E intermitentes con el build de producción tras crear un artículo (el editor se vuelve a montar en `[id]` y se pierde el mensaje "Guardado"); **también ocurre en `main`**, pasa en `next dev` (ver `validacion.md`). Mejoras menores de UX en `validacion.md`.
  - **Notas de pruebas**: si un proceso de VS Code ocupa `127.0.0.1:56321` (síntoma: el API de Supabase responde `authentication_error` y Kong no registra nada), cerrar y reabrir VS Code; mientras tanto se puede usar `127.0.0.2:56321` en `NEXT_PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_URL` y `SUPABASE_URL`. Los Vitest de `@blog/db` y `apps/admin` se corren con `--no-file-parallelism`.
- **Spec 005 `005-editor-estilo-documento`** (rama `005-editor-estilo-documento`, **implementada, validada y lista para corte en la nube; T151–T158 hechas** bajo la **constitución 2.0.0**). El documento JSON del editor (Tiptap/ProseMirror) pasa a ser lo que se guarda en `articulos.contenido`, validado contra una lista permitida (`contracts/documento.md`), con subrayado, tachado, resaltado, superíndice, subíndice, alineación, tablas estructuradas (celdas combinadas y de múltiples párrafos), atajos y pegado limpio.
  - **Fases 9 a 15 completadas**:
    - Fases 9 a 12: extensiones, esquema, normalizador, migración local `20261023120000_contenido_documento.sql`, script de conversión `convertir-contenido` y marcas de formato.
    - Fase 13 (H7, tablas: T132–T143): extensión `@tiptap/extension-table`, componentes `Tabla`, `Celda`, `EncabezadoCelda`, barra contextual flotante `BarraTabla`, hoja de propiedades de tabla y accesibilidad.
    - Fase 14 (H4, escritura eficiente: T144–T150): atajos Markdown (`#`, `>`, `-`, `1.`, `---`), pegado de HTML/texto limpio con truncamiento a 50 párrafos, límites del documento y comandos de deshacer/rehacer con `prosemirror-history`.
    - Fase 15 (Validación y cierre: T151–T158): cobertura cruzada completa (RF-001 a RF-030 y CE-001 a CE-010), matriz de acciones actualizada, pipeline de calidad al 100% en verde (`pnpm lint`, `pnpm typecheck`, `pnpm test` con 2.301 tests de Vitest, `pnpm test:db` con 868 pgTAP, `pnpm calidad` con jscpd 0,49 % y knip en 0, `pnpm build` de web y admin).
  - **Pruebas E2E**: Web 153/153 pasando (100%), Admin editor 145/145 pasando (100%), Tablas 7/7 pasando (100%), Accesibilidad axe 12/12 pasando (100% en 360, 768, 1024 y 1440 px).
  - **Mediciones (T155)**: peso del editor con tablas de **150,9 KB gzip** (límite ≤ 250 KB gzip sin `yjs` en cliente); latencia de apertura de menú < 200 ms; normalización de 200 elementos < 1 ms. Reporte detallado en `specs/005-editor-estilo-documento/validacion.md`.
  - **Lo que sigue (Corte en la nube)**:
    - **T159**: Corte en la nube coordinado con el usuario sobre Supabase `kgavzwzlhbzjkvreqhbu` (exportar `articulos-nube.json`, correr script `pnpm --filter @blog/bloques convertir-contenido --entrada articulos-nube.json --salida conversion-nube.sql`, pausar `publicar-programados`, ejecutar migración y SQL en una sola transacción en el SQL Editor y comprobar `convalidated`).
    - **T160**: Commit de limpieza final (eliminar scripts y fixtures de conversión anterior).
    - **T161**: Merge del PR a `main`, reactivar `publicar-programados` y verificación de CE-010 en producción.
- **Pendiente aparte**: la página de búsqueda del sitio (`apps/web`) no tiene spec todavía. Antes del primer `supabase db push`, alinear el historial de migraciones (ver "Infraestructura en la nube").
- **Pendientes manuales**: borrar la redirección de prueba `diseno-grafico` en la nube (opcional) y revocar en Vercel el *Protection Bypass for Automation* de `blog-web` si no se usa.
- **Notas de Windows**: ver `specs/002-sitio-publico/quickstart.md` ("En Windows"). Desde Git Bash, `vercel curl` necesita `MSYS_NO_PATHCONV=1`; el CLI no crea el bypass del preview cuando corre como agente.

## Retomar en otra PC
```bash
git clone https://github.com/matiaspassarino/blog.git && cd blog
git checkout main                        # o la rama de la spec en curso
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
