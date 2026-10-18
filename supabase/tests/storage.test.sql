-- T025: bucket medios y políticas de storage.objects (research D15,
-- data-model "Políticas RLS": medios_select y medios_escritura_equipo).
-- No depende del seed: crea sus propios usuarios @prueba.local.
begin;
\ir helpers/pruebas.psql
select plan(21);

select pruebas.crear_usuario('h1-medios-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Medios Editor"}');
select pruebas.crear_usuario('h1-medios-inactivo@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Medios Inactivo"}');
update public.perfiles set activo = false
  where id = (select id from auth.users where email = 'h1-medios-inactivo@prueba.local');

-- storage.protect_delete() impide el delete directo sobre storage.objects salvo
-- con este GUC (la Storage API lo activa). Se activa para probar solo la RLS.
select set_config('storage.allow_delete_query', 'true', true);

-- Otro bucket, para comprobar que las políticas no lo alcanzan.
insert into storage.buckets (id, name, public) values ('h1-otro-bucket', 'h1-otro-bucket', false);

-- Objetos de partida, creados por el sistema (postgres no pasa por la RLS).
insert into storage.objects (bucket_id, name) values
  ('medios', 'pruebas-h1/existente.jpg'),
  ('medios', 'pruebas-h1/para-renombrar.jpg'),
  ('medios', 'pruebas-h1/para-borrar.jpg'),
  ('h1-otro-bucket', 'pruebas-h1/ajeno.jpg');

select results_eq(
  $$select public from storage.buckets where id = 'medios'$$,
  $$values (true)$$,
  'el bucket medios existe y es público'
);

-- ---------------------------------------------------------------------------
-- Visitante (anon)
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg'$$,
  'medios_select: anon puede leer objetos del bucket medios'
);
select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('medios', 'pruebas-h1/anon.jpg')
$$, '42501', null, 'anon no puede subir objetos a medios');
update storage.objects set name = 'pruebas-h1/renombrado-por-anon.jpg'
  where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg';
delete from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/para-borrar.jpg';
select pruebas.como_postgres();
select results_eq(
  $$select count(*)::int from storage.objects
    where bucket_id = 'medios' and name in ('pruebas-h1/existente.jpg', 'pruebas-h1/para-borrar.jpg')$$,
  $$values (2)$$,
  'anon no puede renombrar ni borrar objetos de medios'
);

-- ---------------------------------------------------------------------------
-- Editor activo
-- ---------------------------------------------------------------------------
select pruebas.como('h1-medios-editor@prueba.local');
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg'$$,
  'medios_select: un editor activo puede leer objetos de medios'
);
select lives_ok($$
  insert into storage.objects (bucket_id, name) values ('medios', 'pruebas-h1/subida-por-editor.jpg')
$$, 'medios_escritura_equipo: un editor activo puede subir objetos a medios');
update storage.objects set name = 'pruebas-h1/renombrada.jpg'
  where bucket_id = 'medios' and name = 'pruebas-h1/para-renombrar.jpg';
delete from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/para-borrar.jpg';
select pruebas.como_postgres();
select results_eq(
  $$select name from storage.objects where bucket_id = 'medios' and name like 'pruebas-h1/%' order by name$$,
  $$values ('pruebas-h1/existente.jpg'::text), ('pruebas-h1/renombrada.jpg'), ('pruebas-h1/subida-por-editor.jpg')$$,
  'medios_escritura_equipo: un editor activo puede actualizar y borrar objetos de medios'
);

-- ---------------------------------------------------------------------------
-- Editor desactivado
-- ---------------------------------------------------------------------------
select pruebas.como('h1-medios-inactivo@prueba.local');
select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('medios', 'pruebas-h1/inactivo.jpg')
$$, '42501', null, 'un editor desactivado no puede subir objetos a medios');
update storage.objects set name = 'pruebas-h1/renombrada-por-inactivo.jpg'
  where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg';
select pruebas.como_postgres();
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg'$$,
  'un editor desactivado no puede actualizar objetos de medios'
);
select pruebas.como('h1-medios-inactivo@prueba.local');
delete from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg';
select pruebas.como_postgres();
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg'$$,
  'un editor desactivado no puede borrar objetos de medios'
);

-- ---------------------------------------------------------------------------
-- Ninguna política alcanza otro bucket_id
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select is_empty(
  $$select 1 from storage.objects where bucket_id = 'h1-otro-bucket'$$,
  'anon no ve objetos de otro bucket'
);
select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('h1-otro-bucket', 'pruebas-h1/anon.jpg')
$$, '42501', null, 'anon no puede subir objetos a otro bucket');

select pruebas.como('h1-medios-editor@prueba.local');
select is_empty(
  $$select 1 from storage.objects where bucket_id = 'h1-otro-bucket'$$,
  'un editor activo no ve objetos de otro bucket'
);
select throws_ok($$
  insert into storage.objects (bucket_id, name) values ('h1-otro-bucket', 'pruebas-h1/editor.jpg')
$$, '42501', null, 'un editor activo no puede subir objetos a otro bucket');
select throws_ok($$
  update storage.objects set bucket_id = 'h1-otro-bucket'
  where bucket_id = 'medios' and name = 'pruebas-h1/existente.jpg'
$$, '42501', null, 'un editor activo no puede mover un objeto de medios a otro bucket');
update storage.objects set name = 'pruebas-h1/ajeno-renombrado.jpg'
  where bucket_id = 'h1-otro-bucket' and name = 'pruebas-h1/ajeno.jpg';
delete from storage.objects where bucket_id = 'h1-otro-bucket';
select pruebas.como_postgres();
select results_eq(
  $$select name from storage.objects where bucket_id = 'h1-otro-bucket'$$,
  $$values ('pruebas-h1/ajeno.jpg'::text)$$,
  'un editor activo no puede renombrar ni borrar objetos de otro bucket'
);
select results_eq(
  $$select bucket_id from storage.objects where name = 'pruebas-h1/existente.jpg'$$,
  $$values ('medios'::text)$$,
  'el objeto que se intentó mover sigue en medios'
);

-- ---------------------------------------------------------------------------
-- Las políticas existen con su nombre y sus roles
-- ---------------------------------------------------------------------------
select policy_roles_are('storage', 'objects', 'medios_select', array['anon', 'authenticated'],
  'medios_select aplica a anon y authenticated');
select policy_cmd_is('storage', 'objects', 'medios_select', 'select',
  'medios_select es una política de select');
select is_empty(
  $$select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'medios%' and cmd <> 'SELECT'
      and not (roles = array['authenticated']::name[])$$,
  'las políticas de escritura de medios solo aplican a authenticated'
);
select is_empty(
  $$select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) not like '%medios%'$$,
  'toda política sobre storage.objects está acotada a bucket_id = medios'
);

select pruebas.como_postgres();
select * from finish();
rollback;
