# Plan de implementación: Modelo de contenido del blog

**Rama**: `001-modelo-de-contenido` | **Fecha**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación en `/specs/001-modelo-de-contenido/spec.md`

## Resumen

Esta feature construye la base de datos y las reglas de dominio del blog. Incluye perfiles con roles, artículos compuestos por bloques, una máquina de estados con publicación programada, categorías, etiquetas, redirecciones por cambio de slug, búsqueda en español y la notificación de cambios públicos.

Las reglas viven en Postgres (Supabase) mediante RLS, triggers y checks, de modo que ningún cliente puede saltearlas. El esquema de bloques se define una sola vez, en Zod, en `packages/bloques`. Las consultas tipadas y la traducción de errores viven en `packages/db`. Esta feature no incluye UI.

## Contexto técnico

**Apps / paquetes afectados**: `supabase/` (migraciones, tests y seed), `packages/bloques`, `packages/db`. No toca `apps/web` ni `apps/admin`.

**Dependencias nuevas**: `zod@4.6.x` (en `packages/bloques`) y `@supabase/supabase-js@2.118.x` (en `packages/db`). Ambas están en el stack cerrado (§II); ver research D17.

**Almacenamiento**:
- Tablas `perfiles`, `categorias`, `etiquetas`, `articulos`, `articulos_etiquetas` y `redirecciones`.
- Vista `autores_publicos`.
- Bucket `medios`.
- Extensiones `unaccent`, `pg_cron`, `pg_net` y `supabase_vault`.

**Rutas públicas afectadas**: ninguna directamente. Se define el contrato [revalidacion.md](contracts/revalidacion.md), que consumirá la spec del sitio público.

**Rutas admin afectadas**: ninguna. Las operaciones del equipo quedan expuestas en `@blog/db` para la spec del panel.

**Revalidación**: la emite la base vía `pg_net` (research D14); las rutas las calcula `rutasAfectadas()`.

**Metas de rendimiento**: búsqueda en menos de 1 s con los datos de demo (CE-005); publicación programada en menos de 60 s (CE-003).

## Verificación constitucional

*GATE: se revisó antes de la Fase 0 y se volvió a revisar después del diseño (Fase 1).*

| Principio | Cumple | Nota |
|---|---|---|
| II. Stack cerrado | [x] | Solo zod y supabase-js, ambos del stack |
| III. Límites de arquitectura | [x] | Todo el acceso pasa por `packages/db`; las apps no se tocan |
| IV. SEO primero | [x] | Slugs estables, redirecciones 301, datos para metadatos y sitemap dinámico (D19) |
| V. Datos | [x] | Migraciones versionadas, RLS en todas las tablas, pgTAP por política, nombres en español; `tsvector` mantenido por trigger, permitido desde la enmienda 1.0.1 (§V.6) |
| VI. Bloques | [x] | Esquema Zod único y check liviano en la base, con test anti-deriva (D8) |
| VII. Design system | N/A | Sin UI |
| VIII. No duplicación | [x] | Slugs solo en SQL (D10); `esquemaImagen` compartido por los bloques, la imagen destacada y el avatar |
| IX. Testing | [x] | Cada escenario de aceptación tiene su test (ver Plan de pruebas) |

## Reutilización *(obligatorio, constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Lista de tipos de bloque | `TIPOS_BLOQUE` (antes en `index.ts`) | `packages/bloques/src/tipos-bloque.ts` | Se movió a un módulo propio para evitar imports circulares; `index.ts` lo reexporta y un chequeo de tipos exige que el esquema cubra exactamente esa lista |
| Tipos de dominio (`TipoEntidad`, `EstadoArticulo`, `RolMiembro`) | — | `packages/db/src/tipos-dominio.ts` | Los comparten las consultas de artículos, taxonomías y redirecciones |
| Config ESLint y Prettier | — | `packages/config/{eslint,prettier}.config.js` | La exige §III; la usan los paquetes y `apps/admin` (reglas comunes) |
| Tipos de la base | `packages/db/src/tipos.ts` (generado) | — | Se regenera con `pnpm db:tipos` |
| Esquema de imagen | — | `packages/bloques/src/imagen.ts` | Lo usan los bloques `imagen` y `galeria`, la imagen destacada y el avatar |
| Normalización de slug | — | `privado.slugificar()` (SQL) | No existe; implementación única en la base (D10) |
| Cliente Supabase | — | `packages/db/src/cliente.ts` | No existe; único punto de creación de clientes |
| Traducción de errores | — | `packages/db/src/errores.ts` | No existe |
| Rutas a revalidar | — | `packages/db/src/rutas-afectadas.ts` | La reutilizará el endpoint de `apps/web` |
| Paginación | — | `packages/db/src/paginacion.ts` | Lo comparten listados y búsqueda; no existe |
| Clientes y entorno de tests | — | `packages/db/src/pruebas/{entorno,clientes}.ts` | Lo comparten todos los tests de integración; no existe |
| Test de humo pgTAP | `supabase/tests/00_humo.test.sql` | — | Se conserva |

## Impacto en base de datos *(revisado con el agente arquitecto-db)*

La revisión de diseño del 2026-10-18 dio **CAMBIOS REQUERIDOS**, con 12 bloqueantes. Todos están incorporados en research (D5, D6, D12–D14, D20–D24), data-model y contratos:
- B1: vista escribible por anon
- B2: privilegios por defecto
- B3: registro abierto
- B4: editor desactivado que edita su perfil
- B5: campos del sistema escribibles
- B6: bypass por GUC
- B7: orden de los triggers
- B8: redirecciones que filtran borradores
- B9: índice de FK
- B10: stemming sin tildes
- B11: notificación de autor
- B12: plan sin completar (era transitorio: el plan se escribió en paralelo con la revisión)

También se incorporaron los hallazgos menores. La revisión sobre el código se hace en `/validar`.

**Migraciones** (`supabase/migrations/`; una por historia, en el orden de [tasks.md](tasks.md)):
1. `20261018120000_fundacion.sql` (F2): privilegios por defecto revocados (D20), extensiones (con `net.http_*` revocado), esquema `privado`, enums, `es_cliente`, `slugificar`, `tipos_bloque`, `imagen_valida`, `contenido_valido`, `asignar_slug` y `fijar_actualizado_en`.
2. `20261018120100_perfiles.sql` (F2): `perfiles`, `es_equipo`, `es_admin`, `crear_perfil`, RLS base.
3. `20261018120200_taxonomias.sql` (F2): `categorias`, `etiquetas` y `redirecciones`, con slug y RLS.
4. `20261018120300_articulos.sql` (H1): `articulos`, con los triggers de campos del sistema y de versión, RLS y `previsualizar_slug`.
5. `20261018120310_storage.sql` (H1): bucket `medios` y sus políticas.
6. `20261018120400_estados_y_publicacion.sql` (H2): máquina de estados, redirecciones de artículos, `resolver_redireccion` y `autores_publicos`.
7. `20261018120500_notificacion.sql` (H2): `notificar_cambio_publico` vía `pg_net` + Vault.
8. `20261018120600_etiquetado.sql` (H3): `articulos_etiquetas`, `asignar_etiquetas`, categoría en uso y redirecciones de taxonomías.
9. `20261018120700_programacion.sql` (H4): `publicar_programados` y los jobs de cron.
10. `20261018120800_busqueda.sql` (H5): `es_sin_tildes`, `busqueda`, `bloques_a_texto` y `buscar_articulos`.
11. `20261018120900_equipo.sql` (H6): `perfiles_update_admin`, la ampliación de `proteger_perfil` (`create or replace`; ya existe desde la validación del MVP), `garantizar_admin` y la notificación de autor.

**Otros cambios**:
- **Tablas, índices y políticas**: ver [data-model.md](data-model.md). Cada política tiene su test en `supabase/tests/`.
- **Config**: en `supabase/config.toml`, `enable_signup = false` tanto en `[auth]` como en `[auth.email]` (hoy están en `true`; B3).
- **Seed**: `supabase/seed.sql` con 3 usuarios, 4 categorías, 10 etiquetas y 14 artículos que cubren los 10 tipos de bloque (D18), y los secretos de Vault para el entorno local.

## Impacto en UI y tokens

No aplica: esta feature no tiene interfaz.

## Plan de pruebas

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| Base: alta de perfiles, `es_equipo`/`es_admin`, editor desactivado | pgTAP | `supabase/tests/perfiles_base.test.sql` |
| D20 privilegios por rol (se amplía en cada historia) | pgTAP | `supabase/tests/privilegios.test.sql` |
| RF-005 slugs (normalización, sufijo, nombres sin distinguir mayúsculas) | pgTAP | `supabase/tests/slugs.test.sql` |
| Traducción de errores de dominio | Vitest | `packages/db/src/errores.test.ts` |
| H1-E2 bloques válidos/inválidos con índice y campo (CE-006) | Vitest | `packages/bloques/src/{imagen,esquema,validar,utilidades}.test.ts` |
| H1-E1/E3/E4, RF-008, campos del sistema, defensa de contenido | pgTAP | `supabase/tests/articulos_borrador.test.sql` |
| H1 storage `medios` | pgTAP | `supabase/tests/storage.test.sql` |
| H1 `crearArticulo`/`actualizarArticulo` (siempre con `version`) | Vitest (integración) | `packages/db/src/consultas/equipo-articulos.test.ts` |
| H2-E1/E3/E5, matriz de estados (RF-009/010) | pgTAP | `supabase/tests/articulos_publicacion.test.sql` |
| H2-E4 y D24 redirecciones | pgTAP | `supabase/tests/redirecciones.test.sql` |
| H2-E2 autores públicos, vista no escribible | pgTAP | `supabase/tests/autores_publicos.test.sql` |
| RF-013 notificación | pgTAP | `supabase/tests/notificaciones.test.sql` |
| Contrato de revalidación (rutas) | Vitest | `packages/db/src/rutas-afectadas.test.ts` |
| H2 artículo público con relaciones y SEO de respaldo | Vitest (integración) | `packages/db/src/consultas/articulos-publicos.test.ts` |
| H3-E3/E4, D22, D23, redirecciones de taxonomías | pgTAP | `supabase/tests/taxonomias.test.sql` |
| H3-E1/E2/E5, RF-017, sitemap | Vitest (integración) | `packages/db/src/consultas/listados.test.ts` |
| H3 operaciones de taxonomías | Vitest (integración) | `packages/db/src/consultas/equipo-taxonomias.test.ts` |
| H4-E1 a E4, CE-003 | pgTAP | `supabase/tests/programacion.test.sql` |
| H5-E1 a E4, CE-004 | pgTAP | `supabase/tests/busqueda.test.sql` |
| H5 CE-005 tiempo de respuesta | Vitest (integración) | `packages/db/src/consultas/busqueda.test.ts` |
| H6-E1 a E7, RF-021 a RF-026 | pgTAP | `supabase/tests/equipo.test.sql` |
| H6 operaciones de perfiles | Vitest (integración) | `packages/db/src/consultas/equipo-perfiles.test.ts` |
| RF-028 / CE-007 seed completo | pgTAP | `supabase/tests/seed.test.sql` |
| Invariante `TIPOS_BLOQUE` = base | Vitest (integración) | `packages/db/src/invariantes.test.ts` |

Los tests de integración de `packages/db` corren contra Supabase local. Cuando no está disponible (`SUPABASE_URL` vacío) se saltan con un aviso, y en CI siempre corren.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/001-modelo-de-contenido/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── bloques.md
│   ├── db.md
│   └── revalidacion.md
├── checklists/requirements.md
├── tasks.md          # /speckit-tasks
└── validacion.md     # /validar
```

### Código fuente (afectado por esta feature)

```text
packages/
├── bloques/src/
│   ├── index.ts            # reexporta todo
│   ├── tipos-bloque.ts     # TIPOS_BLOQUE
│   ├── imagen.ts           # esquemaImagen
│   ├── esquema.ts          # esquemaBloque, esquemaContenido
│   ├── validar.ts          # validarContenido → ErrorBloque[]
│   ├── utilidades.ts       # textoPlano, crearBloque
│   └── *.test.ts
└── db/src/
    ├── index.ts
    ├── tipos.ts            # generado
    ├── cliente.ts
    ├── errores.ts
    ├── rutas-afectadas.ts
    ├── paginacion.ts
    ├── consultas/articulos-publicos.ts
    ├── consultas/listados.ts
    ├── consultas/busqueda.ts
    ├── consultas/equipo-articulos.ts
    ├── consultas/equipo-taxonomias.ts
    ├── consultas/equipo-perfiles.ts
    ├── pruebas/{entorno,clientes}.ts   # solo tests
    └── *.test.ts
supabase/
├── config.toml             # enable_signup = false
├── migrations/20261018120{000..900}_*.sql   # 11 migraciones
├── seed.sql
└── tests/*.test.sql
```

**Decisión de estructura**: los dos paquetes ya existen (fundación). Solo se agregan módulos dentro de `src/`; no se crean paquetes nuevos.

## Seguimiento de complejidad

| Excepción | Por qué es necesaria | Alternativa simple descartada porque |
|---|---|---|
| Vista `autores_publicos` sin `security_invoker` | Expone solo columnas públicas de `perfiles` sin dar a anon ningún acceso a la tabla. Lleva `security_barrier`, `revoke all` y un test de no escritura | Los GRANT por columna son frágiles ante columnas nuevas y `select=*` (D5) |
| Lógica de slug solo en SQL | Evita duplicarla entre TS y SQL | Implementarla en TS obligaría a mantener dos versiones idénticas (D10) |
