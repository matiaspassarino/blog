-- T065: datos de demo (RF-028, CE-007). Verifica el estado que deja seed.sql
-- después de `pnpm db:reset`: es el único test que depende del seed, a propósito.
begin;
select plan(16);

select is(
  (select count(*)::int from public.perfiles p join auth.users u on u.id = p.id where u.email like '%@demo.local'),
  3, 'hay 3 perfiles demo');
-- Spec 002 (T017): el slug se lee con to_jsonb para que, sin la columna, falle solo esta afirmación.
select is(
  (select count(*)::int from public.perfiles p join auth.users u on u.id = p.id
    where u.email like '%@demo.local' and coalesce(to_jsonb(p) ->> 'slug', '') <> ''),
  3, 'spec 002: los 3 perfiles demo tienen slug no vacío');
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

-- Spec 002 (T012): segunda página de /blog y redirecciones de demo en un salto.
select ok((select count(*) from public.articulos where estado = 'publicado' and publicado_en <= now()) >= 13,
  'al menos 13 publicados (hay /blog/pagina/2)');
select ok(exists (
    select 1 from public.redirecciones r
    join public.articulos a on a.id = r.entidad_id
    where r.tipo_entidad = 'articulo'
    group by r.entidad_id having count(*) >= 2),
  'un artículo con dos slugs anteriores que apuntan a la misma entidad');

-- Spec 005 (T096): el contenido es el documento; los publicados usan los 12 tipos de elemento.
select is(
  (select array_agg(distinct e ->> 'type' order by e ->> 'type')
     from public.articulos a, jsonb_array_elements(a.contenido -> 'content') e
    where a.estado = 'publicado'),
  (select array_agg(t order by t) from unnest(privado.tipos_elemento()) t),
  'los publicados usan los 12 tipos de elemento del documento');
select ok(exists (
    select 1 from public.articulos a
    where a.estado = 'publicado'
      and jsonb_path_exists(a.contenido, '$.content[*] ? (@.type == "table").**.attrs ? (@.colspan > 1 || @.rowspan > 1)')
      and jsonb_path_exists(a.contenido, '$.content[*].attrs ? (@.textAlign == "center")')
      and jsonb_path_exists(a.contenido, '$.content[*].attrs ? (@.textAlign == "right")')
      and jsonb_path_exists(a.contenido, '$.content[*].attrs ? (@.textAlign == "justify")')),
  'CE-008, RF-027: un publicado con una tabla con celdas combinadas y las alineaciones centro, derecha y justificado');

select is_empty($$
  select 1
  from public.articulos a,
       jsonb_path_query(a.contenido, 'strict $.content[*] ? (@.type == "imagen").attrs.imagen') as img
  where not privado.imagen_valida(img)
  union all
  select 1
  from public.articulos a,
       jsonb_path_query(a.contenido, 'strict $.content[*] ? (@.type == "galeria").attrs.imagenes[*]') as img
  where not privado.imagen_valida(img)
  union all
  select 1 from public.articulos a
  where a.imagen_destacada is not null and not privado.imagen_valida(a.imagen_destacada)
$$, 'toda imagen tiene ruta, ancho, alto y alt');
select is(
  (select count(*)::int from public.articulos where jsonb_typeof(contenido) <> 'object' or contenido ->> 'type' <> 'doc'),
  0, 'spec 005: todos los artículos del seed tienen un documento (ninguno en el formato anterior)');

select * from finish();
rollback;
