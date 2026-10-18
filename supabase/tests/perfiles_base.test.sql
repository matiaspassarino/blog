-- T009: perfiles mínimos (research D3, D4; data-model "perfiles").
-- Alta automática desde auth.users, es_equipo()/es_admin(), RLS base de
-- perfiles y bloqueo de edición para miembros desactivados (B4).
begin;
\ir helpers/pruebas.psql
select plan(21);

select pruebas.crear_usuario('ana@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Ana Prueba"}');
select pruebas.crear_usuario('eva@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Eva Editora"}');
select pruebas.crear_usuario('sinrol@prueba.local', '{"provider":"email"}', '{}');
select pruebas.crear_usuario('blanco@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"   "}');
select pruebas.crear_usuario('exadmin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Ex Admin"}');

-- ---------------------------------------------------------------------------
-- Trigger privado.crear_perfil (after insert on auth.users)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select p.rol::text, p.activo from public.perfiles p join auth.users u on u.id = p.id
    where u.email = 'ana@prueba.local'$$,
  $$values ('admin'::text, true)$$,
  'con rol admin en raw_app_meta_data se crea un perfil admin activo'
);
select results_eq(
  $$select p.rol::text, p.activo from public.perfiles p join auth.users u on u.id = p.id
    where u.email = 'sinrol@prueba.local'$$,
  $$values ('editor'::text, false)$$,
  'sin rol en raw_app_meta_data se crea un perfil editor inactivo'
);
select results_eq(
  $$select p.rol::text, p.activo from public.perfiles p join auth.users u on u.id = p.id
    where u.email = 'eva@prueba.local'$$,
  $$values ('editor'::text, true)$$,
  'con rol editor en raw_app_meta_data se crea un perfil editor activo'
);
select is(
  (select p.nombre from public.perfiles p join auth.users u on u.id = p.id where u.email = 'ana@prueba.local'),
  'Ana Prueba',
  'el nombre se toma de raw_user_meta_data->>nombre'
);
select is(
  (select p.nombre from public.perfiles p join auth.users u on u.id = p.id where u.email = 'sinrol@prueba.local'),
  'sinrol',
  'sin nombre en los metadatos, se usa la parte local del email'
);
select is(
  (select p.nombre from public.perfiles p join auth.users u on u.id = p.id where u.email = 'blanco@prueba.local'),
  'blanco',
  'con un nombre en blanco, se usa la parte local del email'
);

-- Un admin desactivado (lo desactiva el sistema, como postgres).
update public.perfiles set activo = false
  where id = (select id from auth.users where email = 'exadmin@prueba.local');

-- ---------------------------------------------------------------------------
-- privado.es_equipo() y privado.es_admin()
-- ---------------------------------------------------------------------------
select pruebas.como('ana@prueba.local');
select is(privado.es_equipo(), true, 'es_equipo() es true para un admin activo');
select is(privado.es_admin(), true, 'es_admin() es true para un admin activo');

select pruebas.como('eva@prueba.local');
select is(privado.es_equipo(), true, 'es_equipo() es true para un editor activo');
select is(privado.es_admin(), false, 'es_admin() es false para un editor activo');

select pruebas.como('sinrol@prueba.local');
select is(privado.es_equipo(), false, 'es_equipo() es false para un miembro inactivo');
select is(privado.es_admin(), false, 'es_admin() es false para un miembro inactivo');

select pruebas.como('exadmin@prueba.local');
select is(privado.es_equipo(), false, 'es_equipo() es false para un admin desactivado');
select is(privado.es_admin(), false, 'es_admin() es false para un admin desactivado');

select pruebas.como_anon();
select is(privado.es_equipo(), false, 'es_equipo() es false para anon');
-- anon no tiene execute sobre es_admin (D20, ver privilegios.test.sql):
-- se evalúa con los claims de anon (sin sub) desde postgres.
select pruebas.como_postgres();
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(privado.es_admin(), false, 'es_admin() es false sin sesión (anon)');

-- ---------------------------------------------------------------------------
-- RLS de perfiles
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select throws_ok($$select * from public.perfiles$$, '42501', null,
  'anon no puede hacer select sobre perfiles');

-- Un miembro activo edita su nombre y su biografía.
select pruebas.como('eva@prueba.local');
update public.perfiles set nombre = 'Eva Renombrada', biografia = 'Escribe sobre diseño.'
  where id = auth.uid();
select results_eq(
  $$select nombre, biografia from public.perfiles where id = auth.uid()$$,
  $$values ('Eva Renombrada'::text, 'Escribe sobre diseño.'::text)$$,
  'un miembro activo edita su nombre y su biografía'
);

-- Un miembro activo no edita el perfil de otro.
update public.perfiles set nombre = 'Pisado por Eva'
  where id = (select p.id from public.perfiles p where p.nombre = 'Ana Prueba');
select pruebas.como_postgres();
select is(
  (select p.nombre from public.perfiles p join auth.users u on u.id = p.id where u.email = 'ana@prueba.local'),
  'Ana Prueba',
  'un miembro activo no edita el perfil de otro'
);

-- Un miembro desactivado no edita ni su propio perfil (B4).
select pruebas.como('sinrol@prueba.local');
update public.perfiles set nombre = 'Intento', biografia = 'Intento' where id = auth.uid();
select pruebas.como_postgres();
select results_eq(
  $$select p.nombre, p.biografia from public.perfiles p join auth.users u on u.id = p.id
    where u.email = 'sinrol@prueba.local'$$,
  $$values ('sinrol'::text, null::text)$$,
  'un miembro desactivado no puede editar su nombre ni su biografía (B4)'
);
select pruebas.como('sinrol@prueba.local');
select is_empty($$select 1 from public.perfiles$$,
  'un miembro desactivado no ve perfiles');

select pruebas.como_postgres();
select * from finish();
rollback;
