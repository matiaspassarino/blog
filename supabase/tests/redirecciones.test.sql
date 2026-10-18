-- T035: redirecciones de artículos por cambio de slug (H2-E4, RF-012, RSEO-003, D11, D24).
-- Triggers z10_registrar_redireccion y z20_borrar_redirecciones, política
-- redirecciones_select (D24) y RPC public.resolver_redireccion.
-- No depende del seed: usuarios @prueba.local y slugs propios (prefijo h2-redir-).
begin;
\ir helpers/pruebas.psql
select plan(23);

select pruebas.crear_usuario('h2-redir-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Redir Editor"}');
select pruebas.crear_usuario('h2-redir-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Dos Redir Admin"}');

-- Libera los slugs y redirecciones que usa el test (se deshace con el rollback).
delete from public.articulos where slug like 'h2-redir-%';
delete from public.redirecciones where tipo_entidad = 'articulo' and slug_anterior like 'h2-redir-%';
delete from public.categorias where slug = 'h2-redir-categoria' or lower(nombre) = lower('H2 Redir Categoría');
insert into public.categorias (nombre, slug) values ('H2 Redir Categoría', 'h2-redir-categoria');

-- Publicado (como lo cargaría el seed) y borrador nunca publicado.
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
values (
  'a2100000-0000-4000-8000-000000000001', 'H2 redirección', 'h2-redir-a',
  '[{"id": "b2100000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Texto."}]',
  (select id from public.categorias where slug = 'h2-redir-categoria'),
  (select id from auth.users where email = 'h2-redir-editor@prueba.local'),
  'publicado', now() - interval '1 day'
);
insert into public.articulos (id, titulo, slug, autor_id)
values (
  'a2100000-0000-4000-8000-000000000002', 'H2 borrador', 'h2-redir-borrador',
  (select id from auth.users where email = 'h2-redir-editor@prueba.local')
);

-- Cambia el slug (o el título) como el rol en curso, con la versión actual.
create function pruebas.cambiar_slug(articulo uuid, nuevo text) returns void
language sql as $$
  update public.articulos set slug = nuevo,
         version = (select a.version from public.articulos a where a.id = articulo)
   where id = articulo
$$;
grant execute on function pruebas.cambiar_slug(uuid, text) to authenticated;

-- Redirecciones del test, leídas como postgres (sin RLS).
create function pruebas.redirecciones_h2() returns table (slug_anterior text, entidad_id uuid)
language sql stable security definer set search_path = '' as $$
  select r.slug_anterior, r.entidad_id from public.redirecciones r
  where r.tipo_entidad = 'articulo' and r.slug_anterior like 'h2-redir-%'
  order by r.slug_anterior
$$;

-- ---------------------------------------------------------------------------
-- Casos que NO crean redirección
-- ---------------------------------------------------------------------------
select pruebas.como('h2-redir-editor@prueba.local');
select pruebas.cambiar_slug('a2100000-0000-4000-8000-000000000002', 'h2-redir-borrador-nuevo');
select pruebas.como_postgres();
select is((select slug from public.articulos where id = 'a2100000-0000-4000-8000-000000000002'),
  'h2-redir-borrador-nuevo', 'el slug de un borrador nunca publicado se puede cambiar');
select is_empty($$select 1 from pruebas.redirecciones_h2() where slug_anterior = 'h2-redir-borrador'$$,
  'D11: cambiar el slug de un borrador nunca publicado no crea redirección');

select pruebas.como('h2-redir-editor@prueba.local');
update public.articulos set titulo = 'H2 redirección con otro título',
       version = (select version from public.articulos where id = 'a2100000-0000-4000-8000-000000000001')
 where id = 'a2100000-0000-4000-8000-000000000001';
select pruebas.como_postgres();
select results_eq(
  $$select titulo, slug from public.articulos where id = 'a2100000-0000-4000-8000-000000000001'$$,
  $$values ('H2 redirección con otro título'::text, 'h2-redir-a'::text)$$,
  'caso borde: renombrar un artículo publicado no cambia su slug'
);
select is_empty($$select 1 from pruebas.redirecciones_h2()$$,
  'caso borde: renombrar un artículo publicado no crea redirección');

-- ---------------------------------------------------------------------------
-- H2-E4: cambiar el slug de un publicado registra el anterior
-- ---------------------------------------------------------------------------
select pruebas.como('h2-redir-editor@prueba.local');
select pruebas.cambiar_slug('a2100000-0000-4000-8000-000000000001', 'h2-redir-b');
select pruebas.como_postgres();
select results_eq(
  $$select slug_anterior, entidad_id from pruebas.redirecciones_h2()$$,
  $$values ('h2-redir-a'::text, 'a2100000-0000-4000-8000-000000000001'::uuid)$$,
  'H2-E4: cambiar el slug de un publicado crea redirecciones(articulo, slug_viejo) hacia el artículo'
);

-- A → B → C: dos redirecciones que apuntan a la entidad (sin cadenas)
select pruebas.como('h2-redir-editor@prueba.local');
select pruebas.cambiar_slug('a2100000-0000-4000-8000-000000000001', 'h2-redir-c');
select pruebas.como_postgres();
select results_eq(
  $$select slug_anterior, entidad_id from pruebas.redirecciones_h2()$$,
  $$values ('h2-redir-a'::text, 'a2100000-0000-4000-8000-000000000001'::uuid),
           ('h2-redir-b'::text, 'a2100000-0000-4000-8000-000000000001'::uuid)$$,
  'D11: A → B → C deja dos redirecciones (a y b) que apuntan al artículo'
);

-- ---------------------------------------------------------------------------
-- resolver_redireccion como visitante: devuelve siempre el slug actual
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select is(public.resolver_redireccion('articulo', 'h2-redir-a'), 'h2-redir-c',
  'H2-E4: para el visitante, el slug a resuelve al slug actual c (sin cadenas)');
select is(public.resolver_redireccion('articulo', 'h2-redir-b'), 'h2-redir-c',
  'H2-E4: para el visitante, el slug b resuelve al slug actual c');
select is(public.resolver_redireccion('articulo', 'h2-redir-inexistente'), null,
  'resolver_redireccion devuelve null para un slug sin redirección');
select is(public.resolver_redireccion('categoria', 'h2-redir-a'), null,
  'resolver_redireccion distingue el tipo de entidad');
select is(
  (select count(*)::int from public.redirecciones where slug_anterior in ('h2-redir-a', 'h2-redir-b')),
  2, 'D24: el visitante ve las redirecciones de un artículo publicado');

-- Volver al slug A borra la redirección A (y registra C)
select pruebas.como('h2-redir-editor@prueba.local');
select pruebas.cambiar_slug('a2100000-0000-4000-8000-000000000001', 'h2-redir-a');
select pruebas.como_postgres();
select results_eq(
  $$select slug_anterior from pruebas.redirecciones_h2()$$,
  $$values ('h2-redir-b'::text), ('h2-redir-c'::text)$$,
  'D11: volver al slug a borra la redirección a y registra c'
);
select pruebas.como_anon();
select is(public.resolver_redireccion('articulo', 'h2-redir-c'), 'h2-redir-a',
  'después de volver, el slug c resuelve al slug actual a');

-- ---------------------------------------------------------------------------
-- D24: un artículo despublicado no filtra su slug al visitante
-- ---------------------------------------------------------------------------
select pruebas.como('h2-redir-editor@prueba.local');
update public.articulos set estado = 'borrador',
       version = (select version from public.articulos where id = 'a2100000-0000-4000-8000-000000000001')
 where id = 'a2100000-0000-4000-8000-000000000001';
select pruebas.como_postgres();
select is((select estado::text from public.articulos where id = 'a2100000-0000-4000-8000-000000000001'),
  'borrador', 'el artículo se despublica (publicado → borrador)');

select pruebas.como_anon();
select is(public.resolver_redireccion('articulo', 'h2-redir-b'), null,
  'D24: si el artículo se despublicó, resolver_redireccion devuelve null para el visitante');
select is_empty($$select 1 from public.redirecciones where slug_anterior like 'h2-redir-%'$$,
  'D24: el visitante no ve las redirecciones de un artículo despublicado');

select pruebas.como('h2-redir-editor@prueba.local');
select is(public.resolver_redireccion('articulo', 'h2-redir-b'), 'h2-redir-a',
  'D24: para el equipo, resolver_redireccion sigue devolviendo el slug actual');
select is((select count(*)::int from public.redirecciones where slug_anterior like 'h2-redir-%'), 2,
  'D24: el equipo ve las redirecciones del artículo despublicado');

-- Un artículo que ya se publicó alguna vez (publicado_en no nulo) sigue registrando
-- el slug anterior aunque ahora esté en borrador.
select pruebas.cambiar_slug('a2100000-0000-4000-8000-000000000001', 'h2-redir-d');
select pruebas.como_postgres();
select isnt_empty($$select 1 from pruebas.redirecciones_h2() where slug_anterior = 'h2-redir-a'$$,
  'D11: un artículo que ya se publicó alguna vez registra la redirección aunque esté en borrador');

-- ---------------------------------------------------------------------------
-- Solo los triggers escriben redirecciones
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select throws_ok($$
  insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id)
  values ('articulo', 'h2-redir-intruso', 'a2100000-0000-4000-8000-000000000001')
$$, '42501', null, 'anon no puede insertar en redirecciones');
select pruebas.como('h2-redir-editor@prueba.local');
select throws_ok($$
  insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id)
  values ('articulo', 'h2-redir-intruso', 'a2100000-0000-4000-8000-000000000001')
$$, '42501', null, 'un editor tampoco puede insertar en redirecciones');

-- ---------------------------------------------------------------------------
-- Borrar el artículo borra sus redirecciones (z20_borrar_redirecciones)
-- ---------------------------------------------------------------------------
select pruebas.como('h2-redir-admin@prueba.local');
delete from public.articulos where id = 'a2100000-0000-4000-8000-000000000001';
select pruebas.como_postgres();
select is_empty($$select 1 from public.articulos where id = 'a2100000-0000-4000-8000-000000000001'$$,
  'el admin borra el artículo');
select is_empty(
  $$select 1 from public.redirecciones where entidad_id = 'a2100000-0000-4000-8000-000000000001'$$,
  'borrar el artículo borra sus redirecciones');

select pruebas.como_postgres();
select * from finish();
rollback;
