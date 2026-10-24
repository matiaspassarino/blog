-- T036: vista public.autores_publicos (H2-E2, RF-026, CE-002, D5, revisión B1).
-- Expone solo id, nombre, biografia y avatar de autores con algún artículo
-- publicado y publicado_en <= now(). No es escribible por ningún cliente.
-- No depende del seed: usuarios @prueba.local y slugs propios (prefijo h2-aut-).
begin;
\ir helpers/pruebas.psql
select plan(19);

select pruebas.crear_usuario('h2-aut-publica@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Autora Pública"}');
select pruebas.crear_usuario('h2-aut-borrador@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Autor Borrador"}');
select pruebas.crear_usuario('h2-aut-futuro@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Autor Futuro"}');
select pruebas.crear_usuario('h2-aut-archivo@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Autor Archivo"}');
select pruebas.crear_usuario('h2-aut-programa@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Autor Programa"}');
select pruebas.crear_usuario('h2-aut-sin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Dos Sin Artículos"}');

update public.perfiles
   set biografia = 'Escribe sobre diseño.',
       avatar = '{"ruta": "medios/h2-aut.jpg", "ancho": 200, "alto": 200, "alt": "Retrato"}'
 where id = (select id from auth.users where email = 'h2-aut-publica@prueba.local');

delete from public.articulos where slug like 'h2-aut-%';
delete from public.categorias where slug = 'h2-aut-categoria' or lower(nombre) = lower('H2 Aut Categoría');
insert into public.categorias (nombre, slug) values ('H2 Aut Categoría', 'h2-aut-categoria');

-- Un artículo por autor, en el estado que define si es público (cargados como el seed).
insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
select 'H2 autor ' || x.sufijo, 'h2-aut-' || x.sufijo,
       '{"type": "doc", "content": [{"type": "paragraph", "attrs": {"id": "b2200000-0000-4000-8000-000000000001"}, "content": [{"type": "text", "text": "Texto."}]}]}',
       (select id from public.categorias where slug = 'h2-aut-categoria'),
       (select id from auth.users where email = x.email),
       x.estado::public.estado_articulo, x.publicado_en, x.programado_para
from (values
  ('publica', 'h2-aut-publica@prueba.local', 'publicado', now() - interval '1 day', null::timestamptz),
  ('borrador', 'h2-aut-borrador@prueba.local', 'borrador', null, null),
  ('futuro', 'h2-aut-futuro@prueba.local', 'publicado', now() + interval '1 day', null),
  ('archivo', 'h2-aut-archivo@prueba.local', 'archivado', now() - interval '10 days', null),
  ('programa', 'h2-aut-programa@prueba.local', 'programado', null, now() + interval '1 day')
) as x(sufijo, email, estado, publicado_en, programado_para);

create temporary table autores_h2 on commit drop as
select u.email::text as email, u.id from auth.users u where u.email like 'h2-aut-%@prueba.local';
grant select on autores_h2 to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Forma de la vista (D5)
-- ---------------------------------------------------------------------------
select has_view('public', 'autores_publicos', 'existe la vista public.autores_publicos');
-- Spec 002 (T014): se agregan slug (URL del autor) y actualizado_en (lastmod del sitemap) al final.
select columns_are('public', 'autores_publicos', array['id', 'nombre', 'biografia', 'avatar', 'slug', 'actualizado_en'],
  'H2-E2 / spec 002: la vista expone exactamente id, nombre, biografia, avatar, slug y actualizado_en (nunca correo, rol ni estado)');
select ok(
  coalesce((select reloptions @> array['security_barrier=true'] from pg_class
            where oid = to_regclass('public.autores_publicos')), false),
  'D5: la vista es security_barrier'
);

-- ---------------------------------------------------------------------------
-- H2-E2: el visitante ve solo los autores con algún artículo público
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select results_eq(
  $$select a.email from public.autores_publicos v join autores_h2 a on a.id = v.id order by a.email$$,
  $$values ('h2-aut-publica@prueba.local'::text)$$,
  'RF-026: solo aparece el autor con un artículo publicado y publicado_en <= now()'
);
select results_eq(
  $$select v.nombre, v.biografia, v.avatar ->> 'alt' from public.autores_publicos v
    join autores_h2 a on a.id = v.id where a.email = 'h2-aut-publica@prueba.local'$$,
  $$values ('Hache Dos Autora Pública'::text, 'Escribe sobre diseño.'::text, 'Retrato'::text)$$,
  'H2-E2: el visitante ve el nombre, la biografía y la foto del autor'
);
select is_empty(
  $$select 1 from public.autores_publicos v join autores_h2 a on a.id = v.id
    where a.email in ('h2-aut-borrador@prueba.local', 'h2-aut-programa@prueba.local')$$,
  'CE-002: un autor que solo tiene borradores o programados no aparece'
);
select is_empty(
  $$select 1 from public.autores_publicos v join autores_h2 a on a.id = v.id
    where a.email = 'h2-aut-futuro@prueba.local'$$,
  'CE-002: un autor cuyo publicado tiene publicado_en futuro no aparece'
);
select is_empty(
  $$select 1 from public.autores_publicos v join autores_h2 a on a.id = v.id
    where a.email = 'h2-aut-archivo@prueba.local'$$,
  'CE-002: un autor con solo artículos archivados no aparece'
);
select is_empty(
  $$select 1 from public.autores_publicos v join autores_h2 a on a.id = v.id
    where a.email = 'h2-aut-sin@prueba.local'$$,
  'RF-026: un miembro sin artículos no aparece'
);

select pruebas.como('h2-aut-sin@prueba.local');
select results_eq(
  $$select a.email from public.autores_publicos v join autores_h2 a on a.id = v.id order by a.email$$,
  $$values ('h2-aut-publica@prueba.local'::text)$$,
  'el equipo (authenticated) también lee la vista, con el mismo filtro'
);

-- ---------------------------------------------------------------------------
-- B1: la vista no es escribible por los clientes
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select throws_ok(
  $$insert into public.autores_publicos (id, nombre) values (gen_random_uuid(), 'Intruso')$$,
  '42501', null, 'B1: anon no puede insertar en autores_publicos');
select throws_ok(
  $$update public.autores_publicos set nombre = 'Hackeado'$$,
  '42501', null, 'B1: anon no puede actualizar autores_publicos');
select throws_ok(
  $$delete from public.autores_publicos$$,
  '42501', null, 'B1: anon no puede borrar de autores_publicos');

select pruebas.como('h2-aut-borrador@prueba.local');
select throws_ok(
  $$insert into public.autores_publicos (id, nombre) values (gen_random_uuid(), 'Intruso')$$,
  '42501', null, 'B1: authenticated no puede insertar en autores_publicos');
select throws_ok(
  $$update public.autores_publicos set nombre = 'Hackeado'$$,
  '42501', null, 'B1: authenticated no puede actualizar autores_publicos');
select throws_ok(
  $$delete from public.autores_publicos$$,
  '42501', null, 'B1: authenticated no puede borrar de autores_publicos');

select pruebas.como_postgres();
select is(
  (select nombre from public.perfiles p join autores_h2 a on a.id = p.id where a.email = 'h2-aut-publica@prueba.local'),
  'Hache Dos Autora Pública',
  'B1: los intentos de escritura no modificaron el perfil'
);

-- ---------------------------------------------------------------------------
-- anon sigue sin poder leer perfiles
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select throws_ok($$select 1 from public.perfiles$$, '42501', null,
  'RF-026: anon no puede leer la tabla perfiles');

select pruebas.como_postgres();
select table_privs_are('public', 'perfiles', 'anon', array[]::text[],
  'RF-026: anon no tiene ningún privilegio sobre perfiles');
select * from finish();
rollback;
