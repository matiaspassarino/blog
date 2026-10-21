# Validación: 003-panel-admin

**Fecha**: 2026-10-21 · **Commit**: 5399dc0 (más las correcciones de esta validación, en el commit siguiente)
**Resultado global**: APROBADO

## Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `pnpm lint` | OK |
| `pnpm typecheck` | OK |
| `pnpm test` (`turbo --concurrency=1`) | OK: ui 60, bloques 360, db 261, web 145, admin 382 |
| `pnpm test:db` (pgTAP) | OK: 786 |
| `pnpm calidad` | OK: jscpd 0,41 % (límite 3 %), knip sin exports ni dependencias muertas |
| `pnpm build` | OK |
| `pnpm test:e2e` | 442 de 443 en la corrida completa; el que falló (`taxonomias`, H5-E1) era una carrera de hidratación del test, corregida (3 de 3 en verde) |
| Test de límites (`packages/db/src/limites.test.ts`) | OK: 16 |
| Búsquedas de T102 | Sin colores ni medidas literales fuera de los tokens; sin `api/revalidar`, `revalidateTag` ni `fetch(` en `apps/admin/src`; sin `@supabase/*` directo; `@blog/db/servicio` solo se importa desde `lib/servicio.ts` |

Notas de la corrida: la suite E2E exige la base en el estado del seed (`pnpm db:reset`); corridas interrumpidas dejaron artículos publicados de más y rompieron `listados`. Los tests de `apps/admin` y `pnpm test` se serializan porque comparten la base local.

## arquitecto-db — APROBADO

Sin bloqueantes. Migración única y aislada, funciones con `search_path` vacío y nombres calificados, privilegios explícitos, `listar_equipo` y `rutas_en_uso` con chequeo de permisos y sin fuga de datos de `auth.users`, cobertura pgTAP por función.

Mejoras:
1. `esCorreoExistente` aceptaba cualquier 422 de GoTrue: **corregido** (solo `email_exists` o "already registered").
2. `publicadosPorTaxonomia` cuenta en memoria y PostgREST corta en 1000 filas: **deuda aceptada**, sin efecto con el volumen actual; pasar a un RPC con `group by` en una spec posterior.
3. `data-model.md` decía `ilike` donde la migración usa `like` sobre `sin_tildes`: **corregido**.
4. `tipos.ts` marca como no nulas columnas que pueden serlo en las RPC nuevas: se compensa con `FilaArticuloPanel`; mantenerlo a mano si cambia la función.
5. Advisors de `listar_equipo` y `rutas_en_uso` (definer intencionales): se registran en `CLAUDE.md` (T105).
6. `count(*) over ()` y filtro por título secuencial: deuda aceptada (M8, `pg_trgm` más adelante).

## revisor-ux-ui — APROBADO

Sin bloqueantes. Lighthouse (Accesibilidad): `/ingreso` 100 y `/olvide-contrasena` 100; las pantallas con sesión las cubre axe (10 pantallas sin violaciones, `e2e/admin/accesibilidad.spec.ts`). Tokens exclusivos, foco visible, movimiento reducido, tuteo sin voseo, tabla responsive, diálogos con foco inicial en "Cancelar", estados de carga, vacío, error y éxito.

Mejoras (no bloquean, sin hacer):
1. Confirmar con `ConfirmarAccion` cuando un admin se baja su propio rol (hoy solo lo avisa el mensaje de éxito).
2. `TablaArticulos`: el `Badge` muestra el estado en minúscula; equipo lo muestra capitalizado.
3. La etiqueta visible "Slug" es jerga: valorar "Dirección en el sitio" (implica ajustar los E2E).
4. `DialogoEdicion`: sin texto de progreso al guardar.
5. Falta un `error.tsx` con "Reintentar".
6. Roles `row` y `cell` explícitos en la variante móvil de la tabla.
7. Landmarks de la barra lateral (`header` con `nav`).

## consistencia-codigo — CAMBIOS REQUERIDOS → corregidos

Sin bloqueantes en el código. Los cinco puntos eran contratos desfasados, ya corregidos:
1. `contracts/acciones.md` y `research.md` D1: las funciones de invitación vienen de `@blog/db/servicio` (a través de `lib/servicio.ts`), no de `@blog/db/servidor`.
2. El cliente de servicio se crea con `crearClienteDeServicio()`.
3. Se documenta el motivo `inactividad` en `no_autenticado`, `urlDeSalida` y el camino de las Server Actions en research D3.
4. La lista de taxonomías es `listarTaxonomiasConConteo` de `@blog/db`, no un archivo de `apps/admin`.
5. Se deja por escrito que `invitarMiembro` rechaza antes cualquier correo existente, y T094 cita `servicio.test.ts`.

Mejoras (sin hacer, menores): la regla ESLint `no-restricted-imports` no prohíbe `@blog/db/servicio` fuera de `componentes/` (lo cubre `limites.test.ts`); `process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''` repetido en tres componentes de imagen; comparar contra `origin/main` antes del PR, porque el `main` local está desactualizado.

## Pendientes de medición (T103) y de la nube (T106)

- [ ] Recorrer el quickstart (A a F) a mano. Los flujos A a F los cubren los 443 E2E, que pasaron en el CI del PR #5; falta el recorrido manual, que se puede hacer junto con CE-001.
- [ ] CE-001: cronometrar con una persona que no haya usado el panel la creación y publicación de un artículo de 5 bloques con una imagen (menos de 5 minutos).
- [x] CE-006: Lighthouse 13.5 (solo Accesibilidad), 2026-10-21, sobre `next start` local con el seed y sesión de admin. `/ingreso`, `/articulos`, el editor (`/articulos/[id]`) y `/equipo` dan **100 en los 16 casos** (360 y 768 px como móvil; 1024 y 1440 px como escritorio).
- [x] CE-007: navegación con el menú, medida dentro de la página (del clic hasta que aparece el `h1` de la pantalla nueva), 7 vueltas tras una de calentamiento, `next start` local, 1440 px. Medianas: Categorías 91 ms, Etiquetas 51 ms, Equipo 57 ms, Mi perfil 57 ms, Artículos 309 ms y el editor unos 100 ms; **máximo 311 ms**. Artículos da siempre unos 300 ms porque React deja visible el esqueleto de `loading.tsx` un mínimo de 300 ms; el servidor la responde en unos 35 ms.
- [x] `X-Robots-Tag: noindex, nofollow` en `/ingreso` y `robots.txt` con `Disallow: /`.
- [ ] T106 (a cargo del usuario, después del merge): ver `quickstart.md`. Variables de Vercel `blog-admin` cargadas el 2026-10-21 (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_URL_ADMIN` y `NEXT_PUBLIC_URL_SITIO`, solo en *Production*). El SMTP propio queda **pospuesto** (sin hosting de correo): en la nube las invitaciones y la recuperación solo llegan a miembros de la organización de Supabase.

## Acciones

- [x] Corregir `esCorreoExistente` y los contratos desfasados.
- [x] Alinear `data-model.md` con la migración.
- [x] `git fetch` y comparar contra `origin/main` antes del PR.
- [x] Registrar los advisors y la regla de `service_role` en `CLAUDE.md` (T105).
