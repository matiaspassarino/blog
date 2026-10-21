# Modelo de datos: Panel de administración

**Rama**: `003-panel-admin` | **Spec**: [spec.md](spec.md) | **Investigación**: [research.md](research.md)

Esta feature **no crea tablas ni cambia columnas**. Las entidades (`articulos`, `categorias`, `etiquetas`, `articulos_etiquetas`, `perfiles`, `redirecciones`) y sus reglas son las de la spec 001 y la 002. Solo agrega **una migración** con funciones de lectura que el panel necesita, un índice y un cambio del bucket de imágenes.

## Migración

`supabase/migrations/20261021120000_panel_admin.sql` (timestamp posterior a `20261019120900_equipo.sql`).

### 1. Bucket `medios` sin GIF
Clarificación 2026-10-21 (RF-007): solo JPEG, PNG, WebP y AVIF.

```sql
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'medios';
```
El límite de 5 MB (`file_size_limit = 5242880`) no cambia. Las políticas de `storage.objects` de la 001 (`medios_select`, `medios_insert_equipo`, `medios_update_equipo`, `medios_delete_equipo`) tampoco: el panel usa las mismas con la sesión del miembro.

### 2. Índice para ordenar la lista del panel (§V.8)
```sql
create index articulos_actualizado_idx on public.articulos (actualizado_en desc, id);
```
La lista se ordena por `actualizado_en desc, id` en todos los estados. Los filtros por `estado`, `categoria_id` y `autor_id` ya tienen índice (001 y 002); con el volumen de una demo el planificador combina el recorrido por este índice con el filtro.

### 3. `privado.sin_tildes(texto)`
No existe un envoltorio de `unaccent` en `privado` (revisión de `arquitecto-db`; `privado.slugificar` no sirve: convierte todo a guiones). Se crea uno mínimo, inmutable:

```sql
create function privado.sin_tildes(texto text) returns text
language sql immutable set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, ''))) $$;

grant execute on function privado.sin_tildes(text) to authenticated;
```
`listar_articulos_panel` es `security invoker`, así que `authenticated` necesita `execute` (los defaults de la fundación lo revocan a todos). `anon` no lo recibe.

### 4. `public.listar_articulos_panel(...)`
Lista del panel (Historia 4, RF-016/RF-017).

```sql
create function public.listar_articulos_panel(
  p_estado public.estado_articulo default null,
  p_categoria_id uuid default null,
  p_autor_id uuid default null,
  p_texto text default null,
  p_limite integer default 20,
  p_desplazamiento integer default 0
) returns table (
  id uuid, titulo text, slug text, estado public.estado_articulo,
  categoria_id uuid, categoria_nombre text,
  autor_id uuid, autor_nombre text,
  programado_para timestamptz, publicado_en timestamptz, actualizado_en timestamptz,
  total bigint
)
```
- `language sql`, `security invoker`, `stable`, `set search_path = ''`: **respeta RLS**. Se escribe en SQL y no en plpgsql: con `returns table` las columnas de salida (`id`, `titulo`, `estado`…) chocarían con las de las tablas dentro de un cuerpo plpgsql ("column reference is ambiguous"). Hoy solo el equipo lee borradores; un anónimo recibe solo lo publicado, y el panel igual exige sesión de equipo (D2).
- `p_texto`: `privado.sin_tildes(a.titulo) ilike '%' || <texto escapado> || '%' escape '\'`. El escape cubre `\`, `%` y `_` (en ese orden), así `100%` o `\` no actúan como comodines ni rompen la consulta.
- `p_limite` se recorta a `[1, 100]` y `p_desplazamiento` a `>= 0`.
- `total` es `count(*) over ()` antes del límite (una sola consulta para la página y el total). Si el desplazamiento supera el total devuelve 0 filas y `total` se pierde: **el panel trata "0 filas con página > 1" como "volver a la página 1"** (se prueba en Playwright).
- `categoria_nombre` y `autor_nombre` salen de `left join` (`categoria_id` es nulo en borradores; el autor desactivado se muestra igual).
- **Excepción registrada a §V.8**: el filtro por título (`ilike '%…%'`) no tiene índice; está justificada en la tabla "Seguimiento de complejidad" de [plan.md](plan.md). Revisión de `arquitecto-db` M8.
- Privilegios (patrón explícito de `busqueda.sql`): `revoke execute on function … from public, anon, authenticated; grant execute on function … to authenticated;`. `anon` no tiene `execute`.
- Los parámetros llevan prefijo `p_` para no colisionar con columnas; las funciones anteriores del repo (`buscar_articulos`, `previsualizar_slug`) no lo usan porque no lo necesitaban. Se mantiene el prefijo en estas tres y queda documentado.

### 5. `public.listar_equipo()`
Lista del equipo con correo y estado de acceso (Historia 6, RF-020).

```sql
create function public.listar_equipo()
returns table (
  id uuid, nombre text, correo text,
  rol public.rol_miembro, activo boolean,
  acceso text,            -- 'invitado' | 'activo' | 'desactivado'
  creado_en timestamptz
)
```
- `plpgsql`, `security definer`, `set search_path = ''`, con `#variable_conflict use_column` al inicio del cuerpo y todas las columnas calificadas con alias (`p.id`, `u.email`). Primera instrucción: `if not privado.es_admin() then raise exception using errcode = 'P0001', message = 'sin_permiso'; end if;` (mismo contrato de errores que el resto: `traducirError` lo convierte en `sin_permiso`).
- `correo` sale de `auth.users.email`; **ningún otro dato de `auth.users` sale de la función** (ni hashes, ni tokens).
- `acceso`:
  - `'desactivado'` si `perfiles.activo = false`;
  - `'invitado'` si `activo` y `auth.users.email_confirmed_at is null`;
  - `'activo'` en cualquier otro caso (incluye los usuarios del seed, que están confirmados).
  - Se usa solo `email_confirmed_at` y no `invited_at`: es más robusto si la cuenta se creó por otra vía. El trigger `activar_perfil` de la T063 deja `perfiles.activo = true` al recibir el rol, por eso un invitado cae en esta rama y no en `desactivado`.
- Orden: `nombre`, `id`.
- Privilegios: `revoke execute … from public, anon, authenticated; grant execute … to authenticated` (el chequeo de admin es interno).
- El cuerpo no contiene la palabra `execute ` ni `net.http_` (ni siquiera en comentarios): `privilegios.test.sql` hace `prosrc ilike '%execute %'` sobre las funciones `definer` expuestas.

### 6. `public.rutas_en_uso(p_rutas text[])`
Qué rutas de imagen siguen siendo usadas (D11, RF-007).

```sql
create function public.rutas_en_uso(p_rutas text[]) returns text[]
```
- `plpgsql`, `security definer`, `stable`, `set search_path = ''`, con `#variable_conflict use_column`. Si `not privado.es_equipo()` lanza `sin_permiso`. `null` o `{}` devuelve `{}`.
- **Formato de `p_rutas`**: la ruta **relativa al bucket**, tal como la guarda `Imagen.ruta` y como la nombra `storage.objects.name` (por ejemplo `articulos/2026/10/<uuid>.webp`), sin prefijo `medios/` ni `/` inicial. Quien llama la normaliza antes (`rutaDeMedio` en `@blog/db`).
- Devuelve las rutas de `p_rutas` que aparecen en `articulos.contenido::text` o `articulos.imagen_destacada::text` o `perfiles.avatar::text`, buscándolas con `position(...)`, no con `like`, **usando la forma escapada de jsonb** (`to_jsonb(ruta)::text`, que ya trae las comillas y escapa `\` y `"`): así los `%` y `_` de un nombre de archivo no son comodines y `a.jpg` no coincide con `a.jpg.bak`.
- Se declara `definer` porque el borrado debe considerar **todo** el contenido, y el equipo ya lee todo; el chequeo `es_equipo()` evita que lo use un anónimo.
- Privilegios: igual que `listar_equipo`. Sin `execute ` ni `net.http_` en el cuerpo.

### 7. Datos de demo (`seed.sql`)
Sin cambios. El seed tiene 1 admin y 2 editores activos; no hay miembro desactivado ni invitado, y `seed.test.sql` fija esos conteos. Para no tocar el seed, los E2E y pgTAP que necesitan un **miembro desactivado** o **invitado** lo crean ellos mismos (con `service_role` en Playwright, dentro de la transacción en pgTAP) y lo limpian al terminar (`afterAll`).

## Lo que el panel ya tiene resuelto en la base (sin cambios)

| Necesidad del panel | Ya existe en | Notas |
|---|---|---|
| Crear/editar con bloqueo optimista | `articulos.version`, `a30`/`a40` (001, H1–H2) | `conflicto_version` |
| Transiciones y requisitos de publicación | trigger `a40` (001, H2) | `estado_invalido`, `requisitos_publicacion`, `fecha_no_futura` |
| Programar y publicar solo | `pg_cron` `publicar-programados` (001, H4) | |
| Slugs automáticos y vista previa del slug | `privado.slugificar`, `public.previsualizar_slug` | |
| Categoría/etiqueta en uso | `categoria_en_uso` (001, H3) | el conteo viaja en `detalle` |
| Conteo de artículos por categoría/etiqueta | embebido de PostgREST `select=*,articulos(count)` | sin función nueva |
| Rol y activación; siempre un admin | `perfiles_update_admin`, `a20`, `z10_garantizar_admin` (001, H6) | `ultimo_admin` |
| Cuenta creada por la Admin API con rol | trigger sobre `auth.users.raw_app_meta_data` (001, T063) | activa el perfil al recibir el rol |
| Avisos al sitio público | `notificar_cambio_publico` y `z90_notificar_cambio_autor` (001/002) | RSEO-003 |
| Escritura de imágenes del equipo | políticas `medios_*_equipo` (001) | |

## Estados y transiciones

Sin cambios respecto de la spec 001 (RF-009). El panel solo ofrece las del estado actual:

| Desde | Acciones que muestra el panel | Hacia |
|---|---|---|
| `borrador` | Publicar · Programar · Archivar | `publicado` · `programado` · `archivado` |
| `programado` | Cancelar programación · Archivar | `borrador` · `archivado` |
| `publicado` | Volver a borrador · Archivar | `borrador` · `archivado` |
| `archivado` | Volver a borrador | `borrador` |
| cualquiera | Eliminar (solo admin, con confirmación) | — |

La matriz vive en `@blog/db` como función pura `transicionesDe(estado): EstadoArticulo[]` (se agrega junto a `permisos.ts` si no existe ya en la 001; lo confirma la búsqueda previa de `consistencia-codigo`). La base la vuelve a validar.

## Entidades del panel (no persistentes)

| Entidad | Forma | Origen |
|---|---|---|
| `MiembroSesion` | `{ id, correo, nombre, rol, activo }` | `getClaims()` + `perfiles` (D2) |
| `FilaArticuloPanel` | las columnas de `listar_articulos_panel` | RPC |
| `FilaEquipo` | las columnas de `listar_equipo` | RPC |
| `MedioRegistrado` | `{ ruta, ancho, alto }` (compatible con `Imagen` sin `alt`) | `registrarMedio` (D9) |
| `ResultadoAccion<T>` | unión `ok` / error con `codigo` y `mensaje` | Server Actions (D5) |

## Pruebas pgTAP (`supabase/tests/panel_admin.test.sql`)

| Objeto | Verifica |
|---|---|
| bucket `medios` | `allowed_mime_types` es exactamente `{jpeg, png, webp, avif}`. **Actualizar `storage.test.sql:145`**, que hoy espera `image/gif` |
| `privado.sin_tildes` | inmutable, `search_path` vacío, `lower` + sin tildes (`Diseño` → `diseno`), `null` → cadena vacía; `authenticated` con `execute`, `anon` sin él |
| `listar_articulos_panel` | anónimo sin `execute`; el miembro desactivado no ve borradores; el editor ve todos los estados; filtros por estado, categoría y autor; combinación de filtros; texto sin tildes ni mayúsculas; los textos `%`, `_`, `100%` y `\` no actúan como comodines ni fallan; límite y desplazamiento; `total` correcto con varias páginas |
| `listar_equipo` | un editor recibe `sin_permiso`; el invitado se crea dentro del test (`email_confirmed_at` nulo); el anónimo no tiene `execute`; el admin recibe correo y `acceso` correctos para activo, desactivado e invitado; ningún campo extra de `auth.users` |
| `rutas_en_uso` | detecta uso en contenido, en imagen destacada y en avatar; no hay falso positivo con `%`, `_` ni prefijos (`a.jpg` vs `a.jpg.bak`) ni falso negativo con comillas o barra invertida en la ruta; `null` y `{}` devuelven `{}`; un anónimo no puede ejecutarla; ruta sin uso devuelve vacío |
| privilegios | `function_privs_are` para las tres funciones y `sin_tildes` (anon sin `execute`; authenticated con `execute`; `PUBLIC` sin él); `prosecdef` = false / true / true. **Actualizar `privilegios.test.sql`**: las tres listas de excepciones del barrido (líneas ~101, 108 y 115) deben incluir `sin_tildes`, y recalcular `plan(132)` |
| índice | `has_index('public', 'articulos', 'articulos_actualizado_idx')` |

## Revisión de `arquitecto-db` (2026-10-21)

Estado: **cambios incorporados**. Resolución de cada hallazgo:

| Hallazgo | Resolución |
|---|---|
| B1 No existe envoltorio de `unaccent` | Se crea `privado.sin_tildes` con `grant execute` a `authenticated` y se actualiza `privilegios.test.sql` (§3) |
| B2 Ambigüedad de columnas en `returns table` | `listar_articulos_panel` en SQL puro; `listar_equipo` y `rutas_en_uso` con `#variable_conflict use_column` y alias (§4–6) |
| B3 El seed no tiene desactivado ni invitado | No se toca el seed: los tests crean y limpian sus cuentas (§7) |
| M1 `invitado` por `invited_at` | Solo `email_confirmed_at is null` (§5) |
| M2 Paginación vacía | El panel vuelve a la página 1 (§4) |
| M3 Escape de comodines | `escape` explícito y escape de `\`, `%`, `_` (§4) |
| M4 Formato de ruta | Relativa al bucket, `to_jsonb` para escapar (§6) |
| M5 Palabra `execute ` en el cuerpo | Prohibida en las funciones `definer` (§5–6) |
| M6 Privilegios explícitos | `revoke …; grant …` en las cuatro funciones; prefijo `p_` documentado (§3–6) |
| M7 Tests a actualizar | `storage.test.sql:145` y `privilegios.test.sql` (tabla de pruebas) |
| M8 Búsqueda secuencial | **Deuda explícita**: `ilike` sobre `sin_tildes(titulo)` recorre la tabla; aceptable hasta unos miles de artículos. `pg_trgm` queda para una spec posterior (ya anotado en la 001) |
| M9 Nomenclatura | Correcta |

Después de la migración: `pnpm db:tipos` (tres RPC nuevas) y sumar `listar_equipo` y `rutas_en_uso` a los advisors "intencionales" en `CLAUDE.md` al cerrar.
