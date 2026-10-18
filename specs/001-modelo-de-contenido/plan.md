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
| V. Datos | [x] | Migraciones versionadas, RLS en todas las tablas, pgTAP por política, nombres en español |
| VI. Bloques | [x] | Esquema Zod único y check liviano en la base, con test anti-deriva (D8) |
| VII. Design system | N/A | Sin UI |
| VIII. No duplicación | [x] | Slugs solo en SQL (D10); `esquemaImagen` compartido por los bloques, la imagen destacada y el avatar |
| IX. Testing | [x] | Cada escenario de aceptación tiene su test (ver Plan de pruebas) |

## Reutilización *(obligatorio, constitucion.md §VIII)*

| Necesidad | Existente a reutilizar | Nuevo a crear | Justificación si es nuevo |
|---|---|---|---|
| Lista de tipos de bloque | `packages/bloques/src/index.ts` → `TIPOS_BLOQUE` | — | Se conserva; el esquema se construye sobre esa lista |
| Tipos de la base | `packages/db/src/tipos.ts` (generado) | — | Se regenera con `pnpm db:tipos` |
| Esquema de imagen | — | `packages/bloques/src/imagen.ts` | Lo usan los bloques `imagen` y `galeria`, la imagen destacada y el avatar |
| Normalización de slug | — | `privado.slugificar()` (SQL) | No existe; implementación única en la base (D10) |
| Cliente Supabase | — | `packages/db/src/cliente.ts` | No existe; único punto de creación de clientes |
| Traducción de errores | — | `packages/db/src/errores.ts` | No existe |
| Rutas a revalidar | — | `packages/db/src/rutas-afectadas.ts` | La reutilizará el endpoint de `apps/web` |
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

**Migraciones** (`supabase/migrations/`):
1. `20261018120000_extensiones_y_esquemas.sql`: revoca los privilegios por defecto (D20); crea `unaccent`, `pg_cron` y `pg_net` (y revoca `net.http_*`), el esquema `privado`, la configuración `es_sin_tildes`, los enums y las funciones utilitarias (`es_cliente`, `slugificar`, `tipos_bloque`, `contenido_valido`, `imagen_valida`, `bloques_a_texto`, `actualizado_en`).
2. `20261018120100_perfiles.sql`: crea `perfiles`, `es_equipo()`, `es_admin()`, los triggers `crear_perfil`, `proteger_perfil` y `garantizar_admin`, las políticas RLS y la vista `autores_publicos`.
3. `20261018120200_taxonomias.sql`: crea `categorias`, `etiquetas` y `redirecciones`, con los triggers de slug y redirección, y RLS.
4. `20261018120300_articulos.sql`: crea `articulos` y `articulos_etiquetas`, con los triggers de versión, estado, búsqueda, slug y redirección, los índices y RLS.
5. `20261018120400_busqueda_y_rpc.sql`: crea `buscar_articulos`, `previsualizar_slug`, `resolver_redireccion` y `asignar_etiquetas`.
6. `20261018120500_programacion_y_notificacion.sql`: crea `publicar_programados`, los jobs de cron, `notificar_cambio_publico` y sus triggers (incluido el de autor).
7. `20261018120600_storage.sql`: crea el bucket `medios` y sus políticas.

**Otros cambios**:
- **Tablas, índices y políticas**: ver [data-model.md](data-model.md). Cada política tiene su test en `supabase/tests/`.
- **Config**: en `supabase/config.toml`, `enable_signup = false` tanto en `[auth]` como en `[auth.email]` (hoy están en `true`; B3).
- **Seed**: `supabase/seed.sql` con 3 usuarios, 4 categorías, 10 etiquetas y 14 artículos que cubren los 10 tipos de bloque (D18), y los secretos de Vault para el entorno local.

## Impacto en UI y tokens

No aplica: esta feature no tiene interfaz.

## Plan de pruebas

| Criterio de aceptación (spec) | Tipo | Archivo de test |
|---|---|---|
| H1-E1 guardar borrador con bloques y slug | pgTAP | `supabase/tests/articulos_estados.test.sql` |
| H1-E2 bloque inválido rechazado con índice y campo | Vitest | `packages/bloques/src/esquema.test.ts` |
| H1-E2 (defensa en la base) tipo inexistente | pgTAP | `supabase/tests/articulos_estados.test.sql` |
| H1-E3 borrador invisible para anon | pgTAP | `supabase/tests/articulos_permisos.test.sql` |
| H1-E4 slug único con sufijo | pgTAP | `supabase/tests/slugs_redirecciones.test.sql` |
| H2-E1 publicar registra `publicado_en` y es visible | pgTAP | `supabase/tests/articulos_estados.test.sql` |
| H2-E2 autor público sin email ni rol | pgTAP | `supabase/tests/perfiles.test.sql` |
| H2-E3 archivar oculta | pgTAP | `supabase/tests/articulos_permisos.test.sql` |
| H2-E4 cambio de slug crea la redirección | pgTAP | `supabase/tests/slugs_redirecciones.test.sql` |
| H2-E5 publicar sin categoría se rechaza | pgTAP | `supabase/tests/articulos_estados.test.sql` |
| H3-E1/E2/E5 listados por categoría y etiqueta | Vitest (integración) | `packages/db/src/consultas/publicas.test.ts` |
| H3-E3 categoría en uso | pgTAP + Vitest (`categoria_en_uso`) | `supabase/tests/taxonomias.test.sql`, `packages/db/src/errores.test.ts` |
| H3-E4 borrar etiqueta conserva los artículos | pgTAP | `supabase/tests/taxonomias.test.sql` |
| H4-E1/E3/E4 programar, fecha pasada, cancelar | pgTAP | `supabase/tests/articulos_estados.test.sql` |
| H4-E2 cron publica lo vencido | pgTAP | `supabase/tests/programacion.test.sql` |
| H5-E1 a E4 búsqueda | pgTAP | `supabase/tests/busqueda.test.sql` |
| H6-E1 a E7 equipo y roles | pgTAP | `supabase/tests/perfiles.test.sql`, `supabase/tests/articulos_permisos.test.sql` |
| RF-008 edición concurrente | pgTAP + Vitest (`conflicto_version`) | `supabase/tests/articulos_estados.test.sql`, `packages/db/src/errores.test.ts` |
| RF-013 notificación | pgTAP | `supabase/tests/notificaciones.test.sql` |
| Contrato de revalidación (rutas) | Vitest | `packages/db/src/rutas-afectadas.test.ts` |
| Invariante `TIPOS_BLOQUE` = base | Vitest (integración) | `packages/db/src/invariantes.test.ts` |
| Storage `medios` | pgTAP | `supabase/tests/storage.test.sql` |
| D20 privilegios por rol (tablas, funciones, `net.*`, vista no escribible) | pgTAP | `supabase/tests/privilegios.test.sql` |
| D22 `asignar_etiquetas` atómico + versión | pgTAP | `supabase/tests/taxonomias.test.sql` |
| D24 redirección de borrador invisible para anon | pgTAP | `supabase/tests/slugs_redirecciones.test.sql` |
| `packages/db` envía siempre `version` | Vitest | `packages/db/src/consultas/equipo.test.ts` |
| RF-028 / CE-007 seed completo | pgTAP | `supabase/tests/seed.test.sql` |

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
│   ├── index.ts            # reexporta (TIPOS_BLOQUE ya existe)
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
    ├── consultas/publicas.ts
    ├── consultas/equipo.ts
    └── *.test.ts
supabase/
├── config.toml             # enable_signup = false
├── migrations/2026101812xxxx_*.sql
├── seed.sql
└── tests/*.test.sql
```

**Decisión de estructura**: los dos paquetes ya existen (fundación). Solo se agregan módulos dentro de `src/`; no se crean paquetes nuevos.

## Seguimiento de complejidad

| Excepción | Por qué es necesaria | Alternativa simple descartada porque |
|---|---|---|
| Vista `autores_publicos` sin `security_invoker` | Expone solo columnas públicas de `perfiles` sin dar a anon ningún acceso a la tabla. Lleva `security_barrier`, `revoke all` y un test de no escritura | Los GRANT por columna son frágiles ante columnas nuevas y `select=*` (D5) |
| `busqueda` mantenida por triggers en lugar de columna generada (desvío de §V.6) | Incluye los nombres de la categoría y las etiquetas, que están en otras tablas | Una columna generada no puede leer otras tablas (D12) |
| Lógica de slug solo en SQL | Evita duplicarla entre TS y SQL | Implementarla en TS obligaría a mantener dos versiones idénticas (D10) |
