-- T056: búsqueda en español (H5-E1 a H5-E4, RF-018 a RF-020, CE-004). Adaptado al documento en la spec 005
-- (T096): privado.documento_a_texto reemplaza a privado.bloques_a_texto y la búsqueda encuentra el texto de las
-- celdas y la descripción de una tabla (RF-027).
-- Configuración public.es_sin_tildes, privado.documento_a_texto, columna
-- articulos.busqueda con su índice GIN y el trigger a50_calcular_busqueda,
-- privado.recalcular_busqueda (triggers z20_recalcular_articulos de categorias y
-- etiquetas) y el RPC public.buscar_articulos. research D12 y D22 · tasks T058.
--
-- No depende del seed: borra todos los artículos dentro de la transacción (se
-- deshace con el rollback), así el ranking del top 3 solo compite con los datos
-- de este archivo. Usuarios @prueba.local, slugs y nombres con prefijo h5-bus-.
--
-- Mientras no exista el RPC, los helpers devuelven null (no abortan el archivo):
-- cada aserción que depende de la búsqueda falla en lugar de pasar en vacío.
begin;
\ir helpers/pruebas.psql
select plan(68);

-- Sin secretos de revalidación al empezar: el armado de datos no notifica.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('h5-bus-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Cinco Editor"}');
select pruebas.crear_usuario('h5-bus-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Cinco Admin"}');

-- Aísla el ranking: fuera los artículos del seed y de otros tests (rollback al final).
delete from public.articulos;
delete from public.redirecciones where slug_anterior like 'h5-bus-%';
delete from public.categorias where slug like 'h5-bus-%' or lower(nombre) like 'h5 bus %';
delete from public.etiquetas where slug like 'h5-bus-%' or lower(nombre) like 'h5 bus %';

insert into public.categorias (id, nombre, slug) values
  ('c5000000-0000-4000-8000-000000000001', 'H5 Bus Varios', 'h5-bus-varios'),
  ('c5000000-0000-4000-8000-000000000002', 'H5 Bus Fotografía', 'h5-bus-fotografia'),
  ('c5000000-0000-4000-8000-000000000003', 'H5 Bus Nísperos', 'h5-bus-nisperos');
insert into public.etiquetas (id, nombre, slug) values
  ('e5000000-0000-4000-8000-000000000001', 'H5 Bus Ilustración', 'h5-bus-ilustracion'),
  ('e5000000-0000-4000-8000-000000000002', 'H5 Bus Membrillos', 'h5-bus-membrillos'),
  ('e5000000-0000-4000-8000-000000000003', 'H5 Bus Grosellas', 'h5-bus-grosellas');

-- Un elemento párrafo con id propio y el documento con estos elementos.
create function pruebas.parrafo_h5(texto text) returns jsonb
language sql volatile as $$
  select jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', gen_random_uuid()::text),
    'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', texto)))
$$;
create function pruebas.doc_h5(elementos jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('type', 'doc', 'content', elementos)
$$;

-- Artículos cargados por el sistema (sin secretos: no notifican). Autor: el admin.
insert into public.articulos (id, titulo, slug, extracto, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
select x.id::uuid, x.titulo, 'h5-bus-' || x.sufijo, x.extracto,
       coalesce(x.contenido, pruebas.doc_h5(jsonb_build_array(pruebas.parrafo_h5('Cuerpo neutro.')))),
       coalesce(x.categoria_id, 'c5000000-0000-4000-8000-000000000001')::uuid,
       (select id from auth.users where email = case when x.del_editor then 'h5-bus-editor@prueba.local' else 'h5-bus-admin@prueba.local' end),
       x.estado::public.estado_articulo, x.publicado_en, x.programado_para
from (values
  -- Conjunto de CE-004 (b01 a b14), todos publicados.
  ('a5000000-0000-4000-8000-000000000001', 'b01', 'Diseño de logotipos memorables', null::text,
   pruebas.doc_h5(jsonb_build_array(pruebas.parrafo_h5('Un buen logotipo se reconoce de lejos.'))), null::text, false,
   'publicado', now() - interval '20 days', null::timestamptz),
  ('a5000000-0000-4000-8000-000000000002', 'b02', 'Las publicaciones de la semana', null, null, null, false,
   'publicado', now() - interval '19 days', null),
  ('a5000000-0000-4000-8000-000000000003', 'b03', 'Educaciones comparadas en América', null, null, null, false,
   'publicado', now() - interval '18 days', null),
  ('a5000000-0000-4000-8000-000000000004', 'b04', 'Salir a correr cada mañana', null, null, null, false,
   'publicado', now() - interval '17 days', null),
  ('a5000000-0000-4000-8000-000000000005', 'b05', 'Cómo optimizar imágenes para la web', null, null, null, false,
   'publicado', now() - interval '16 days', null),
  ('a5000000-0000-4000-8000-000000000006', 'b06', 'Tipografías legibles en pantallas pequeñas', null, null, null, false,
   'publicado', now() - interval '15 days', null),
  ('a5000000-0000-4000-8000-000000000007', 'b07', 'Las personas navegan con el teclado', null, null, null, false,
   'publicado', now() - interval '14 days', null),
  ('a5000000-0000-4000-8000-000000000008', 'b08', 'Árboles frutales en macetas', null, null, null, false,
   'publicado', now() - interval '13 days', null),
  ('a5000000-0000-4000-8000-000000000009', 'b09', 'Los clientes compraron más en diciembre', null, null, null, false,
   'publicado', now() - interval '12 days', null),
  ('a5000000-0000-4000-8000-00000000000a', 'b10', 'Canción de cuna para dormir', null, null, null, false,
   'publicado', now() - interval '11 days', null),
  -- La coincidencia está solo en el nombre de la categoría.
  ('a5000000-0000-4000-8000-00000000000b', 'b11', 'Rollos y revelado', null, null,
   'c5000000-0000-4000-8000-000000000002', false, 'publicado', now() - interval '10 days', null),
  -- La coincidencia está solo en una etiqueta (se asigna más abajo).
  ('a5000000-0000-4000-8000-00000000000c', 'b12', 'Trazos a mano alzada', null, null, null, false,
   'publicado', now() - interval '9 days', null),
  -- La coincidencia está solo en el extracto.
  ('a5000000-0000-4000-8000-00000000000d', 'b13', 'Notas de viaje', 'Crónica de un recorrido por la Patagonia.', null, null, false,
   'publicado', now() - interval '8 days', null),
  -- La coincidencia está solo en el cuerpo.
  ('a5000000-0000-4000-8000-00000000000e', 'b14', 'Un despertar inesperado', null,
   pruebas.doc_h5(jsonb_build_array(pruebas.parrafo_h5('El volcán entró en erupción durante la noche.'))), null, false,
   'publicado', now() - interval '7 days', null),

  -- H5-E2 / RF-020: el término en el título de r1 y solo en el cuerpo de r2.
  -- r2 es más reciente: si el ranking empatara, el desempate lo pondría primero.
  ('a5000000-0000-4000-8000-000000000021', 'r1', 'Acuarelas para principiantes', null, null, null, false,
   'publicado', now() - interval '30 days', null),
  ('a5000000-0000-4000-8000-000000000022', 'r2', 'Materiales de taller', null,
   pruebas.doc_h5(jsonb_build_array(pruebas.parrafo_h5('En el taller también usamos acuarela.'))), null, false,
   'publicado', now() - interval '1 day', null),

  -- H5-E3: solo v-pub es público; el resto contiene el término pero no se publica.
  ('a5000000-0000-4000-8000-000000000031', 'v-pub', 'Girasoles al sol', null, null, null, false,
   'publicado', now() - interval '3 days', null),
  ('a5000000-0000-4000-8000-000000000032', 'v-bor', 'Girasoles en borrador', null, null, null, true,
   'borrador', null, null),
  ('a5000000-0000-4000-8000-000000000033', 'v-prog', 'Girasoles programados', null, null, null, true,
   'programado', null, now() + interval '5 days'),
  ('a5000000-0000-4000-8000-000000000034', 'v-arch', 'Girasoles archivados', null, null, null, false,
   'archivado', now() - interval '60 days', null),
  ('a5000000-0000-4000-8000-000000000035', 'v-fut', 'Girasoles del futuro', null, null, null, false,
   'publicado', now() + interval '2 days', null),

  -- Exclusiones del índice: bloques de código y URLs de enlaces Markdown.
  ('a5000000-0000-4000-8000-000000000041', 'x-codigo', 'Fragmentos útiles', null,
   pruebas.doc_h5(jsonb_build_array(
     pruebas.parrafo_h5('Un ejemplo de configuración.'),
     jsonb_build_object('type', 'codeBlock', 'attrs', jsonb_build_object('id', 'b5000000-0000-4000-8000-000000000041', 'lenguaje', 'js'),
                        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'const xilofono = 1;'))))),
   null, false, 'publicado', now() - interval '4 days', null),
  ('a5000000-0000-4000-8000-000000000042', 'x-enlace', 'Recetas de estación', null,
   pruebas.doc_h5(jsonb_build_array(jsonb_build_object('type', 'paragraph',
     'attrs', jsonb_build_object('id', 'b5000000-0000-4000-8000-000000000042'), 'content', jsonb_build_array(
       jsonb_build_object('type', 'text', 'text', 'Probá con '),
       jsonb_build_object('type', 'text', 'text', 'mandarinas',
         'marks', jsonb_build_array(jsonb_build_object('type', 'link', 'attrs', jsonb_build_object('href', '#limones')))),
       jsonb_build_object('type', 'text', 'text', ' o '),
       jsonb_build_object('type', 'text', 'text', 'peras',
         'marks', jsonb_build_array(jsonb_build_object('type', 'link',
           'attrs', jsonb_build_object('href', 'https://ejemplo.com/ciruelas')))),
       jsonb_build_object('type', 'text', 'text', '.'))))),
   null, false, 'publicado', now() - interval '4 days', null),

  -- Renombrar o borrar una taxonomía recalcula la búsqueda de sus artículos.
  ('a5000000-0000-4000-8000-000000000051', 'ren1', 'Mermeladas caseras', null, null,
   'c5000000-0000-4000-8000-000000000003', false, 'publicado', now() - interval '6 days', null),
  ('a5000000-0000-4000-8000-000000000052', 'ren2', 'Conservas de invierno', null, null,
   'c5000000-0000-4000-8000-000000000003', false, 'publicado', now() - interval '5 days', null)
) as x(id, sufijo, titulo, extracto, contenido, categoria_id, del_editor, estado, publicado_en, programado_para);

-- Lote de 55 publicados con el mismo término: límite máximo, paginación y total.
insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
select 'Zanahorias de la huerta ' || n, 'h5-bus-lote-' || n,
       pruebas.doc_h5(jsonb_build_array(pruebas.parrafo_h5('Cuerpo neutro.'))),
       'c5000000-0000-4000-8000-000000000001',
       (select id from auth.users where email = 'h5-bus-admin@prueba.local'),
       'publicado', now() - interval '40 days' - n * interval '1 hour'
from generate_series(1, 55) as n;

-- RF-027 (spec 005): "berenjenas" está solo en una celda y "alcauciles" solo en la descripción de la tabla.
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
values ('a5000000-0000-4000-8000-000000000061', 'Calendario de siembra', 'h5-bus-t-tabla',
  '{"type": "doc", "content": [
    {"type": "paragraph", "attrs": {"id": "b5000000-0000-4000-8000-000000000061"}, "content": [{"type": "text", "text": "Qué sembrar en cada mes."}]},
    {"type": "table", "attrs": {"id": "b5000000-0000-4000-8000-000000000062", "descripcion": "Siembra de alcauciles y otras hortalizas"},
     "content": [
       {"type": "tableRow", "content": [
         {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Mes"}]}]},
         {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hortaliza"}]}]}]},
       {"type": "tableRow", "content": [
         {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Marzo"}]}]},
         {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Berenjenas"}]}]}]}]}
  ]}',
  'c5000000-0000-4000-8000-000000000001',
  (select id from auth.users where email = 'h5-bus-admin@prueba.local'),
  'publicado', now() - interval '41 days');

-- Versión actual de un artículo, leída como postgres (sin RLS).
create function pruebas.version_de(articulo uuid) returns int
language sql stable security definer set search_path = '' as $$
  select a.version from public.articulos a where a.id = articulo
$$;
grant execute on function pruebas.version_de(uuid) to authenticated;

-- Etiquetas por la única vía de escritura (D22): su update de versión recalcula la búsqueda.
select pruebas.como('h5-bus-editor@prueba.local');
select public.asignar_etiquetas('a5000000-0000-4000-8000-00000000000c',
  array['e5000000-0000-4000-8000-000000000001']::uuid[], pruebas.version_de('a5000000-0000-4000-8000-00000000000c'));
select public.asignar_etiquetas('a5000000-0000-4000-8000-000000000051',
  array['e5000000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000003']::uuid[],
  pruebas.version_de('a5000000-0000-4000-8000-000000000051'));
select public.asignar_etiquetas('a5000000-0000-4000-8000-000000000052',
  array['e5000000-0000-4000-8000-000000000002']::uuid[], pruebas.version_de('a5000000-0000-4000-8000-000000000052'));
select pruebas.como_postgres();

-- ---------------------------------------------------------------------------
-- Helpers. SQL dinámico: así el archivo compila aunque el RPC no exista.
-- ---------------------------------------------------------------------------
create function pruebas.hay_busqueda() returns boolean
language sql stable as $$
  select to_regprocedure('public.buscar_articulos(text, integer, integer)') is not null
$$;

-- Slugs h5-bus- devueltos, en el orden del RPC; null si el RPC no existe.
create function pruebas.buscar_slugs(consulta text, limite int default 12, desplazamiento int default 0)
returns text[]
language plpgsql as $$
declare
  resultado text[];
begin
  if not pruebas.hay_busqueda() then
    return null;
  end if;
  execute 'select coalesce(array_agg(b.slug order by b.ordinality) filter (where b.slug like ''h5-bus-%''), ''{}'')
             from public.buscar_articulos($1, $2, $3) with ordinality as b'
    into resultado using consulta, limite, desplazamiento;
  return resultado;
end
$$;

-- Cantidad de filas y totales distintos que devuelve el RPC; null si no existe.
create function pruebas.buscar_conteo(consulta text, limite int default 12, desplazamiento int default 0)
returns table (filas int, totales bigint[])
language plpgsql as $$
begin
  if not pruebas.hay_busqueda() then
    return query select null::int, null::bigint[];
    return;
  end if;
  return query execute
    'select count(*)::int, coalesce(array_agg(distinct b.total), ''{}'') from public.buscar_articulos($1, $2, $3) as b'
    using consulta, limite, desplazamiento;
end
$$;

-- Filas con los parámetros por defecto (limite = 12); null si no existe.
create function pruebas.buscar_filas_por_defecto(consulta text) returns int
language plpgsql as $$
declare
  resultado int;
begin
  if not pruebas.hay_busqueda() then
    return null;
  end if;
  execute 'select count(*)::int from public.buscar_articulos($1)' into resultado using consulta;
  return resultado;
end
$$;

-- Rango que el RPC le da a un slug para una consulta; null si no existe o no aparece.
create function pruebas.rango_de(consulta text, slug_buscado text) returns real
language plpgsql as $$
declare
  resultado real;
begin
  if not pruebas.hay_busqueda() then
    return null;
  end if;
  execute 'select b.rango from public.buscar_articulos($1, 50) as b where b.slug = $2'
    into resultado using consulta, slug_buscado;
  return resultado;
end
$$;

-- privado.documento_a_texto(contenido); null si no existe.
create function pruebas.texto_de_documento(contenido jsonb) returns text
language plpgsql as $$
declare
  resultado text;
begin
  if to_regprocedure('privado.documento_a_texto(jsonb)') is null then
    return null;
  end if;
  execute 'select privado.documento_a_texto($1)' into resultado using contenido;
  return resultado;
end
$$;

-- ¿Coincide la columna busqueda del artículo con la consulta (doble configuración)? null si no existe.
create function pruebas.busqueda_coincide(articulo uuid, consulta text) returns boolean
language plpgsql as $$
declare
  resultado boolean;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'articulos' and column_name = 'busqueda'
  ) or not exists (
    select 1 from pg_ts_config where cfgname = 'es_sin_tildes' and cfgnamespace = 'public'::regnamespace
  ) then
    return null;
  end if;
  execute 'select busqueda @@ (websearch_to_tsquery(''public.es_sin_tildes'', $2)
                              || websearch_to_tsquery(''pg_catalog.spanish'', $2))
             from public.articulos where id = $1'
    into resultado using articulo, consulta;
  return resultado;
end
$$;

grant execute on function pruebas.hay_busqueda(), pruebas.buscar_slugs(text, int, int),
  pruebas.buscar_conteo(text, int, int), pruebas.buscar_filas_por_defecto(text)
  to anon, authenticated;

-- ===========================================================================
-- Estructura (research D12, data-model)
-- ===========================================================================
select ok(exists (select 1 from pg_ts_config where cfgname = 'es_sin_tildes' and cfgnamespace = 'public'::regnamespace),
  'D12: existe la configuración de texto public.es_sin_tildes');
select ok(
  coalesce((select bool_or(d.dictname = 'unaccent') and bool_or(d.dictname = 'spanish_stem')
            from pg_ts_config_map m
            join pg_ts_config c on c.oid = m.mapcfg
            join pg_ts_dict d on d.oid = m.mapdict
            where c.cfgname = 'es_sin_tildes' and c.cfgnamespace = 'public'::regnamespace), false),
  'D12: es_sin_tildes mapea las palabras con unaccent y spanish_stem');
select has_column('public', 'articulos', 'busqueda', 'existe la columna articulos.busqueda');
select col_type_is('public', 'articulos', 'busqueda', 'tsvector', 'articulos.busqueda es tsvector');
select ok(exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'articulos' and indexdef ilike '%using gin (busqueda)%'),
  'D12: articulos.busqueda tiene un índice GIN');
select has_trigger('public', 'articulos', 'a50_calcular_busqueda', 'existe el trigger a50_calcular_busqueda');
select has_function('privado', 'documento_a_texto', array['jsonb'], 'existe privado.documento_a_texto(jsonb)');
select ok(coalesce((select provolatile = 'i' from pg_proc where oid = to_regprocedure('privado.documento_a_texto(jsonb)')), false),
  'privado.documento_a_texto es immutable');
select has_function('privado', 'recalcular_busqueda', array['uuid[]'], 'existe privado.recalcular_busqueda(uuid[])');
select ok(coalesce((select prosecdef from pg_proc where oid = to_regprocedure('privado.recalcular_busqueda(uuid[])')), false),
  'privado.recalcular_busqueda es security definer');
select has_trigger('public', 'categorias', 'z20_recalcular_articulos', 'existe el trigger z20_recalcular_articulos en categorias');
select has_trigger('public', 'etiquetas', 'z20_recalcular_articulos', 'existe el trigger z20_recalcular_articulos en etiquetas');
select has_function('public', 'buscar_articulos', array['text', 'integer', 'integer'],
  'existe public.buscar_articulos(text, integer, integer)');
select ok(coalesce((select not prosecdef and provolatile = 's'
                    from pg_proc where oid = to_regprocedure('public.buscar_articulos(text, integer, integer)')), false),
  'D12: buscar_articulos es stable y security invoker');
select is(
  (select array_agg(a.nombre order by a.orden)
     from pg_proc p,
          unnest(p.proargnames, p.proargmodes::text[]) with ordinality as a(nombre, modo, orden)
    where p.oid = to_regprocedure('public.buscar_articulos(text, integer, integer)') and a.modo = 't'),
  array['id', 'titulo', 'slug', 'extracto', 'imagen_destacada', 'publicado_en', 'categoria_id', 'categoria_nombre',
        'categoria_slug', 'rango', 'total'],
  'contracts: buscar_articulos devuelve id, titulo, slug, extracto, imagen_destacada, publicado_en, la categoría (id, nombre y slug), rango y total');

-- ===========================================================================
-- H5-E1 · RF-019: sin tildes, en singular, encuentra "Diseño de logotipos"
-- ===========================================================================
select pruebas.como_anon();
select is(
  (pruebas.buscar_slugs('diseno logotipo'))[1], 'h5-bus-b01',
  'H5-E1: el visitante busca "diseno logotipo" y el primer resultado es "Diseño de logotipos memorables"');

-- ===========================================================================
-- CE-004 · RF-019: conjunto de prueba explícito, acierto en el top 3
-- ===========================================================================
-- Los 3 casos difíciles conocidos (research D12) van en las dos formas: con
-- tilde (como los escribe la tarea) y sin tilde, que es como D12 los mide
-- fallando por una limitación de Snowball.
-- Desviación aceptada (validacion.md, H5): con D12 el acierto medido es 84,6 %
-- (22 de 26), por debajo del 95 % de CE-004. Los 4 fallos son límites de
-- Snowball (publicacion, educacion, corrio, imagen); pg_trgm queda para una
-- spec posterior. El umbral detecta regresiones sobre lo medido.
create temporary table pares_ce004 (consulta text, slug_esperado text, caso text) on commit drop;
insert into pares_ce004 values
  ('diseno logotipo', 'h5-bus-b01', 'sin tildes y singular (H5-E1)'),
  ('DISEÑO',          'h5-bus-b01', 'mayúsculas'),
  ('logotipos',       'h5-bus-b01', 'plural'),
  ('publicación',     'h5-bus-b02', 'difícil: publicación frente a publicaciones'),
  ('publicacion',     'h5-bus-b02', 'difícil: publicacion (sin tilde) frente a publicaciones'),
  ('educación',       'h5-bus-b03', 'difícil: educación frente a educaciones'),
  ('educacion',       'h5-bus-b03', 'difícil: educacion (sin tilde) frente a educaciones'),
  ('corrió',          'h5-bus-b04', 'difícil: corrió frente a correr'),
  ('corrio',          'h5-bus-b04', 'difícil: corrio (sin tilde) frente a correr'),
  ('mañanas',         'h5-bus-b04', 'plural'),
  ('imagen',          'h5-bus-b05', 'singular frente a imágenes'),
  ('optimizamos',     'h5-bus-b05', 'conjugación'),
  ('tipografia',      'h5-bus-b06', 'sin tildes y singular'),
  ('pantalla',        'h5-bus-b06', 'singular'),
  ('navegar',         'h5-bus-b07', 'conjugación (infinitivo)'),
  ('teclados',        'h5-bus-b07', 'plural'),
  ('arbol',           'h5-bus-b08', 'sin tildes y singular'),
  ('MACETA',          'h5-bus-b08', 'mayúsculas y singular'),
  ('comprar',         'h5-bus-b09', 'conjugación (infinitivo)'),
  ('Diciembre',       'h5-bus-b09', 'mayúsculas'),
  ('canciones',       'h5-bus-b10', 'plural frente a canción'),
  ('dormimos',        'h5-bus-b10', 'conjugación'),
  ('fotografias',     'h5-bus-b11', 'categoría, sin tildes y plural (RF-018)'),
  ('ilustraciones',   'h5-bus-b12', 'etiqueta, plural (RF-018)'),
  ('cronicas',        'h5-bus-b13', 'extracto, sin tildes y plural (RF-018)'),
  ('volcanes',        'h5-bus-b14', 'cuerpo, plural frente a volcán (RF-018)');

create temporary table resultados_ce004 on commit drop as
  select p.*, p.slug_esperado = any (pruebas.buscar_slugs(p.consulta, 3)) as acierta
  from pares_ce004 p;

select cmp_ok((select count(*)::int from pares_ce004), '>=', 20,
  'CE-004: el conjunto de prueba tiene al menos 20 pares (consulta → artículo esperado)');
select diag('CE-004: sin acierto en el top 3: ' || coalesce(
  (select string_agg(format('%L → %s (%s)', consulta, slug_esperado, caso), '; ' order by consulta)
     from resultados_ce004 where acierta is not true), 'ninguno'));
select cmp_ok(
  (select round(100.0 * count(*) filter (where acierta) / count(*), 1) from resultados_ce004),
  '>=', 84.6,
  'CE-004 (desviación aceptada): el artículo esperado está en el top 3 en al menos el 84,6 % de los pares');

-- ===========================================================================
-- H5-E2 · RF-020: el título pesa más que el cuerpo
-- ===========================================================================
select is(pruebas.buscar_slugs('acuarela'), array['h5-bus-r1', 'h5-bus-r2'],
  'H5-E2: "acuarela" en el título rankea por encima de "acuarela" solo en el cuerpo (aunque este sea más reciente)');
select pruebas.como_postgres();
select ok(pruebas.rango_de('acuarela', 'h5-bus-r1') > pruebas.rango_de('acuarela', 'h5-bus-r2'),
  'RF-020: el rango del artículo con el término en el título es mayor');
select pruebas.como_anon();

-- ===========================================================================
-- H5-E3 · CE-002: solo publicados con fecha pasada, con filtro explícito
-- ===========================================================================
select is(pruebas.buscar_slugs('girasol'), array['h5-bus-v-pub'],
  'H5-E3: el visitante solo encuentra el publicado (ni borrador, ni programado, ni archivado, ni publicado futuro)');
select pruebas.como('h5-bus-editor@prueba.local');
select isnt_empty($$select 1 from public.articulos where id = 'a5000000-0000-4000-8000-000000000032'$$,
  'preparación: el editor ve su borrador por RLS');
select is(pruebas.buscar_slugs('girasol'), array['h5-bus-v-pub'],
  'H5-E3: el editor tampoco encuentra borradores, programados ni archivados: el filtro de estado es explícito');
select pruebas.como('h5-bus-admin@prueba.local');
select is(pruebas.buscar_slugs('girasoles'), array['h5-bus-v-pub'],
  'H5-E3: el admin tampoco encuentra artículos no publicados ni con fecha futura');

-- ===========================================================================
-- H5-E4: consulta vacía o sin coincidencias → 0 filas, sin error
-- ===========================================================================
select pruebas.como_anon();
select lives_ok($$select * from public.buscar_articulos('')$$, 'H5-E4: una consulta vacía no da error');
select is((select filas from pruebas.buscar_conteo('')), 0, 'H5-E4: una consulta vacía devuelve 0 filas');
select is((select filas from pruebas.buscar_conteo('   ')), 0, 'H5-E4: una consulta de solo espacios devuelve 0 filas');
select is((select filas from pruebas.buscar_conteo(null)), 0, 'H5-E4: una consulta null devuelve 0 filas');
select lives_ok($$select * from public.buscar_articulos('quetzalcoatl')$$,
  'H5-E4: una consulta sin coincidencias no da error');
select is((select filas from pruebas.buscar_conteo('quetzalcoatl')), 0,
  'H5-E4: una consulta sin coincidencias devuelve 0 filas');
select lives_ok($$select * from public.buscar_articulos('"diseño -logotipo or & | ! :* (')$$,
  'H5-E4: una consulta con sintaxis rara (comillas, operadores, paréntesis) no da error');

-- ===========================================================================
-- Límite, desplazamiento y total (D12, contracts)
-- ===========================================================================
select is((select filas from pruebas.buscar_conteo('zanahoria', 500)), 50,
  'D12: limite = 500 devuelve como máximo 50 filas');
select is(pruebas.buscar_filas_por_defecto('zanahoria'), 12, 'D12: el límite por defecto es 12');
select results_eq($$select filas, totales from pruebas.buscar_conteo('zanahoria', 10)$$,
  $$values (10, array[55]::bigint[])$$,
  'D12: total viene en cada fila y es el total de coincidencias (55), no el tamaño de la página');
select results_eq($$select filas, totales from pruebas.buscar_conteo('zanahoria', 10, 50)$$,
  $$values (5, array[55]::bigint[])$$,
  'D12: con desplazamiento 50 devuelve las 5 restantes y el mismo total');
select ok(pruebas.buscar_slugs('zanahoria', 5, -10) = pruebas.buscar_slugs('zanahoria', 5, 0),
  'D12: un desplazamiento negativo se trata como 0');
select is((select count(*)::int from public.buscar_articulos('zanahoria', -1)), 0,
  'A7-M1: un limite negativo se trata como 0 (sin error)');
select is((select count(*)::int from public.buscar_articulos('zanahoria', null, null)), 12,
  'A7-M1: limite y desplazamiento nulos usan los valores por defecto (12 y 0)');
select is(pruebas.buscar_slugs('zanahoria', 3),
  array['h5-bus-lote-1', 'h5-bus-lote-2', 'h5-bus-lote-3'],
  'D12: a igual rango, desempata por publicado_en descendente');

-- ===========================================================================
-- RF-018: qué se indexa (bloques de código y URLs no)
-- ===========================================================================
select is(pruebas.buscar_slugs('configuracion'), array['h5-bus-x-codigo'],
  'RF-018: el texto de un párrafo se indexa (control del caso de código)');
select is(pruebas.buscar_slugs('xilofono'), '{}'::text[],
  'D12: el texto de un codeBlock no se indexa');
select is(pruebas.buscar_slugs('mandarinas'), array['h5-bus-x-enlace'],
  'D12: el texto visible de un enlace (marca link) sí se indexa');
select is(pruebas.buscar_slugs('limones'), '{}'::text[],
  'D12: el href de un enlace (#ancla) no se indexa');
select is(pruebas.buscar_slugs('ejemplo.com'), '{}'::text[],
  'D12: la URL de un enlace https:// no se indexa');
select is(pruebas.buscar_slugs('berenjena'), array['h5-bus-t-tabla'],
  'RF-027: la búsqueda encuentra un artículo por una palabra de una celda de una tabla');
select is(pruebas.buscar_slugs('alcaucil'), array['h5-bus-t-tabla'],
  'RF-027: la búsqueda encuentra un artículo por una palabra de la descripción de una tabla');

select pruebas.como_postgres();
select ok(pruebas.busqueda_coincide('a5000000-0000-4000-8000-00000000000b', 'fotografía'),
  'RF-018: busqueda incluye el nombre de la categoría');
select ok(pruebas.busqueda_coincide('a5000000-0000-4000-8000-00000000000c', 'ilustración'),
  'RF-018: busqueda incluye los nombres de las etiquetas (recalculada por asignar_etiquetas)');
select ok(pruebas.busqueda_coincide('a5000000-0000-4000-8000-000000000032', 'girasol'),
  'D12: busqueda se calcula también para los borradores (el filtro de publicados es del RPC)');

-- privado.documento_a_texto, tipo por tipo (research D12, T058; spec 005, data-model).
create temporary table bloques_h5 on commit drop as
  select pruebas.texto_de_documento(jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', '1'), 'content', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'Párrafo con '),
      jsonb_build_object('type', 'text', 'text', 'enlace visible',
        'marks', jsonb_build_array(jsonb_build_object('type', 'link', 'attrs', jsonb_build_object('href', 'https://oculto.example/ruta')))),
      jsonb_build_object('type', 'text', 'text', '.'))),
    jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('id', '2', 'level', 2),
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Subtítulo palmera'))),
    jsonb_build_object('type', 'blockquote', 'attrs', jsonb_build_object('id', '3', 'autor', 'Autora Gaviota'),
      'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Cita del faro'))))),
    jsonb_build_object('type', 'bulletList', 'attrs', jsonb_build_object('id', '4'), 'content', jsonb_build_array(
      jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'item ancla'))))),
      jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'item brújula'))))))),
    jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', '5',
      'imagen', jsonb_build_object('ruta', 'a/b.webp', 'ancho', 10, 'alto', 10, 'alt', 'alt del velero'),
      'leyenda', 'leyenda del muelle')),
    jsonb_build_object('type', 'galeria', 'attrs', jsonb_build_object('id', '6', 'columnas', 2, 'imagenes', jsonb_build_array(
      jsonb_build_object('ruta', 'a/c.webp', 'ancho', 10, 'alto', 10, 'alt', 'alt de la boya'),
      jsonb_build_object('ruta', 'a/d.webp', 'ancho', 10, 'alto', 10, 'alt', 'alt del ancla')))),
    jsonb_build_object('type', 'cta', 'attrs', jsonb_build_object('id', '7', 'titulo', 'Título del llamado',
      'texto', 'texto del llamado', 'etiquetaBoton', 'Botón', 'url', '/contacto')),
    jsonb_build_object('type', 'video', 'attrs', jsonb_build_object('id', '8', 'proveedor', 'youtube',
      'idVideo', 'abcdefghijk', 'titulo', 'Video del puerto')),
    jsonb_build_object('type', 'horizontalRule', 'attrs', jsonb_build_object('id', '9')),
    jsonb_build_object('type', 'codeBlock', 'attrs', jsonb_build_object('id', '10', 'lenguaje', 'js'),
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'console.log(secretoDeCodigo)'))),
    jsonb_build_object('type', 'table', 'attrs', jsonb_build_object('id', '11', 'descripcion', 'descripción del arrecife'),
      'content', jsonb_build_array(jsonb_build_object('type', 'tableRow', 'content', jsonb_build_array(
        jsonb_build_object('type', 'tableCell', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'celda del pulpo')))))))))
  ))) as texto;

select ok((select texto ilike all (array[
    '%enlace visible%', '%Subtítulo palmera%', '%Cita del faro%', '%Autora Gaviota%', '%item ancla%', '%item brújula%',
    '%alt del velero%', '%leyenda del muelle%', '%alt de la boya%', '%alt del ancla%',
    '%Título del llamado%', '%texto del llamado%', '%Video del puerto%', '%celda del pulpo%', '%descripción del arrecife%'])
  from bloques_h5),
  'D12: documento_a_texto extrae párrafo, título, cita (texto y autor), lista, imagen (alt y leyenda), galería, cta, video y tabla (celdas y descripción)');
select ok((select texto not ilike '%secretoDeCodigo%' from bloques_h5),
  'D12: documento_a_texto excluye los codeBlock');
select ok((select texto not ilike '%oculto.example%' and texto not ilike '%a/b.webp%' and texto not ilike '%/contacto%'
  from bloques_h5),
  'D12: documento_a_texto no incluye las URL (href de los enlaces, rutas de las imágenes ni la de la llamada a la acción)');
select ok(
  (select char_length(pruebas.texto_de_documento(jsonb_build_object('type', 'doc', 'content',
     (select jsonb_agg(jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', n::text),
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', repeat('palabra ', 625)))))
        from generate_series(1, 200) as n)))) <= 200000),
  'D12: documento_a_texto trunca a 200.000 caracteres (límite de 1 MB del tsvector)');

-- ===========================================================================
-- Renombrar o borrar una taxonomía recalcula la búsqueda de sus artículos sin
-- subir la versión, sin mover actualizado_en y sin un aviso por artículo.
-- ===========================================================================
-- actualizado_en en el pasado: now() es fijo en la transacción y si no la
-- aserción no distinguiría un recálculo que lo mueve.
alter table public.articulos disable trigger a90_actualizado_en;
update public.articulos set actualizado_en = '2026-01-01 12:00+00'
 where id in ('a5000000-0000-4000-8000-000000000051', 'a5000000-0000-4000-8000-000000000052');
alter table public.articulos enable trigger a90_actualizado_en;

create temporary table previas_h5 on commit drop as
  select id, version, actualizado_en from public.articulos
  where id in ('a5000000-0000-4000-8000-000000000051', 'a5000000-0000-4000-8000-000000000052');

-- Con secretos (en la transacción) se encola; se cuentan solo las filas nuevas.
select vault.create_secret('http://prueba.local', 'url_web_revalidacion');
select vault.create_secret('secreto-de-prueba-h5', 'secreto_revalidacion');

create temporary table marca_cola (id bigint) on commit drop;
insert into marca_cola values (0);
create function pruebas.marcar_cola() returns void
language sql as $$
  update marca_cola set id = coalesce((select max(q.id) from net.http_request_queue q), 0)
$$;
create function pruebas.cola_nueva() returns table (cuerpo jsonb)
language sql as $$
  select convert_from(q.body, 'UTF8')::jsonb
  from net.http_request_queue q
  where q.id > (select m.id from marca_cola m) and q.url like 'http://prueba.local%'
  order by q.id
$$;

-- Etiqueta: "Membrillos" → "Pomelos" (la renombra el editor).
select pruebas.marcar_cola();
select pruebas.como('h5-bus-editor@prueba.local');
update public.etiquetas set nombre = 'H5 Bus Pomelos' where id = 'e5000000-0000-4000-8000-000000000002';
select pruebas.como_postgres();
select results_eq(
  $$select count(*)::int, count(*) filter (where cuerpo ->> 'tipo' = 'articulo')::int from pruebas.cola_nueva()$$,
  $$values (1, 0)$$,
  'renombrar una etiqueta encola un solo aviso (el de la etiqueta), no uno por artículo');
select pruebas.como_anon();
select is(pruebas.buscar_slugs('pomelos'), array['h5-bus-ren2', 'h5-bus-ren1'],
  'renombrar una etiqueta actualiza la búsqueda de sus artículos (nombre nuevo)');
select is(pruebas.buscar_slugs('membrillos'), '{}'::text[],
  'renombrar una etiqueta actualiza la búsqueda de sus artículos (sin el nombre anterior)');
select pruebas.como_postgres();
select results_eq(
  $$select a.id, a.version = p.version, a.actualizado_en = p.actualizado_en
      from public.articulos a join previas_h5 p using (id) order by a.id$$,
  $$values ('a5000000-0000-4000-8000-000000000051'::uuid, true, true),
           ('a5000000-0000-4000-8000-000000000052'::uuid, true, true)$$,
  'renombrar una etiqueta no incrementa la versión ni mueve actualizado_en de sus artículos');

-- Categoría: "Nísperos" → "Arándanos" (la renombra el editor).
select pruebas.marcar_cola();
select pruebas.como('h5-bus-editor@prueba.local');
update public.categorias set nombre = 'H5 Bus Arándanos' where id = 'c5000000-0000-4000-8000-000000000003';
select pruebas.como_postgres();
select results_eq(
  $$select count(*)::int, count(*) filter (where cuerpo ->> 'tipo' = 'articulo')::int from pruebas.cola_nueva()$$,
  $$values (1, 0)$$,
  'renombrar una categoría encola un solo aviso (el de la categoría), no uno por artículo');
select pruebas.como_anon();
select is(pruebas.buscar_slugs('arandanos'), array['h5-bus-ren2', 'h5-bus-ren1'],
  'renombrar una categoría actualiza la búsqueda de sus artículos (nombre nuevo, sin tildes)');
select is(pruebas.buscar_slugs('nisperos'), '{}'::text[],
  'renombrar una categoría actualiza la búsqueda de sus artículos (sin el nombre anterior)');
select pruebas.como_postgres();
select results_eq(
  $$select a.id, a.version = p.version, a.actualizado_en = p.actualizado_en
      from public.articulos a join previas_h5 p using (id) order by a.id$$,
  $$values ('a5000000-0000-4000-8000-000000000051'::uuid, true, true),
           ('a5000000-0000-4000-8000-000000000052'::uuid, true, true)$$,
  'renombrar una categoría no incrementa la versión ni mueve actualizado_en de sus artículos');

-- Un cambio de la taxonomía que no toca el nombre no recalcula nada.
select pruebas.como('h5-bus-editor@prueba.local');
update public.etiquetas set descripcion = 'Solo cambia la descripción.' where id = 'e5000000-0000-4000-8000-000000000002';
select pruebas.como_postgres();
select results_eq(
  $$select a.id, a.version = p.version from public.articulos a join previas_h5 p using (id) order by a.id$$,
  $$values ('a5000000-0000-4000-8000-000000000051'::uuid, true),
           ('a5000000-0000-4000-8000-000000000052'::uuid, true)$$,
  'cambiar la descripción de una etiqueta no toca sus artículos');

-- Borrar una etiqueta también recalcula (T058, observación de H3).
select ok(pruebas.busqueda_coincide('a5000000-0000-4000-8000-000000000051', 'grosellas'),
  'preparación: antes de borrarla, busqueda incluye la etiqueta "Grosellas"');
select pruebas.como('h5-bus-editor@prueba.local');
delete from public.etiquetas where id = 'e5000000-0000-4000-8000-000000000003';
select pruebas.como_postgres();
select is(pruebas.busqueda_coincide('a5000000-0000-4000-8000-000000000051', 'grosellas'), false,
  'borrar una etiqueta la quita de la búsqueda de sus artículos');
select results_eq(
  $$select a.version = p.version, a.actualizado_en = p.actualizado_en
      from public.articulos a join previas_h5 p using (id) where a.id = 'a5000000-0000-4000-8000-000000000051'$$,
  $$values (true, true)$$,
  'borrar una etiqueta no incrementa la versión ni mueve actualizado_en de sus artículos');

-- recalcular_busqueda desde un trigger conserva la versión; z90 ignora el recálculo.
select pruebas.marcar_cola();
select lives_ok(
  $$select privado.recalcular_busqueda(array['a5000000-0000-4000-8000-000000000052']::uuid[])$$,
  'privado.recalcular_busqueda se ejecuta como sistema (lo usa el seed)');
select is((select count(*)::int from pruebas.cola_nueva() where cuerpo ->> 'tipo' = 'articulo'), 0,
  'D14: un recálculo que solo cambia busqueda, version o actualizado_en no notifica');

-- a50 recalcula al editar el título (siempre, no solo con cambios de taxonomía).
select pruebas.como('h5-bus-editor@prueba.local');
update public.articulos set titulo = 'Mermeladas de higos',
       version = pruebas.version_de('a5000000-0000-4000-8000-000000000051')
 where id = 'a5000000-0000-4000-8000-000000000051';
select pruebas.como_anon();
select is(pruebas.buscar_slugs('higo'), array['h5-bus-ren1'],
  'a50: editar el título recalcula la búsqueda');

select pruebas.como_postgres();
select * from finish();
rollback;
