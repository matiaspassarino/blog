-- T061: gestión del equipo y sus roles (H6-E1 a H6-E6; RF-021 a RF-025).
-- research D2, D3, D4 · data-model "perfiles" · tasks.md T063.
-- Política perfiles_update_admin, proteger_perfil ampliado (el admin cambia rol
-- y activo), trigger z10_garantizar_admin (ultimo_admin, con advisory lock) y el
-- trigger sobre auth.users que activa el perfil cuando el servidor asigna el rol
-- después del alta (auth.admin.createUser guarda app_metadata tras el insert).
--
-- Ya cubiertos en otros archivos (no se repiten acá):
--   - un editor que cambia su propio rol o activo, id o creado_en (perfiles_base);
--   - un miembro edita su nombre y su biografía (perfiles_base, privilegios);
--   - H6-E7, el editor no borra artículos y el admin sí (articulos_borrador);
--   - el aviso tipo autor al cambiar nombre, biografía o foto de un autor con
--     publicados, y que sin publicados no se encola nada (autores_slug, spec 002);
--   - RF-026, datos públicos de autores (autores_publicos).
-- No depende del seed: usuarios @prueba.local con prefijo eq-. Para probar
-- ultimo_admin se desactivan, dentro de la transacción, los demás admins
-- (incluido el admin demo del seed).
begin;
\ir helpers/pruebas.psql
select plan(73);

-- Sin secretos de revalidación: los cambios de este archivo no deben notificar.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('eq-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Eq Admin"}');
select pruebas.crear_usuario('eq-admin2@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Eq Admin Dos"}');
select pruebas.crear_usuario('eq-admin-inactivo@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Eq Admin Inactivo"}');
select pruebas.crear_usuario('eq-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Eq Editor"}');
select pruebas.crear_usuario('eq-editora@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Eq Editora"}');
select pruebas.crear_usuario('eq-otro@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Eq Otro Autor"}');

-- Id de un usuario de prueba.
create function pruebas.id_de(email_usuario text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where u.email = email_usuario
$$;
-- 'rol:activo' de un usuario, leído sin RLS (por ejemplo 'admin:true').
create function pruebas.estado_de(email_usuario text) returns text
language sql stable security definer set search_path = '' as $$
  select p.rol::text || ':' || p.activo::text
  from public.perfiles p join auth.users u on u.id = p.id
  where u.email = email_usuario
$$;
-- Cantidad de admins activos, leída sin RLS.
create function pruebas.admins_activos() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.perfiles where rol = 'admin' and activo
$$;
grant execute on function pruebas.id_de(text), pruebas.estado_de(text), pruebas.admins_activos()
  to anon, authenticated;

delete from public.articulos where slug like 'eq-%';
delete from public.categorias where slug like 'eq-%' or lower(nombre) = lower('Eq Categoría');
insert into public.categorias (nombre, slug) values ('Eq Categoría', 'eq-categoria');

-- Artículos de partida, cargados por el sistema.
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
select x.id::uuid, 'Eq ' || x.sufijo, 'eq-' || x.sufijo,
       '[{"id": "b6000000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Texto del equipo."}]',
       (select id from public.categorias where slug = 'eq-categoria'),
       pruebas.id_de(x.email),
       x.estado::public.estado_articulo, x.publicado_en
from (values
  ('a6000000-0000-4000-8000-000000000001', 'publicado-otro', 'eq-otro@prueba.local', 'publicado', now() - interval '1 day'),
  ('a6000000-0000-4000-8000-000000000002', 'borrador-otro', 'eq-otro@prueba.local', 'borrador', null::timestamptz),
  ('a6000000-0000-4000-8000-000000000003', 'ajeno', 'eq-editor@prueba.local', 'borrador', null)
) as x(id, sufijo, email, estado, publicado_en);

-- ---------------------------------------------------------------------------
-- Estructura (data-model "perfiles", "Políticas RLS"; T063)
-- ---------------------------------------------------------------------------
select policies_are('public', 'perfiles',
  array['perfiles_select_equipo', 'perfiles_update_propio', 'perfiles_update_admin'],
  'RF-023/RF-025: perfiles tiene select del equipo, update propio y update del admin, y ninguna política de delete');
select policy_cmd_is('public', 'perfiles', 'perfiles_update_admin', 'update',
  'perfiles_update_admin es una política de update');
select policy_roles_are('public', 'perfiles', 'perfiles_update_admin', array['authenticated'],
  'perfiles_update_admin aplica a authenticated');
select triggers_are('public', 'perfiles',
  array['a10_asignar_slug', 'a15_slug_inmutable', 'a20_proteger_perfil', 'a90_actualizado_en',
        'z10_garantizar_admin', 'z90_notificar_cambio_autor'],
  'T063: se agrega z10_garantizar_admin y no otro trigger de protección (proteger_perfil se reemplaza)');
select ok(exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.perfiles'::regclass and t.tgname = 'z10_garantizar_admin'
      and (t.tgtype & 1) = 1    -- for each row
      and (t.tgtype & 2) = 0    -- after
      and (t.tgtype & 16) = 16  -- update
      and p.prosecdef
      and p.prosrc like '%pg_advisory_xact_lock(hashtext(''perfiles.ultimo_admin''))%'),
  'D4: z10_garantizar_admin es after update por fila, definer, y toma el advisory lock perfiles.ultimo_admin');
select ok(exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.perfiles'::regclass and t.tgname = 'z10_garantizar_admin'
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')),
  'D20: la función de z10_garantizar_admin no es ejecutable por anon ni authenticated');

-- ---------------------------------------------------------------------------
-- H6-E4 (RF-023): nunca sin un admin activo
-- ---------------------------------------------------------------------------
select pruebas.como_postgres();
-- Admin inactivo de partida (lo desactiva el sistema); después, eq-admin queda
-- como único admin activo (incluido el admin demo del seed).
update public.perfiles set activo = false where id = pruebas.id_de('eq-admin-inactivo@prueba.local');
update public.perfiles set activo = false
  where rol = 'admin' and activo and id <> pruebas.id_de('eq-admin@prueba.local');
select is(pruebas.admins_activos(), 1, 'control: eq-admin es el único admin activo');

select pruebas.como('eq-admin@prueba.local');
select throws_ok($$update public.perfiles set rol = 'editor' where id = auth.uid()$$,
  'P0001', 'ultimo_admin', 'H6-E4: quitarle el rol al único admin activo lanza ultimo_admin');
select throws_ok($$update public.perfiles set activo = false where id = auth.uid()$$,
  'P0001', 'ultimo_admin', 'H6-E4: desactivar al único admin activo lanza ultimo_admin');

-- El trigger es after update sin excepción para el sistema: tampoco postgres deja el sitio sin admin.
select pruebas.como_postgres();
select throws_ok($$update public.perfiles set rol = 'editor' where id = pruebas.id_de('eq-admin@prueba.local')$$,
  'P0001', 'ultimo_admin', 'RF-023: tampoco el sistema (postgres) puede degradar al único admin activo');
-- Si el intento anterior se aplicó (sin z10), se restaura para no arrastrar el error.
update public.perfiles set rol = 'admin', activo = true where id = pruebas.id_de('eq-admin@prueba.local');
select throws_ok($$update public.perfiles set activo = false where rol = 'admin'$$,
  'P0001', 'ultimo_admin', 'RF-023: una sentencia que desactiva a todos los admins lanza ultimo_admin');
update public.perfiles set rol = 'admin', activo = true where id = pruebas.id_de('eq-admin@prueba.local');
select is(pruebas.estado_de('eq-admin@prueba.local'), 'admin:true',
  'H6-E4: el único admin sigue siendo admin activo después de los intentos');

-- Con dos admins activos se puede degradar a uno (RF-023).
select pruebas.como('eq-admin@prueba.local');
select lives_ok($$update public.perfiles set activo = true where id = pruebas.id_de('eq-admin2@prueba.local')$$,
  'RF-023: el admin reactiva a otro admin (sin error)');
select is(pruebas.estado_de('eq-admin2@prueba.local'), 'admin:true',
  'RF-023: el admin reactivó a otro admin');
select lives_ok($$update public.perfiles set rol = 'editor' where id = pruebas.id_de('eq-admin2@prueba.local')$$,
  'RF-023: con dos admins activos, uno degrada al otro (sin error)');
select is(pruebas.estado_de('eq-admin2@prueba.local'), 'editor:true',
  'RF-023: con dos admins activos se puede degradar a uno');
select lives_ok($$update public.perfiles set rol = 'admin' where id = pruebas.id_de('eq-admin2@prueba.local')$$,
  'RF-023: el admin promueve a un editor a admin (sin error)');
select lives_ok($$update public.perfiles set rol = 'editor' where id = auth.uid()$$,
  'RF-023: con otro admin activo, un admin puede quitarse su propio rol (sin error)');
select is(pruebas.estado_de('eq-admin@prueba.local'), 'editor:true',
  'RF-023: con otro admin activo, el admin quedó como editor');

select pruebas.como('eq-admin2@prueba.local');
select throws_ok($$update public.perfiles set activo = false where id = auth.uid()$$,
  'P0001', 'ultimo_admin', 'H6-E4: el nuevo único admin activo tampoco puede desactivarse');

-- Estado conocido para el resto del archivo: eq-admin y eq-admin2, admins activos.
select pruebas.como_postgres();
update public.perfiles set rol = 'admin', activo = true
  where id in (pruebas.id_de('eq-admin@prueba.local'), pruebas.id_de('eq-admin2@prueba.local'));

-- ---------------------------------------------------------------------------
-- RF-023: el admin cambia el rol y el estado de otros miembros (H6-E2)
-- ---------------------------------------------------------------------------
select pruebas.como('eq-admin@prueba.local');
select lives_ok($$update public.perfiles set rol = 'admin' where id = pruebas.id_de('eq-editor@prueba.local')$$,
  'RF-023: el admin cambia el rol de un editor a admin (sin error)');
select is(pruebas.estado_de('eq-editor@prueba.local'), 'admin:true',
  'RF-023: el editor quedó como admin');
select lives_ok($$update public.perfiles set activo = false where id = pruebas.id_de('eq-editor@prueba.local')$$,
  'RF-023: el admin desactiva a un miembro (sin error)');
select is(pruebas.estado_de('eq-editor@prueba.local'), 'admin:false',
  'RF-023: el miembro quedó desactivado');
select lives_ok($$update public.perfiles set rol = 'editor', activo = true where id = pruebas.id_de('eq-editor@prueba.local')$$,
  'RF-023: el admin reactiva y degrada a un miembro en una sola sentencia (sin error)');
select is(pruebas.estado_de('eq-editor@prueba.local'), 'editor:true',
  'RF-023: el miembro quedó como editor activo');

-- D4: el admin edita cualquier perfil, pero id, creado_en y slug siguen protegidos.
select lives_ok($$update public.perfiles set biografia = 'Bio puesta por el admin' where id = pruebas.id_de('eq-editora@prueba.local')$$,
  'D4: el admin edita la biografía de otro miembro (sin error)');
select is((select biografia from public.perfiles where id = pruebas.id_de('eq-editora@prueba.local')),
  'Bio puesta por el admin', 'D4: la edición del admin sobre otro perfil se aplicó');
update public.perfiles set creado_en = '2000-01-01', id = gen_random_uuid()
  where id = pruebas.id_de('eq-editora@prueba.local');
select pruebas.como_postgres();
select isnt_empty(
  $$select 1 from public.perfiles where id = pruebas.id_de('eq-editora@prueba.local') and creado_en <> '2000-01-01'$$,
  'D4: el admin no puede cambiar el id ni el creado_en de otro perfil');
select pruebas.como('eq-admin@prueba.local');
select throws_ok($$update public.perfiles set slug = 'robado-por-admin' where id = pruebas.id_de('eq-editora@prueba.local')$$,
  'P0001', 'sin_permiso', 'el admin no puede cambiar el slug de otro perfil (a15_slug_inmutable)');

-- ---------------------------------------------------------------------------
-- H6-E2 (RF-023): un editor no gestiona el equipo. Sobre filas ajenas no hay
-- política de update para él: la sentencia afecta 0 filas.
-- ---------------------------------------------------------------------------
select pruebas.como('eq-editora@prueba.local');
update public.perfiles set rol = 'admin' where id = pruebas.id_de('eq-editor@prueba.local');
update public.perfiles set activo = false where id = pruebas.id_de('eq-editor@prueba.local');
update public.perfiles set rol = 'editor' where id = pruebas.id_de('eq-admin@prueba.local');
select is(pruebas.estado_de('eq-editor@prueba.local'), 'editor:true',
  'H6-E2: un editor no cambia el rol ni el estado de otro miembro');
select is(pruebas.estado_de('eq-admin@prueba.local'), 'admin:true',
  'H6-E2: un editor no degrada a un admin');

-- Un admin desactivado ya no es admin (es_admin exige activo).
select pruebas.como('eq-admin-inactivo@prueba.local');
select is(privado.es_admin(), false, 'RF-023: un admin desactivado no es admin');
update public.perfiles set rol = 'admin' where id = pruebas.id_de('eq-editora@prueba.local');
update public.perfiles set activo = true where id = auth.uid();
select is(pruebas.estado_de('eq-editora@prueba.local'), 'editor:true',
  'RF-023: un admin desactivado no cambia el rol de otro');
select is(pruebas.estado_de('eq-admin-inactivo@prueba.local'), 'admin:false',
  'RF-023: un admin desactivado no puede reactivarse');

-- ---------------------------------------------------------------------------
-- H6-E3: un miembro desactivado pierde el acceso; sus publicados siguen visibles
-- ---------------------------------------------------------------------------
select pruebas.como('eq-admin@prueba.local');
select lives_ok($$update public.perfiles set activo = false where id = pruebas.id_de('eq-otro@prueba.local')$$,
  'H6-E3: el admin desactiva a un autor con publicados (sin error)');
select is(pruebas.estado_de('eq-otro@prueba.local'), 'editor:false',
  'H6-E3: el autor quedó desactivado');

select pruebas.como('eq-otro@prueba.local');
select is(privado.es_equipo(), false, 'H6-E3: un miembro desactivado no es del equipo (es_equipo() = false)');
select is_empty($$select 1 from public.articulos where slug = 'eq-borrador-otro'$$,
  'H6-E3: un miembro desactivado no lee borradores, ni los propios');
select throws_ok($$insert into public.articulos (titulo) values ('Eq del desactivado')$$,
  '42501', null, 'H6-E3: un miembro desactivado no crea artículos');
update public.articulos set titulo = 'Eq editado por el desactivado',
  version = (select a.version from public.articulos a where a.slug = 'eq-publicado-otro')
  where slug = 'eq-publicado-otro';
select pruebas.como_postgres();
select is((select titulo from public.articulos where slug = 'eq-publicado-otro'), 'Eq publicado-otro',
  'H6-E3: un miembro desactivado no edita ni sus propios artículos');

select pruebas.como_anon();
select isnt_empty($$select 1 from public.articulos where slug = 'eq-publicado-otro'$$,
  'H6-E3: los artículos publicados de un miembro desactivado siguen visibles');
select results_eq(
  $$select nombre from public.autores_publicos where id = pruebas.id_de('eq-otro@prueba.local')$$,
  $$values ('Eq Otro Autor'::text)$$,
  'H6-E3: la autoría del miembro desactivado sigue en autores_publicos');

-- ---------------------------------------------------------------------------
-- H6-E5 (RF-021): un miembro edita su foto
-- ---------------------------------------------------------------------------
select pruebas.como('eq-editora@prueba.local');
select lives_ok(
  $$update public.perfiles set avatar = '{"ruta": "avatares/eq.jpg", "ancho": 96, "alto": 96, "alt": "Foto de Eq"}'
    where id = auth.uid()$$,
  'H6-E5: un miembro guarda su foto (sin error)');
select is((select avatar ->> 'ruta' from public.perfiles where id = auth.uid()), 'avatares/eq.jpg',
  'H6-E5: la foto del miembro se guardó');
select throws_ok(
  $$update public.perfiles set avatar = '{"ruta": "avatares/eq.jpg", "alt": "Sin medidas"}' where id = auth.uid()$$,
  '23514', null, 'RF-021: una foto sin ancho ni alto se rechaza');

-- ---------------------------------------------------------------------------
-- H6-E6 (RF-024): un editor edita, publica y archiva un artículo de otro autor
-- ---------------------------------------------------------------------------
select pruebas.como('eq-editora@prueba.local');
select lives_ok($$
  update public.articulos set titulo = 'Eq ajeno editado',
    version = (select a.version from public.articulos a where a.slug = 'eq-ajeno')
  where slug = 'eq-ajeno'
$$, 'H6-E6: un editor edita un artículo de otro autor (sin error)');
select lives_ok($$
  update public.articulos set estado = 'publicado',
    version = (select a.version from public.articulos a where a.slug = 'eq-ajeno')
  where slug = 'eq-ajeno'
$$, 'H6-E6: un editor publica un artículo de otro autor (sin error)');
select is((select estado::text from public.articulos where slug = 'eq-ajeno'), 'publicado',
  'H6-E6: el artículo de otro autor quedó publicado');
select lives_ok($$
  update public.articulos set estado = 'archivado',
    version = (select a.version from public.articulos a where a.slug = 'eq-ajeno')
  where slug = 'eq-ajeno'
$$, 'H6-E6: un editor archiva un artículo de otro autor (sin error)');
select pruebas.como_postgres();
select results_eq(
  $$select titulo, estado::text, autor_id from public.articulos where slug = 'eq-ajeno'$$,
  $$values ('Eq ajeno editado'::text, 'archivado'::text, pruebas.id_de('eq-editor@prueba.local'))$$,
  'H6-E6: el artículo quedó editado y archivado, y conserva su autor original');

-- ---------------------------------------------------------------------------
-- RF-025: los miembros no se borran (sin grant ni política de delete)
-- ---------------------------------------------------------------------------
select pruebas.como('eq-admin@prueba.local');
select throws_ok($$delete from public.perfiles where id = pruebas.id_de('eq-editora@prueba.local')$$,
  '42501', null, 'RF-025: el admin no puede borrar un perfil');
select pruebas.como('eq-editora@prueba.local');
select throws_ok($$delete from public.perfiles where id = auth.uid()$$,
  '42501', null, 'RF-025: un miembro no puede borrar su propio perfil');
select pruebas.como_postgres();
select isnt_empty($$select 1 from public.perfiles where id = pruebas.id_de('eq-editora@prueba.local')$$,
  'RF-025: el perfil sigue existiendo');

-- ---------------------------------------------------------------------------
-- H6-E1 (RF-022, D3; nota de T063): auth.admin.createUser guarda app_metadata
-- después del insert. Cuando raw_app_meta_data->>'rol' pasa de nulo a un valor,
-- el perfil toma ese rol y queda activo.
-- ---------------------------------------------------------------------------
select pruebas.como_postgres();
select ok(exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal and t.tgname <> 'crear_perfil'
      and (t.tgtype & 1) = 1 and (t.tgtype & 2) = 0 and (t.tgtype & 16) = 16
      and p.prosecdef),
  'T063: existe un trigger after update por fila sobre auth.users, definer, además de crear_perfil');
select ok(not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute'))),
  'D20: ninguna función de trigger sobre auth.users es ejecutable por anon ni authenticated');

-- Como lo hace GoTrue: insert sin rol y, después, update de raw_app_meta_data.
select pruebas.crear_usuario('eq-alta-editor@prueba.local', '{"provider":"email"}', '{"nombre":"Eq Alta Editor"}');
select pruebas.crear_usuario('eq-alta-admin@prueba.local', '{"provider":"email"}', '{"nombre":"Eq Alta Admin"}');
select pruebas.crear_usuario('eq-alta-nulo@prueba.local', '{"provider":"email","rol":null}', '{}');
select is(pruebas.estado_de('eq-alta-editor@prueba.local'), 'editor:false',
  'control: sin rol en el insert, el perfil nace editor inactivo');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"editor"}'
  where email = 'eq-alta-editor@prueba.local';
select is(pruebas.estado_de('eq-alta-editor@prueba.local'), 'editor:true',
  'H6-E1: cuando el servidor asigna rol editor después del alta, el perfil queda editor activo');
select pruebas.como('eq-alta-editor@prueba.local');
select is(privado.es_equipo(), true, 'H6-E1: la persona dada de alta como editor accede como equipo');
select is(privado.es_admin(), false, 'H6-E1: la persona dada de alta como editor no es admin');

select pruebas.como_postgres();
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"admin"}'
  where email = 'eq-alta-admin@prueba.local';
select is(pruebas.estado_de('eq-alta-admin@prueba.local'), 'admin:true',
  'H6-E1: cuando el servidor asigna rol admin después del alta, el perfil queda admin activo');

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"editor"}'
  where email = 'eq-alta-nulo@prueba.local';
select is(pruebas.estado_de('eq-alta-nulo@prueba.local'), 'editor:true',
  'H6-E1: {"rol": null} que pasa a "editor" cuenta como rol asignado (A-M5)');

-- Solo la transición de nulo a un valor: un miembro desactivado no se reactiva
-- con otros cambios de app_metadata (por ejemplo, los providers al iniciar sesión).
update public.perfiles set activo = false where id = pruebas.id_de('eq-alta-editor@prueba.local');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"providers":["email"]}'
  where email = 'eq-alta-editor@prueba.local';
select is(pruebas.estado_de('eq-alta-editor@prueba.local'), 'editor:false',
  'D3: otro cambio de app_metadata no reactiva a un miembro desactivado');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"admin"}'
  where email = 'eq-alta-editor@prueba.local';
select is(pruebas.estado_de('eq-alta-editor@prueba.local'), 'editor:false',
  'D3: cambiar un rol ya asignado en app_metadata no modifica el perfil (solo de nulo a un valor)');

-- Un cliente no puede provocarlo: user_metadata lo edita el usuario, app_metadata no.
select pruebas.crear_usuario('eq-alta-cliente@prueba.local', '{"provider":"email"}', '{}');
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"rol":"admin"}'
  where email = 'eq-alta-cliente@prueba.local';
select is(pruebas.estado_de('eq-alta-cliente@prueba.local'), 'editor:false',
  'D3: un rol en user_metadata (editable por el usuario) no activa el perfil');
select pruebas.como('eq-alta-cliente@prueba.local');
select throws_ok(
  $$update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"admin"}' where id = auth.uid()$$,
  '42501', null, 'RF-022: un usuario autenticado no puede escribir su app_metadata');
select pruebas.como('eq-editora@prueba.local');
select throws_ok(
  $$update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"admin"}'
    where email = 'eq-alta-cliente@prueba.local'$$,
  '42501', null, 'RF-022: un editor no puede escribir el app_metadata de otro usuario');
select pruebas.como_anon();
select throws_ok(
  $$update auth.users set raw_app_meta_data = '{"rol":"admin"}' where email = 'eq-alta-cliente@prueba.local'$$,
  '42501', null, 'RF-022: un visitante no puede escribir app_metadata');
select pruebas.como_postgres();
select is(pruebas.estado_de('eq-alta-cliente@prueba.local'), 'editor:false',
  'RF-022: después de los intentos de los clientes, la cuenta sigue inactiva');

-- ===========================================================================
-- A7-M2: z10 solo actúa cuando un admin activo deja de serlo. Sin ningún admin
-- activo (bootstrap o nube mal cargada), editar perfiles y dar de alta editores
-- por la Admin API tiene que seguir funcionando.
-- ===========================================================================
select pruebas.como_postgres();
alter table public.perfiles disable trigger z10_garantizar_admin;
update public.perfiles set activo = false where rol = 'admin';
alter table public.perfiles enable trigger z10_garantizar_admin;
select is((select count(*)::int from public.perfiles where rol = 'admin' and activo), 0,
  'A7-M2 (preparación): no queda ningún admin activo');
select lives_ok(
  $$update public.perfiles set biografia = 'Bio sin admins' where id = pruebas.id_de('eq-editor@prueba.local')$$,
  'A7-M2: sin admins activos, editar la biografía de un perfil no lanza ultimo_admin');
select pruebas.crear_usuario('eq-alta-sin-admin@prueba.local', '{"provider":"email"}', '{}');
select lives_ok(
  $$update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"editor"}'
    where email = 'eq-alta-sin-admin@prueba.local'$$,
  'A7-M2: sin admins activos, el alta de un editor por la Admin API no falla');
select is(pruebas.estado_de('eq-alta-sin-admin@prueba.local'), 'editor:true',
  'A7-M2: el editor dado de alta sin admins activos queda activo');

select pruebas.como_postgres();
select * from finish();
rollback;
