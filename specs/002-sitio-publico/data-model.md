# Modelo de datos: Sitio público

**Spec**: [spec.md](spec.md) · **Investigación**: [research.md](research.md) D10, D11, D14 y D18

Esta spec **no cambia** las reglas de los artículos ni de las taxonomías. Hace tres cosas sobre el modelo de la spec 001 ([data-model 001](../001-modelo-de-contenido/data-model.md)):
1. le agrega un **slug inmutable** a los autores;
2. expone ese slug al público;
3. suma la **notificación de cambios de autor**, adelantada de la H6 de la spec 001.

---

## Migración 1: `20261019120000_tipo_entidad_autor.sql`

```sql
alter type public.tipo_entidad add value if not exists 'autor';
```

- Va sola porque un valor de enum nuevo no se puede usar en la misma transacción en que se crea (research D10).
  - Lo verificó `arquitecto-db`: si se usa en la misma transacción, da `unsafe use of new value "autor"`.
  - El CLI aplica cada archivo como un batch transaccional.
  - **En la nube (SQL Editor) se ejecutan en dos corridas separadas**, porque el editor ejecuta todo el texto en una transacción.
- Efecto colateral aceptado: `redirecciones.tipo_entidad` y `resolver_redireccion` aceptan `'autor'`. Nunca se escriben redirecciones de autor, porque el slug es inmutable, así que la RPC devuelve `null`.

## Migración 2: `20261019120100_autores_publicos.sql`

### `perfiles.slug`

| Columna | Tipo | Reglas |
|---|---|---|
| `slug` | `text not null default ''` | `unique` (`perfiles_slug_key`), `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`. Lo genera `asignar_slug` desde `nombre` al insertar y es inmutable para los clientes. |

Pasos, en orden:
1. `alter table public.perfiles add column slug text;` (nullable mientras dura el backfill).
2. `create or replace function privado.slug_disponible(...)`: misma firma, con la rama `when 'autor' then exists (select 1 from public.perfiles where slug = candidato and id is distinct from excluir)`.
3. `create or replace function privado.asignar_slug()`: agrega `when 'perfiles' then 'autor'` al `case` de `tg_table_name`.
4. **Backfill fila por fila**, envuelto en `alter table public.perfiles disable trigger a90_actualizado_en; … enable trigger a90_actualizado_en;`, para no pisar el `actualizado_en`, que es el lastmod del sitemap. (`do $$ … for r in select id, nombre from public.perfiles order by creado_en, id loop update … set slug = privado.slug_disponible('autor', r.nombre, r.id) …`).
   - El bucle es así: `for r in select id, nombre from public.perfiles order by creado_en, id loop update … set slug = privado.slug_disponible('autor', r.nombre, r.id) …`.
   - No se hace con un `update` de una sola sentencia: dentro de una sentencia, `slug_disponible` no ve los slugs que esa misma sentencia ya asignó. Dos homónimos chocarían en el `unique`.
   - El trigger `a20_proteger_perfil` no interfiere: la migración corre como `postgres`, que no es cliente.
5. `alter column slug set default ''`, `set not null`, `add constraint perfiles_slug_key unique (slug)` y `add constraint perfiles_slug_formato check (...)`.
6. Triggers sobre `perfiles`:

| Trigger | Momento | Función | Comportamiento |
|---|---|---|---|
| `a10_asignar_slug` | `before insert` | `privado.asignar_slug('nombre')` | Genera el slug desde `nombre`, con sufijo `-2`, `-3`… ante homónimos. Se limita a `insert`. |
| `a15_slug_inmutable` | `before update`, `when (new.slug is distinct from old.slug)` | `privado.impedir_cambio_slug()` (invoker, `search_path = ''`) | Si `privado.es_cliente()`, lanza `P0001 sin_permiso` con `detail = 'slug'`. `postgres` y `service_role` pueden corregirlo (mantenimiento). |
| `z90_notificar_cambio_autor` | `after update`, `when ((old.nombre, old.biografia, old.avatar, old.slug) is distinct from (new.nombre, new.biografia, new.avatar, new.slug))` | `privado.notificar_cambio_autor()` (definer, `search_path = ''`) | Si `exists (select 1 from public.articulos where autor_id = new.id and privado.es_publico(estado, publicado_en))`, llama a `privado.notificar_cambio_publico({ tipo: 'autor', id, slugs: privado.slugs_afectados(new.slug, old.slug) })`. |

- El orden alfabético de los prefijos encaja con la convención de la spec 001:
  - `a10` corre antes que `a20_proteger_perfil`;
  - `a15` corre antes que `a20`;
  - `a90_actualizado_en` corre después de los anteriores.
- `crear_perfil` (`after insert on auth.users`) inserta en `perfiles`, y el trigger `a10` completa el slug. No hace falta tocar `crear_perfil`.
- Si `postgres` o `service_role` mandan un slug en el insert, `asignar_slug` lo normaliza. Un cambio de mantenimiento en un update no pasa por `slug_disponible`: lo protegen el `unique` y el check.
- **Mantenimiento** (validación A-obs.): si alguna vez `postgres` o `service_role` corrigen el slug de un autor, hay que insertar también la fila en `redirecciones` (`tipo_entidad = 'autor'`, `slug_anterior`, `entidad_id`): no hay trigger que lo haga, y sin ella la URL vieja da 404 en lugar del 301 que pide §IV.5. `resolver_redireccion` ya acepta `'autor'`.
- **Riesgo aceptado**: dos altas simultáneas con el mismo nombre pueden chocar en `perfiles_slug_key`. Es el mismo riesgo que ya se aceptó para las taxonomías, y las invitaciones son poco frecuentes.
- **Por qué `impedir_cambio_slug` es un trigger propio**: la H6 de la spec 001 va a reemplazar `proteger_perfil` (`create or replace`) para dejar que el admin cambie el rol. Si la inmutabilidad viviera ahí, esa migración la borraría (research D10).

### Vista `public.autores_publicos` (se recrea)

```sql
create or replace view public.autores_publicos with (security_invoker = false, security_barrier = true) as
select p.id, p.nombre, p.biografia, p.avatar, p.slug, p.actualizado_en
from public.perfiles p
where exists (
  select 1 from public.articulos a
  where a.autor_id = p.id and a.estado = 'publicado' and a.publicado_en <= now()
);
```

- `create or replace view` solo permite **agregar columnas al final**: `slug` y `actualizado_en` (el lastmod del sitemap; es un dato inocuo).
- **Es obligatorio repetir `with (security_invoker = false, security_barrier = true)`**. Sin eso, las opciones se resetean y se pierde `security_barrier` (verificado). Los grants sí se conservan.
- Se mantienen los grants (`revoke all` y `grant select` a `anon, authenticated`) y el predicado inline (validación de la spec 001).

### RPC `public.entradas_sitemap()` (`create or replace`, misma firma)

Agrega una rama más a la unión:

```sql
select 'autor', v.slug, greatest(v.actualizado_en, max(a.actualizado_en))
from public.autores_publicos v
join public.articulos a on a.autor_id = v.id and a.estado = 'publicado' and a.publicado_en <= now()
group by v.id, v.slug, v.actualizado_en   -- sobre una vista no hay dependencia funcional por PK
```

La RPC es invoker y `anon` no tiene privilegios sobre `perfiles`. Por eso la rama pasa por la vista definer, nunca por la tabla: lo detectó `arquitecto-db`, que reprodujo `permission denied`. Hacer la RPC definer queda descartado (§III).

Desde el punto de vista del contrato, `tipo` pasa a ser `'articulo' | 'categoria' | 'etiqueta' | 'autor'`.

### Índices

- `perfiles_slug_key`: lo crea el `unique` y cubre el filtro `autores_publicos.slug = $1`.
- Se **reemplaza** `articulos_autor_idx` por `articulos_autor_publicado_idx on public.articulos (autor_id, publicado_en desc)`, sin parcial:
  - sigue cubriendo la FK;
  - sirve a `anon` y a `authenticated`, porque la política de `authenticated` tiene un `or es_equipo()` y no aprovecharía un parcial;
  - es simétrico con `articulos_categoria_publicado_idx` (§V.8).

### Privilegios

- `privado.impedir_cambio_slug()` y `privado.notificar_cambio_autor()` no tienen `execute` para `public`, `anon` ni `authenticated`, y se verifica en `privilegios.test.sql`.
- Las funciones redefinidas (`slug_disponible`, `asignar_slug` y `entradas_sitemap`) conservan sus grants, porque `create or replace` los mantiene.

### Cambios en la spec 001 (se hacen en esta rama)

1. **T063** (`specs/001-modelo-de-contenido/tasks.md`): se quita `z90_notificar_cambio_autor`, que ya existe por la spec 002. Si no, el `create trigger` de la H6 fallaría.
2. Las migraciones pendientes de la 001 (H4–H6) llevan un *timestamp* **posterior a `20261019120100`**, para que `db reset` y `db push` respeten el orden de autoría.
3. `contracts/revalidacion.md` y `contracts/db.md` de la 001: el aviso de `autor` lleva `slugs = [slug del autor]`, y `rutasAfectadas` se reemplaza por `invalidacionesDe` (contracts/cache.md).
4. `data-model.md` de la 001: la nota sobre el mensaje de autor apunta a esta spec.

### Seed

Los 3 usuarios demo reciben su slug por `a10` a partir del `nombre` de `raw_user_meta_data`.

Además (análisis I5, tasks T012) el seed suma datos para las pruebas: un artículo con los 10 tipos de bloque, uno sin imagen destacada con título y extracto al máximo, artículos hasta llegar a 13 o más publicados (para `/blog/pagina/2`), una galería con el mínimo de 2 imágenes y cambios de `slug` de un artículo publicado (dos veces), una categoría y una etiqueta, para que `redirecciones` tenga datos.

En la nube, la migración 2 hace el backfill de los perfiles existentes.

---

## Tipos de dominio (`@blog/db`)

| Tipo | Cambio |
|---|---|
| `AutorPublico` | `{ id, slug, nombre, biografia, avatar }` (agrega `id` y `slug`; `actualizado_en` de la vista no se expone en el tipo) |
| `ReferenciaTaxonomia` | `{ id, nombre, slug }` (agrega `id`, que hace falta para los tags de caché) |
| `ArticuloPublico` | sin cambios de forma; `autor`, `categoria` y `etiquetas` heredan los campos nuevos |
| `ResumenArticulo` | sin cambios (`categoria` hereda `id`) |
| `EntradaSitemap.tipo` | `TipoEntidad` (que ya incluye `'autor'` cuando se regeneran los tipos) |
| `CambioPublico` | se deriva de `esquemaCambioPublico` (Zod, research D4); `tipo` admite `'autor'` |

## Consultas nuevas o modificadas (`@blog/db`)

| Función | Peticiones | Descripción |
|---|---|---|
| `obtenerArticuloPublicado` | 1 | El embebido agrega `id` en `categoria` y `etiquetas`, e `id, slug` en `autor`. |
| `listarPorAutor(c, slug, opciones)` | ≤ 2 | Devuelve `{ autor: AutorPublico; articulos: Pagina<ResumenArticulo> } \| null`. Busca en `autores_publicos` por slug y después llama a `paginaDeArticulos` con el filtro `autorId`. |
| `listarRelacionados(c, { id, categoriaId }, cantidad = 3)` | ≤ 2 | Research D18. |
| `listarParaSitemap` | 1 | Sin cambios de código; incluye autores. |
| `invalidacionesDe(cambio)` | 0 (pura) | Reemplaza a `rutasAfectadas` ([contracts/cache.md](contracts/cache.md)). |
| `leerCambioPublico(json)` | 0 (pura) | Parsea con `esquemaCambioPublico`. Lanza `ErrorDominio('validacion')`. |

## Tests pgTAP (`supabase/tests/autores_slug.test.sql`)

- El insert en `auth.users` genera un perfil con slug normalizado: "José Núñez" da `jose-nunez`.
- Dos homónimos reciben `ana-perez` y `ana-perez-2`.
- Un cliente (`authenticated`, ya sea editor o el propio dueño) que cambia el `slug` recibe `sin_permiso`. Si cambia el `nombre`, el slug se conserva.
- `postgres` sí puede cambiar el slug.
- `autores_publicos` expone `slug` solo para autores con publicados. Como anon, no hay filas de autores sin publicados. Las opciones de la vista conservan `security_barrier`.
- `sitemap.test.sql`, con `pruebas.como_anon()`: `entradas_sitemap()` incluye `{tipo:'autor', slug}` solo de autores con publicados, con `actualizado_en` igual al máximo entre el perfil y sus artículos.
- El backfill no cambia `actualizado_en`.
- Si un autor con publicados cambia su `nombre`, se encola **un** mensaje `tipo = autor` con `slugs = [slug]`. Se prueba con secretos de Vault creados dentro de la transacción, igual que en `notificaciones.test.sql`.
- Si un autor sin publicados cambia el `nombre`, o si alguien cambia solo `rol`, `activo` o `actualizado_en`, no se encola nada.
- **Tests existentes que se actualizan**:
  - `autores_publicos.test.sql:48`: `columns_are` con `slug` y `actualizado_en`, y se ajusta `plan()`;
  - `privilegios.test.sql`: `function_privs_are` explícitos de `impedir_cambio_slug` y `notificar_cambio_autor`, sin execute para los clientes, y `entradas_sitemap` sigue ejecutable por `anon` y `authenticated`;
  - `seed.test.sql`: los 3 perfiles demo tienen slug, con su `plan()` ajustado.
- **Advisors esperables**: solo el `security_definer_view` de `autores_publicos`, que ya estaba aceptado en la 001.
