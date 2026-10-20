-- T058 (H5): los recálculos no son ediciones (validación ronda 5 y A6-M2).
-- fijar_actualizado_en conserva actualizado_en cuando el update viene de otro
-- trigger (pg_trigger_depth() > 1), en las cuatro tablas que lo usan; y la carga
-- inicial de busqueda (misma sentencia que la migración 20261019120800) no
-- cambia version ni actualizado_en.
-- No depende del seed: crea un usuario, una categoría, una etiqueta y un artículo
-- con prefijo h5-act-.
begin;
\ir helpers/pruebas.psql
select plan(10);

select pruebas.crear_usuario('h5-act-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Cinco Act"}');
insert into public.categorias (nombre, slug) values ('H5 Act Categoría', 'h5-act-categoria');
insert into public.etiquetas (nombre, slug) values ('H5 Act Etiqueta', 'h5-act-etiqueta');
insert into public.articulos (titulo, slug, autor_id, categoria_id)
select 'H5 Act Artículo', 'h5-act-articulo', p.id, c.id
from public.perfiles p, public.categorias c
where p.nombre = 'Hache Cinco Act' and c.slug = 'h5-act-categoria';

-- Ids de las filas de prueba, por tabla.
create temporary table filas_h5 (tabla text primary key, id uuid not null) on commit drop;
insert into filas_h5
select 'articulos', id from public.articulos where slug = 'h5-act-articulo'
union all select 'perfiles', id from public.perfiles where nombre = 'Hache Cinco Act'
union all select 'categorias', id from public.categorias where slug = 'h5-act-categoria'
union all select 'etiquetas', id from public.etiquetas where slug = 'h5-act-etiqueta';

-- Fecha conocida en el pasado, sin pasar por a90 (que pondría now()).
alter table public.articulos disable trigger a90_actualizado_en;
alter table public.perfiles disable trigger a90_actualizado_en;
alter table public.categorias disable trigger a90_actualizado_en;
alter table public.etiquetas disable trigger a90_actualizado_en;
update public.articulos set actualizado_en = '2020-01-01' where slug = 'h5-act-articulo';
update public.perfiles set actualizado_en = '2020-01-01' where nombre = 'Hache Cinco Act';
update public.categorias set actualizado_en = '2020-01-01' where slug = 'h5-act-categoria';
update public.etiquetas set actualizado_en = '2020-01-01' where slug = 'h5-act-etiqueta';
alter table public.articulos enable trigger a90_actualizado_en;
alter table public.perfiles enable trigger a90_actualizado_en;
alter table public.categorias enable trigger a90_actualizado_en;
alter table public.etiquetas enable trigger a90_actualizado_en;

-- Un insert en esta tabla dispara un update de la fila indicada: ese update
-- corre a profundidad 2, como los recálculos de busqueda.
create temporary table disparos_h5 (tabla text, id uuid) on commit drop;
create function pruebas.tocar_desde_trigger() returns trigger
language plpgsql as $$
begin
  execute format('update public.%I set id = id where id = $1', new.tabla) using new.id;
  return null;
end
$$;
create trigger tocar after insert on disparos_h5 for each row execute function pruebas.tocar_desde_trigger();

create function pruebas.actualizado_en_h5(nombre_tabla text) returns timestamptz
language plpgsql as $$
declare
  valor timestamptz;
begin
  execute format('select actualizado_en from public.%I where id = $1', nombre_tabla)
    into valor using (select id from filas_h5 where tabla = nombre_tabla);
  return valor;
end
$$;

-- ===========================================================================
-- fijar_actualizado_en a profundidad > 1: conserva el valor anterior
-- ===========================================================================
insert into disparos_h5 select tabla, id from filas_h5;

select is(pruebas.actualizado_en_h5('articulos'), '2020-01-01'::timestamptz,
  'validación ronda 5: un update desde otro trigger no mueve articulos.actualizado_en');
select is(pruebas.actualizado_en_h5('perfiles'), '2020-01-01'::timestamptz,
  'validación ronda 5: un update desde otro trigger no mueve perfiles.actualizado_en');
select is(pruebas.actualizado_en_h5('categorias'), '2020-01-01'::timestamptz,
  'validación ronda 5: un update desde otro trigger no mueve categorias.actualizado_en');
select is(pruebas.actualizado_en_h5('etiquetas'), '2020-01-01'::timestamptz,
  'validación ronda 5: un update desde otro trigger no mueve etiquetas.actualizado_en');

-- ===========================================================================
-- Control: un update directo (profundidad 1) sí pone now()
-- ===========================================================================
update public.categorias set id = id where slug = 'h5-act-categoria';
update public.etiquetas set id = id where slug = 'h5-act-etiqueta';
select is(pruebas.actualizado_en_h5('categorias'), now(),
  'control: un update directo de una categoría pone actualizado_en = now()');
select is(pruebas.actualizado_en_h5('etiquetas'), now(),
  'control: un update directo de una etiqueta pone actualizado_en = now()');

-- ===========================================================================
-- Carga inicial de busqueda (A6-M2): misma sentencia que la migración
-- ===========================================================================
update public.articulos set busqueda = null where slug = 'h5-act-articulo';
alter table public.articulos disable trigger a90_actualizado_en;
update public.articulos set actualizado_en = '2020-01-01' where slug = 'h5-act-articulo';
alter table public.articulos enable trigger a90_actualizado_en;

create temporary table antes_carga on commit drop as
  select version from public.articulos where slug = 'h5-act-articulo';

alter table public.articulos disable trigger a30_controlar_version;
alter table public.articulos disable trigger a90_actualizado_en;
update public.articulos set titulo = titulo;
alter table public.articulos enable trigger a30_controlar_version;
alter table public.articulos enable trigger a90_actualizado_en;

select isnt((select busqueda from public.articulos where slug = 'h5-act-articulo'), null,
  'A6-M2: la carga inicial calcula busqueda');
select ok(
  (select busqueda @@ websearch_to_tsquery('pg_catalog.spanish', 'categoría')
     from public.articulos where slug = 'h5-act-articulo'),
  'A6-M2: la carga inicial incluye el nombre de la categoría');
select is((select version from public.articulos where slug = 'h5-act-articulo'), (select version from antes_carga),
  'A6-M2: la carga inicial no sube la versión');
select is(pruebas.actualizado_en_h5('articulos'), '2020-01-01'::timestamptz,
  'A6-M2: la carga inicial no mueve actualizado_en');

select * from finish();
rollback;
