-- Sitemap (RSEO-004, validación A5-B1): public.entradas_sitemap() devuelve TODAS
-- las entradas públicas en un único jsonb, sin el corte de max_rows (1000) de
-- PostgREST. Solo taxonomías con algún artículo publicado.
begin;
\ir helpers/pruebas.psql
select plan(8);

select pruebas.crear_usuario('h3-sitemap@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Tres Sitemap"}');
insert into public.categorias (nombre, slug) values
  ('H3 Sitemap Con Publicados', 'h3-sitemap-con'),
  ('H3 Sitemap Solo Borrador', 'h3-sitemap-solo-borrador');
insert into public.etiquetas (nombre, slug) values
  ('H3 Sitemap Etiqueta Usada', 'h3-sitemap-etiqueta-usada'),
  ('H3 Sitemap Etiqueta Borrador', 'h3-sitemap-etiqueta-borrador');

-- 1.100 publicados (más que max_rows), cargados por el sistema.
insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
select 'H3 sitemap ' || n, 'h3-sitemap-' || n, '[{"id": "x", "tipo": "separador"}]',
       (select id from public.categorias where slug = 'h3-sitemap-con'),
       (select id from auth.users where email = 'h3-sitemap@prueba.local'),
       'publicado', now() - make_interval(mins => n)
from generate_series(1, 1100) as n;
insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado)
values ('H3 sitemap borrador', 'h3-sitemap-borrador', '[{"id": "x", "tipo": "separador"}]',
        (select id from public.categorias where slug = 'h3-sitemap-solo-borrador'),
        (select id from auth.users where email = 'h3-sitemap@prueba.local'), 'borrador');
insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, programado_para)
values ('H3 sitemap programado', 'h3-sitemap-programado', '[{"id": "x", "tipo": "separador"}]',
        (select id from public.categorias where slug = 'h3-sitemap-con'),
        (select id from auth.users where email = 'h3-sitemap@prueba.local'), 'programado', now() + interval '1 day');
insert into public.articulos_etiquetas (articulo_id, etiqueta_id)
select (select id from public.articulos where slug = 'h3-sitemap-1'), id from public.etiquetas where slug = 'h3-sitemap-etiqueta-usada'
union all
select (select id from public.articulos where slug = 'h3-sitemap-borrador'), id from public.etiquetas where slug = 'h3-sitemap-etiqueta-borrador';

select pruebas.como_anon();
create temporary table entradas on commit drop as
  select e from jsonb_array_elements(public.entradas_sitemap()) as e;

select is(jsonb_typeof(public.entradas_sitemap()), 'array', 'entradas_sitemap devuelve un único arreglo jsonb');
select is(
  (select count(*)::int from entradas where e ->> 'tipo' = 'articulo' and e ->> 'slug' like 'h3-sitemap-%'),
  1100, 'A5-B1: incluye los 1.100 artículos publicados (sin corte de max_rows)');
select is_empty($$select 1 from entradas where e ->> 'slug' in ('h3-sitemap-borrador', 'h3-sitemap-programado')$$,
  'no incluye borradores ni programados');
select isnt_empty($$select 1 from entradas where e ->> 'tipo' = 'categoria' and e ->> 'slug' = 'h3-sitemap-con'$$,
  'incluye la categoría con publicados');
select is_empty($$select 1 from entradas where e ->> 'tipo' = 'categoria' and e ->> 'slug' = 'h3-sitemap-solo-borrador'$$,
  'no incluye la categoría que solo tiene borradores');
select isnt_empty($$select 1 from entradas where e ->> 'tipo' = 'etiqueta' and e ->> 'slug' = 'h3-sitemap-etiqueta-usada'$$,
  'incluye la etiqueta de un publicado');
select is_empty($$select 1 from entradas where e ->> 'tipo' = 'etiqueta' and e ->> 'slug' = 'h3-sitemap-etiqueta-borrador'$$,
  'no incluye la etiqueta que solo usa un borrador');
select is_empty($$select 1 from entradas where not (e ?& array['tipo', 'slug', 'actualizado_en'])$$,
  'cada entrada trae tipo, slug y actualizado_en');

select pruebas.como_postgres();
select * from finish();
rollback;
