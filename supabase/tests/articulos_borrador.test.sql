-- T024: artículos en borrador (H1-E1, H1-E3, H1-E4, RF-001, RF-006, RF-008, B5).
-- Tabla public.articulos, triggers a10_asignar_slug, a20_campos_sistema,
-- a30_controlar_version y a90_actualizado_en, check de contenido y RLS de
-- artículos (select, insert, update y delete).
-- No depende del seed: crea sus propios usuarios @prueba.local.
begin;
\ir helpers/pruebas.psql
select plan(45);

select pruebas.crear_usuario('h1-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Uno Editor"}');
select pruebas.crear_usuario('h1-editora@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Uno Editora"}');
select pruebas.crear_usuario('h1-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Uno Admin"}');
select pruebas.crear_usuario('h1-inactivo@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Uno Inactivo"}');
update public.perfiles set activo = false
  where id = (select id from auth.users where email = 'h1-inactivo@prueba.local');

-- Contenido de tres bloques válidos, en un orden conocido.
create function pruebas.contenido_h1() returns jsonb
language sql immutable as $$
  select '[
    {"id": "b1000000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Primer párrafo."},
    {"id": "b1000000-0000-4000-8000-000000000002", "tipo": "titulo", "nivel": 2, "texto": "Un subtítulo"},
    {"id": "b1000000-0000-4000-8000-000000000003", "tipo": "lista", "ordenada": false, "items": ["Uno", "Dos"]}
  ]'::jsonb
$$;
create function pruebas.id_de(email_usuario text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where u.email = email_usuario
$$;
grant execute on function pruebas.contenido_h1(), pruebas.id_de(text) to anon, authenticated;

-- El test no asume que la tabla está vacía: libera los slugs que usa
-- (se deshace con el rollback).
delete from public.articulos where slug ~ '^mi-articulo(-[0-9]+)?$';

-- ---------------------------------------------------------------------------
-- H1-E1: un editor guarda un artículo con título y tres bloques
-- ---------------------------------------------------------------------------
select pruebas.como('h1-editor@prueba.local');
select lives_ok($$
  insert into public.articulos (id, titulo, contenido, autor_id)
  values ('a1000000-0000-4000-8000-000000000001', 'Mi artículo', pruebas.contenido_h1(), auth.uid())
$$, 'H1-E1: un editor guarda un artículo con título y tres bloques válidos');

select results_eq(
  $$select estado::text, slug, version from public.articulos
    where id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values ('borrador'::text, 'mi-articulo'::text, 1)$$,
  'H1-E1: queda en borrador, con el slug derivado del título y version = 1'
);
select is(
  (select contenido from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'),
  pruebas.contenido_h1(),
  'H1-E1: el contenido se guarda tal cual se envió'
);
select results_eq(
  $$select contenido -> 0 ->> 'tipo', contenido -> 1 ->> 'tipo', contenido -> 2 ->> 'tipo'
    from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values ('parrafo'::text, 'titulo'::text, 'lista'::text)$$,
  'H1-E1: los bloques conservan el orden indicado'
);
select results_eq(
  $$select autor_id = auth.uid(), publicado_en is null, programado_para is null
    from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values (true, true, true)$$,
  'H1-E1: el autor es quien lo crea y no tiene fecha de publicación ni de programación'
);

select pruebas.como('h1-editora@prueba.local');
select isnt_empty(
  $$select 1 from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'otro miembro del equipo ve el borrador (articulos_select_equipo)'
);

-- ---------------------------------------------------------------------------
-- H1-E4: un título repetido recibe un slug único con sufijo
-- ---------------------------------------------------------------------------
select pruebas.como('h1-editor@prueba.local');
insert into public.articulos (id, titulo, autor_id)
  values ('a1000000-0000-4000-8000-000000000002', 'Mi artículo', auth.uid());
select is(
  (select slug from public.articulos where id = 'a1000000-0000-4000-8000-000000000002'),
  'mi-articulo-2',
  'H1-E4: un segundo artículo con el mismo título recibe el slug mi-articulo-2'
);

insert into public.articulos (id, titulo, slug, autor_id)
  values ('a1000000-0000-4000-8000-000000000003', 'Con slug propio', '  H1 Slug Informado Ñandú!  ', auth.uid());
select is(
  (select slug from public.articulos where id = 'a1000000-0000-4000-8000-000000000003'),
  'h1-slug-informado-nandu',
  'RF-005: un slug informado se normaliza'
);

-- ---------------------------------------------------------------------------
-- H1-E3: el visitante no ve borradores
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select is_empty(
  $$select 1 from public.articulos where slug = 'mi-articulo'$$,
  'H1-E3: un visitante que busca el borrador por su slug no lo obtiene'
);
select is_empty(
  $$select 1 from public.articulos where id in ('a1000000-0000-4000-8000-000000000001',
                                                'a1000000-0000-4000-8000-000000000002')$$,
  'H1-E3: un visitante no ve ningún borrador por id'
);

-- ---------------------------------------------------------------------------
-- articulos_insert_equipo: el autor es siempre quien crea
-- ---------------------------------------------------------------------------
select pruebas.como('h1-editor@prueba.local');
select throws_ok($$
  insert into public.articulos (titulo, autor_id)
  values ('Artículo a nombre de otra', pruebas.id_de('h1-editora@prueba.local'))
$$, '42501', null, 'un insert con autor_id ajeno se rechaza');

-- ---------------------------------------------------------------------------
-- B5: campos del sistema en el insert (a20_campos_sistema)
-- ---------------------------------------------------------------------------
insert into public.articulos (id, titulo, contenido, autor_id, estado, publicado_en, version, creado_en)
  values ('a1000000-0000-4000-8000-000000000004', 'Intento de saltear el flujo', pruebas.contenido_h1(),
          auth.uid(), 'publicado', '2020-01-01 10:00+00', 99, '2000-01-01 00:00+00');
select results_eq(
  $$select estado::text, publicado_en is null, version, creado_en = now()
    from public.articulos where id = 'a1000000-0000-4000-8000-000000000004'$$,
  $$values ('borrador'::text, true, 1, true)$$,
  'B5: si el editor envía publicado_en, version = 99, estado = publicado y creado_en, se fuerzan null, 1, borrador y now()'
);
select pruebas.como_anon();
select is_empty(
  $$select 1 from public.articulos where id = 'a1000000-0000-4000-8000-000000000004'$$,
  'B5: el artículo que intentó publicarse en el insert sigue oculto para el visitante'
);

-- ---------------------------------------------------------------------------
-- B5: campos del sistema en el update y control de versión (RF-008)
-- Otra editora edita el artículo e intenta quedarse con la autoría.
-- ---------------------------------------------------------------------------
select pruebas.como('h1-editora@prueba.local');
update public.articulos
  set extracto = 'Extracto editado por otra editora',
      autor_id = auth.uid(),
      publicado_en = '2020-01-01 10:00+00',
      creado_en = '2000-01-01 00:00+00',
      version = 1
  where id = 'a1000000-0000-4000-8000-000000000001';
select results_eq(
  $$select extracto, autor_id = pruebas.id_de('h1-editor@prueba.local'), publicado_en is null, creado_en = now()
    from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values ('Extracto editado por otra editora'::text, true, true, true)$$,
  'B5: el update de otra editora se guarda, pero se conservan autor_id, publicado_en y creado_en'
);
select is(
  (select version from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'),
  2,
  'RF-008: un update con la versión correcta incrementa la versión'
);

-- a90_actualizado_en: se lleva actualizado_en al pasado como postgres, sin el trigger.
select pruebas.como_postgres();
alter table public.articulos disable trigger a90_actualizado_en;
update public.articulos set actualizado_en = '2000-01-01 00:00+00', version = 2
  where id = 'a1000000-0000-4000-8000-000000000001';
alter table public.articulos enable trigger a90_actualizado_en;
select is(
  (select version from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'),
  3,
  'RF-008: el sistema (postgres) también pasa por el control de versión'
);

-- Caso borde: renombrar no cambia el slug.
select pruebas.como('h1-editor@prueba.local');
update public.articulos set titulo = 'Mi artículo renombrado', version = 3
  where id = 'a1000000-0000-4000-8000-000000000001';
select results_eq(
  $$select titulo, slug, version, actualizado_en = now()
    from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values ('Mi artículo renombrado'::text, 'mi-articulo'::text, 4, true)$$,
  'cambiar el título de un borrador no cambia su slug; la versión sube y actualizado_en se renueva'
);

select throws_ok($$
  update public.articulos set titulo = 'Cambio sobre una versión vieja', version = 2
  where id = 'a1000000-0000-4000-8000-000000000001'
$$, 'P0001', 'conflicto_version', 'RF-008: un update con una versión desactualizada lanza conflicto_version');
select results_eq(
  $$select titulo, version from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values ('Mi artículo renombrado'::text, 4)$$,
  'RF-008: el update rechazado no pisa los cambios'
);
select throws_ok($$
  update public.articulos set titulo = 'Versión del futuro', version = 9
  where id = 'a1000000-0000-4000-8000-000000000001'
$$, 'P0001', 'conflicto_version', 'RF-008: una versión que no coincide (mayor) también lanza conflicto_version');

-- ---------------------------------------------------------------------------
-- Defensa del contenido en la base (check privado.contenido_valido, D8)
-- ---------------------------------------------------------------------------
select throws_ok($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Bloque inexistente', '[{"id": "b1", "tipo": "tabla"}]', auth.uid())
$$, '23514', null, 'un contenido con un tipo de bloque inexistente viola el check');
select throws_like($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Bloque inexistente', '[{"id": "b1", "tipo": "tabla"}]', auth.uid())
$$, '%contenido%', 'el error del check menciona contenido (traducirError lo mapea a contenido_invalido)');
select throws_ok($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Demasiados bloques',
          (select jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'tipo', 'separador'))
           from generate_series(1, 201)),
          auth.uid())
$$, '23514', null, 'un contenido con más de 200 bloques viola el check');
select lives_ok($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Doscientos bloques',
          (select jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'tipo', 'separador'))
           from generate_series(1, 200)),
          auth.uid())
$$, 'un contenido con exactamente 200 bloques se acepta');
select throws_ok($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Contenido que no es arreglo', '{"tipo": "parrafo"}', auth.uid())
$$, '23514', null, 'un contenido que no es un arreglo viola el check');
-- contenido_valido debe devolver false (no null) cuando falta un campo: un check con null pasa.
select throws_ok($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Bloque sin tipo', '[{"id": "b1", "texto": "Huérfano"}]', auth.uid())
$$, '23514', null, 'un bloque sin tipo viola el check');
select throws_ok($$
  insert into public.articulos (titulo, contenido, autor_id)
  values ('Bloque sin id', '[{"tipo": "parrafo", "texto": "Sin id"}]', auth.uid())
$$, '23514', null, 'un bloque sin id viola el check');
select throws_ok($$
  update public.articulos set contenido = '[{"id": "b1", "tipo": "tabla"}]', version = 4
  where id = 'a1000000-0000-4000-8000-000000000001'
$$, '23514', null, 'un update con un tipo de bloque inexistente viola el check');

-- ---------------------------------------------------------------------------
-- RF-001, RF-004, RF-006: límites de los campos
-- ---------------------------------------------------------------------------
select throws_ok($$
  insert into public.articulos (titulo, autor_id) values ('   ', auth.uid())
$$, '23514', null, 'RF-001: un título vacío se rechaza');
select throws_ok($$
  insert into public.articulos (titulo, autor_id) values (repeat('a', 121), auth.uid())
$$, '23514', null, 'RF-001: un título de más de 120 caracteres se rechaza');
select throws_ok($$
  insert into public.articulos (titulo, extracto, autor_id) values ('Extracto largo', repeat('a', 301), auth.uid())
$$, '23514', null, 'RF-001: un extracto de más de 300 caracteres se rechaza');
select throws_ok($$
  insert into public.articulos (titulo, titulo_seo, autor_id) values ('SEO largo', repeat('a', 61), auth.uid())
$$, '23514', null, 'RF-006: un título SEO de más de 60 caracteres se rechaza');
select throws_ok($$
  insert into public.articulos (titulo, descripcion_seo, autor_id) values ('Descripción larga', repeat('a', 161), auth.uid())
$$, '23514', null, 'RF-006: una descripción SEO de más de 160 caracteres se rechaza');
select throws_ok($$
  insert into public.articulos (titulo, imagen_destacada, autor_id)
  values ('Destacada sin alt', '{"ruta": "medios/portada.jpg", "ancho": 1200, "alto": 630}', auth.uid())
$$, '23514', null, 'RF-004: una imagen destacada sin alt y no decorativa se rechaza');

-- ---------------------------------------------------------------------------
-- articulos_delete_admin: el editor no borra, el admin sí (H6-E7)
-- ---------------------------------------------------------------------------
select pruebas.como('h1-editor@prueba.local');
delete from public.articulos where id = 'a1000000-0000-4000-8000-000000000002';
select pruebas.como_postgres();
select isnt_empty(
  $$select 1 from public.articulos where id = 'a1000000-0000-4000-8000-000000000002'$$,
  'un editor no puede borrar un artículo (ni siquiera el propio)'
);

select pruebas.como('h1-admin@prueba.local');
delete from public.articulos where id = 'a1000000-0000-4000-8000-000000000002';
select pruebas.como_postgres();
select is_empty(
  $$select 1 from public.articulos where id = 'a1000000-0000-4000-8000-000000000002'$$,
  'un admin sí puede borrar un artículo'
);

-- ---------------------------------------------------------------------------
-- Un editor desactivado no opera (es_equipo() = false)
-- ---------------------------------------------------------------------------
select pruebas.como('h1-inactivo@prueba.local');
select throws_ok($$
  insert into public.articulos (titulo, autor_id) values ('Intento de un inactivo', auth.uid())
$$, '42501', null, 'un editor desactivado no puede crear artículos');
select is_empty(
  $$select 1 from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'un editor desactivado no ve borradores'
);
update public.articulos set titulo = 'Editado por un inactivo', version = 4
  where id = 'a1000000-0000-4000-8000-000000000001';
select pruebas.como_postgres();
select is(
  (select titulo from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'),
  'Mi artículo renombrado',
  'un editor desactivado no puede editar artículos'
);

select pruebas.como('h1-admin@prueba.local');
select isnt_empty(
  $$select 1 from public.articulos where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'un admin ve los borradores'
);

-- ---------------------------------------------------------------------------
-- Validación del MVP: id inmutable (A-M1) y campos del sistema (A-M2)
-- ---------------------------------------------------------------------------
select pruebas.como('h1-editor@prueba.local');
insert into public.articulos (titulo, slug, programado_para, actualizado_en)
  values ('Campos sistema', 'campos-sistema', now() + interval '30 days', '1999-01-01');
select results_eq(
  $$select programado_para is null, actualizado_en > '2000-01-01'::timestamptz
    from public.articulos where slug = 'campos-sistema'$$,
  $$values (true, true)$$,
  'A-M2: en el insert del cliente se fuerzan programado_para = null y actualizado_en = now()'
);
select throws_ok(
  $$update public.articulos set id = gen_random_uuid() where slug = 'campos-sistema'$$,
  'P0001', 'sin_permiso', 'A-M1: el id de un artículo es inmutable'
);
update public.articulos
  set estado = 'publicado', version = (select version from public.articulos where slug = 'campos-sistema')
  where slug = 'campos-sistema';
select is((select estado::text from public.articulos where slug = 'campos-sistema'), 'borrador',
  'A-M2: hasta H2 el cliente no cambia el estado');
select pruebas.como_postgres();
insert into public.categorias (nombre) values ('Categoría id fijo');
select throws_ok(
  $$update public.categorias set id = gen_random_uuid() where nombre = 'Categoría id fijo'$$,
  'P0001', 'sin_permiso', 'A-M1: el id de una categoría es inmutable (también para postgres)'
);
insert into public.etiquetas (nombre) values ('Etiqueta id fijo');
select throws_ok(
  $$update public.etiquetas set id = gen_random_uuid() where nombre = 'Etiqueta id fijo'$$,
  'P0001', 'sin_permiso', 'A-M1: el id de una etiqueta es inmutable'
);

select pruebas.como_postgres();
select * from finish();
rollback;
