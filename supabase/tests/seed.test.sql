-- T065: datos de demo (RF-028, CE-007). Verifica el estado que deja seed.sql
-- después de `pnpm db:reset`: es el único test que depende del seed, a propósito.
begin;
select plan(11);

select is(
  (select count(*)::int from public.perfiles p join auth.users u on u.id = p.id where u.email like '%@demo.local'),
  3, 'hay 3 perfiles demo');
select is(
  (select count(*)::int from public.perfiles p join auth.users u on u.id = p.id
    where u.email like '%@demo.local' and p.rol = 'admin' and p.activo),
  1, '1 admin activo');
select is(
  (select count(*)::int from public.perfiles p join auth.users u on u.id = p.id
    where u.email like '%@demo.local' and p.rol = 'editor' and p.activo),
  2, '2 editores activos');

select ok((select count(*) from public.categorias) >= 4, 'al menos 4 categorías');
select ok((select count(*) from public.etiquetas) >= 10, 'al menos 10 etiquetas');

select ok((select count(*) from public.articulos where estado = 'publicado' and publicado_en <= now()) >= 9,
  'al menos 9 artículos publicados');
select ok((select count(*) from public.articulos where estado = 'programado' and programado_para > now()) >= 2,
  'al menos 2 programados con fecha futura');
select ok((select count(*) from public.articulos where estado = 'borrador') >= 2, 'al menos 2 borradores');
select ok((select count(*) from public.articulos where estado = 'archivado') >= 1, 'al menos 1 archivado');

select is(
  (select array_agg(distinct b ->> 'tipo' order by b ->> 'tipo')
     from public.articulos a, jsonb_array_elements(a.contenido) b
    where a.estado = 'publicado'),
  (select array_agg(t order by t) from unnest(privado.tipos_bloque()) t),
  'los publicados usan los 10 tipos de bloque');

select is_empty($$
  select 1
  from public.articulos a,
       jsonb_path_query(a.contenido, 'strict $[*] ? (@.tipo == "imagen").imagen') as img
  where not privado.imagen_valida(img)
  union all
  select 1
  from public.articulos a,
       jsonb_path_query(a.contenido, 'strict $[*] ? (@.tipo == "galeria").imagenes[*]') as img
  where not privado.imagen_valida(img)
  union all
  select 1 from public.articulos a
  where a.imagen_destacada is not null and not privado.imagen_valida(a.imagen_destacada)
$$, 'toda imagen tiene ruta, ancho, alto y alt');

select * from finish();
rollback;
