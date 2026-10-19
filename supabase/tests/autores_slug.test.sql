-- T013 (spec 002): slug inmutable de autores (data-model "Migración 2", research D10;
-- RF-011, H4-E7, aclaración del 2026-10-19).
-- perfiles.slug (a10_asignar_slug, a15_slug_inmutable), vista autores_publicos con
-- slug, índice articulos_autor_publicado_idx y z90_notificar_cambio_autor.
-- El slug se lee con to_jsonb(p) ->> 'slug' para que, mientras la columna no
-- exista, cada afirmación falle por separado en lugar de abortar el archivo.
-- No depende del seed: usuarios @prueba.local y slugs propios (prefijo aslug-).
begin;
\ir helpers/pruebas.psql
select plan(35);

-- Sin secretos de revalidación al empezar: la carga de datos no notifica.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('aslug-jose@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"José Núñez"}');
select pruebas.crear_usuario('aslug-ana-1@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Ana Pérez"}');
select pruebas.crear_usuario('aslug-ana-2@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Ana Pérez"}');
select pruebas.crear_usuario('aslug-publica@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Autora Slug Pública"}');
select pruebas.crear_usuario('aslug-sin@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Autor Slug Sin Publicados"}');
select pruebas.crear_usuario('aslug-otro@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Otro Editor Slug"}');
select pruebas.crear_usuario('aslug-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Admin Slug"}');

insert into public.categorias (nombre, slug) values ('Aslug Categoría', 'aslug-categoria');
-- Un publicado de la autora pública y un borrador del autor sin publicados (cargados por el sistema).
insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
select 'Aslug ' || x.sufijo, 'aslug-' || x.sufijo,
       '[{"id": "b0200000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Texto."}]',
       (select id from public.categorias where slug = 'aslug-categoria'),
       (select id from auth.users where email = x.email),
       x.estado::public.estado_articulo, x.publicado_en
from (values
  ('publicado', 'aslug-publica@prueba.local', 'publicado', now() - interval '1 day'),
  ('borrador', 'aslug-sin@prueba.local', 'borrador', null::timestamptz)
) as x(sufijo, email, estado, publicado_en);

-- Slug de un usuario de prueba, leído como postgres (sin RLS). null si la columna no existe.
create function pruebas.slug_de(email_usuario text) returns text
language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) ->> 'slug'
  from public.perfiles p join auth.users u on u.id = p.id
  where u.email = email_usuario
$$;
grant execute on function pruebas.slug_de(text) to anon, authenticated;

-- Id de un usuario de prueba.
create function pruebas.id_de(email_usuario text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where u.email = email_usuario
$$;
grant execute on function pruebas.id_de(text) to anon, authenticated;

-- Ejecuta una sentencia como el rol en curso y devuelve sqlstate, message y
-- detail del error (o nulls si no falla): throws_ok no verifica el detail.
create function pruebas.error_de(sentencia text)
returns table (estado_sql text, mensaje text, detalle text)
language plpgsql as $$
declare
  v_estado text;
  v_mensaje text;
  v_detalle text;
begin
  execute sentencia;
  return query select null::text, null::text, null::text;
exception when others then
  get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text, v_detalle = pg_exception_detail;
  return query select v_estado, v_mensaje, v_detalle;
end
$$;
grant execute on function pruebas.error_de(text) to authenticated;

-- Marca de la cola de pg_net: solo cuentan las filas posteriores a la última marca.
create temporary table marca_cola (id bigint) on commit drop;
insert into marca_cola values (0);

create function pruebas.marcar_cola() returns void
language sql as $$
  update marca_cola set id = coalesce((select max(q.id) from net.http_request_queue q), 0)
$$;
create function pruebas.cola_nueva() returns table (cuerpo jsonb)
language sql as $$
  select convert_from(q.body, 'UTF8')::jsonb
  from net.http_request_queue q
  where q.id > (select m.id from marca_cola m) and q.url like 'http://prueba.local%'
  order by q.id
$$;

-- ---------------------------------------------------------------------------
-- Columna perfiles.slug
-- ---------------------------------------------------------------------------
select has_column('public', 'perfiles', 'slug', 'perfiles tiene la columna slug');
select col_not_null('public', 'perfiles', 'slug', 'perfiles.slug es not null');
select col_default_is('public', 'perfiles', 'slug', ''::text, 'perfiles.slug tiene default vacío');
select ok(exists (
    select 1 from pg_constraint
    where conrelid = 'public.perfiles'::regclass and conname = 'perfiles_slug_key' and contype = 'u'),
  'perfiles.slug es unique (perfiles_slug_key)');
select ok(exists (
    select 1 from pg_constraint
    where conrelid = 'public.perfiles'::regclass and conname = 'perfiles_slug_formato' and contype = 'c'
      and pg_get_constraintdef(oid) like '%^[a-z0-9]+(-[a-z0-9]+)*$%'),
  'perfiles.slug tiene el check perfiles_slug_formato (^[a-z0-9]+(-[a-z0-9]+)*$)');

-- ---------------------------------------------------------------------------
-- a10_asignar_slug: el alta genera el slug desde el nombre (RF-011)
-- ---------------------------------------------------------------------------
select is(pruebas.slug_de('aslug-jose@prueba.local'), 'jose-nunez',
  'RF-011: el insert en auth.users crea el perfil con slug normalizado ("José Núñez" → jose-nunez)');
select is(pruebas.slug_de('aslug-ana-1@prueba.local'), 'ana-perez',
  'RF-011: el primer homónimo recibe ana-perez');
select is(pruebas.slug_de('aslug-ana-2@prueba.local'), 'ana-perez-2',
  'caso borde: el segundo homónimo recibe ana-perez-2');
select is(pruebas.slug_de('aslug-publica@prueba.local'), 'autora-slug-publica',
  'RF-011: el slug de la autora sale de su nombre');

-- ---------------------------------------------------------------------------
-- Índice de artículos por autor (§V.8)
-- ---------------------------------------------------------------------------
select is(
  pg_get_indexdef(to_regclass('public.articulos_autor_publicado_idx')),
  'CREATE INDEX articulos_autor_publicado_idx ON public.articulos USING btree (autor_id, publicado_en DESC)',
  'existe articulos_autor_publicado_idx sobre (autor_id, publicado_en desc)');
select hasnt_index('public', 'articulos', 'articulos_autor_idx',
  'articulos_autor_idx ya no existe (lo reemplaza articulos_autor_publicado_idx)');

-- ---------------------------------------------------------------------------
-- Vista autores_publicos: opciones y slug público
-- ---------------------------------------------------------------------------
select ok(
  coalesce((select reloptions @> array['security_barrier=true', 'security_invoker=false'] from pg_class
            where oid = to_regclass('public.autores_publicos')), false),
  'la vista conserva security_barrier=true y security_invoker=false');

select pruebas.como_anon();
select is(
  (select to_jsonb(v) ->> 'slug' from public.autores_publicos v where v.id = pruebas.id_de('aslug-publica@prueba.local')),
  'autora-slug-publica',
  'RF-011: como anon, autores_publicos expone el slug del autor con publicados');
select is_empty(
  $$select 1 from public.autores_publicos v where v.id = pruebas.id_de('aslug-sin@prueba.local')$$,
  'como anon, no hay fila del autor sin publicados (solo tiene un borrador)');
select is_empty(
  $$select 1 from public.autores_publicos v where v.id = pruebas.id_de('aslug-jose@prueba.local')$$,
  'como anon, no hay fila de un miembro sin artículos');
select pruebas.como_postgres();

-- ---------------------------------------------------------------------------
-- z90_notificar_cambio_autor (H4-E7)
-- ---------------------------------------------------------------------------
select vault.create_secret('http://prueba.local', 'url_web_revalidacion');
select vault.create_secret('secreto-de-prueba-hmac', 'secreto_revalidacion');

-- El propio autor (cliente) cambia su nombre.
select pruebas.marcar_cola();
select pruebas.como('aslug-publica@prueba.local');
update public.perfiles set nombre = 'Autora Slug Renombrada' where id = auth.uid();
select pruebas.como_postgres();
select is((select nombre from public.perfiles where id = pruebas.id_de('aslug-publica@prueba.local')),
  'Autora Slug Renombrada', 'control: el autor cambió su nombre');
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'H4-E7: si un autor con publicados cambia su nombre, se encola un mensaje');
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo ->> 'id', cuerpo -> 'slugs' from pruebas.cola_nueva()$$,
  $$values ('autor'::text, pruebas.id_de('aslug-publica@prueba.local')::text, '["autora-slug-publica"]'::jsonb)$$,
  'H4-E7: el mensaje es tipo autor, con su id y slugs = [slug]');
select is(pruebas.slug_de('aslug-publica@prueba.local'), 'autora-slug-publica',
  'aclaración 2026-10-19: si cambia el nombre, el slug se conserva');

select pruebas.marcar_cola();
select pruebas.como('aslug-sin@prueba.local');
update public.perfiles set nombre = 'Autor Sin Renombrado' where id = auth.uid();
select pruebas.como_postgres();
select is((select nombre from public.perfiles where id = pruebas.id_de('aslug-sin@prueba.local')),
  'Autor Sin Renombrado', 'control: el autor sin publicados cambió su nombre');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'si un autor sin publicados cambia su nombre, no se encola nada');

select pruebas.marcar_cola();
update public.perfiles set rol = 'admin' where id = pruebas.id_de('aslug-publica@prueba.local');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'si solo cambia el rol de un autor con publicados, no se encola nada');

select pruebas.marcar_cola();
update public.perfiles set actualizado_en = now() - interval '1 hour' where id = pruebas.id_de('aslug-publica@prueba.local');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'si solo cambia actualizado_en de un autor con publicados, no se encola nada');

select pruebas.marcar_cola();
update public.perfiles set activo = false where id = pruebas.id_de('aslug-publica@prueba.local');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'si solo cambia activo de un autor con publicados, no se encola nada');

-- Caso borde: un autor desactivado con publicados sigue visible.
select pruebas.como_anon();
select is(
  (select to_jsonb(v) ->> 'slug' from public.autores_publicos v where v.id = pruebas.id_de('aslug-publica@prueba.local')),
  'autora-slug-publica',
  'caso borde: un autor con activo = false y publicados sigue visible, con su slug');
select pruebas.como_postgres();

-- Sin secretos para el resto del archivo.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

-- ---------------------------------------------------------------------------
-- a15_slug_inmutable: ningún cliente cambia el slug
-- ---------------------------------------------------------------------------
select pruebas.como('aslug-jose@prueba.local');
select results_eq(
  $$select * from pruebas.error_de('update public.perfiles set slug = ''jose-otro'' where id = auth.uid()')$$,
  $$values ('P0001'::text, 'sin_permiso'::text, 'slug'::text)$$,
  'aclaración 2026-10-19: el propio dueño (editor) que cambia su slug recibe sin_permiso con detail slug');
select pruebas.como_postgres();
select is(pruebas.slug_de('aslug-jose@prueba.local'), 'jose-nunez',
  'el intento del dueño no cambió el slug');

select pruebas.como('aslug-admin@prueba.local');
select results_eq(
  $$select * from pruebas.error_de('update public.perfiles set slug = ''admin-otro'' where id = auth.uid()')$$,
  $$values ('P0001'::text, 'sin_permiso'::text, 'slug'::text)$$,
  'un admin (cliente) que cambia su slug también recibe sin_permiso con detail slug');

select pruebas.como('aslug-otro@prueba.local');
-- Sin efecto por RLS (solo se edita el perfil propio); error_de evita abortar si la columna aún no existe.
select pruebas.error_de($$update public.perfiles set slug = 'robado' where id = pruebas.id_de('aslug-ana-1@prueba.local')$$);
select pruebas.como_postgres();
select is(pruebas.slug_de('aslug-ana-1@prueba.local'), 'ana-perez',
  'un editor no puede cambiar el slug de otro perfil');

select pruebas.como('aslug-jose@prueba.local');
update public.perfiles set nombre = 'José Núñez Segundo' where id = auth.uid();
select pruebas.como_postgres();
select is((select nombre from public.perfiles where id = pruebas.id_de('aslug-jose@prueba.local')),
  'José Núñez Segundo', 'control: el dueño cambió su nombre');
select is(pruebas.slug_de('aslug-jose@prueba.local'), 'jose-nunez',
  'aclaración 2026-10-19: el cliente cambia su nombre y el slug se conserva');

-- ---------------------------------------------------------------------------
-- postgres (mantenimiento) sí puede cambiar el slug; lo protegen el unique y el check
-- ---------------------------------------------------------------------------
select lives_ok(
  $$update public.perfiles set slug = 'jose-corregido' where id = pruebas.id_de('aslug-jose@prueba.local')$$,
  'postgres puede cambiar el slug (mantenimiento)');
select is(pruebas.slug_de('aslug-jose@prueba.local'), 'jose-corregido',
  'el cambio de postgres quedó guardado');
select throws_ok(
  $$update public.perfiles set slug = 'Con Mayúsculas' where id = pruebas.id_de('aslug-jose@prueba.local')$$,
  '23514', null, 'perfiles_slug_formato rechaza un slug con formato inválido');
select throws_ok(
  $$update public.perfiles set slug = 'ana-perez' where id = pruebas.id_de('aslug-jose@prueba.local')$$,
  '23505', null, 'perfiles_slug_key rechaza un slug repetido');

select pruebas.como_postgres();
select * from finish();
rollback;
