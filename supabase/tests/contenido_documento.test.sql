-- T096 (spec 005, ampliación): la base sobre el documento (data-model "Migración 20261023120000_contenido_documento"
-- y "Pruebas pgTAP"; constitución §VI.4 y §IX.4; research D31 A1 a A9).
-- privado.tipos_elemento(), privado.contenido_valido(jsonb) (forma mínima del documento),
-- privado.documento_tiene_contenido(jsonb) (requisito de publicación), privado.documento_a_texto(jsonb) (texto de la
-- búsqueda), el default de articulos.contenido, los dos checks recreados y validados, y las funciones de
-- a40_validar_estado y a50_calcular_busqueda.
--
-- Firmas propuestas (T105), todas con set search_path = '' e immutable:
--   privado.tipos_elemento() returns text[]
--   privado.contenido_valido(contenido jsonb) returns boolean           (create or replace; nunca NULL)
--   privado.documento_tiene_contenido(contenido jsonb) returns boolean  (nunca NULL)
--   privado.documento_a_texto(contenido jsonb) returns text             ('' con un arreglo)
--
-- Mientras la migración no exista, las funciones nuevas se llaman con SQL dinámico desde helpers que devuelven
-- NULL: cada aserción falla por separado en lugar de abortar el archivo.
begin;
\ir helpers/pruebas.psql
select plan(42);

select pruebas.crear_usuario('cd-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Ce De Editor"}');

-- ---------------------------------------------------------------------------
-- Helpers (SQL dinámico: el archivo compila aunque las funciones no existan)
-- ---------------------------------------------------------------------------
create function pruebas.cd_booleano(funcion text, contenido jsonb) returns boolean
language plpgsql as $$
declare
  resultado boolean;
begin
  if to_regprocedure(format('privado.%I(jsonb)', funcion)) is null then
    return null;
  end if;
  execute format('select privado.%I($1)', funcion) into resultado using contenido;
  return resultado;
end
$$;
create function pruebas.cd_texto(contenido jsonb) returns text
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
create function pruebas.cd_tipos() returns text[]
language plpgsql as $$
declare
  resultado text[];
begin
  if to_regprocedure('privado.tipos_elemento()') is null then
    return null;
  end if;
  execute 'select privado.tipos_elemento()' into resultado;
  return resultado;
end
$$;
-- Atajos para armar documentos.
create function pruebas.cd_doc(elementos jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('type', 'doc', 'content', elementos)
$$;
create function pruebas.cd_parrafo(id text, texto text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', id),
    'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', texto)))
$$;
-- Una tabla de una fila y dos celdas con estos textos (un texto vacío es una celda vacía).
create function pruebas.cd_tabla(id text, celda1 text, celda2 text, descripcion text default null) returns jsonb
language sql immutable as $$
  select jsonb_build_object('type', 'table',
    'attrs', jsonb_build_object('id', id)
      || case when descripcion is null then '{}'::jsonb else jsonb_build_object('descripcion', descripcion) end,
    'content', jsonb_build_array(jsonb_build_object('type', 'tableRow', 'content', (
      select jsonb_agg(jsonb_build_object('type', 'tableCell', 'content', jsonb_build_array(
        case when c = '' then jsonb_build_object('type', 'paragraph')
             else jsonb_build_object('type', 'paragraph', 'content',
                    jsonb_build_array(jsonb_build_object('type', 'text', 'text', c))) end)) order by i)
      from unnest(array[celda1, celda2]) with ordinality as x(c, i)))))
$$;

-- Los doce tipos de primer nivel, cada uno con su forma mínima.
create function pruebas.cd_doce_tipos() returns jsonb
language sql immutable as $$
  select pruebas.cd_doc(jsonb_build_array(
    pruebas.cd_parrafo('e1', 'Un párrafo'),
    jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('id', 'e2', 'level', 2),
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Un título'))),
    jsonb_build_object('type', 'bulletList', 'attrs', jsonb_build_object('id', 'e3'), 'content', '[]'::jsonb),
    jsonb_build_object('type', 'orderedList', 'attrs', jsonb_build_object('id', 'e4'), 'content', '[]'::jsonb),
    jsonb_build_object('type', 'blockquote', 'attrs', jsonb_build_object('id', 'e5'), 'content', '[]'::jsonb),
    jsonb_build_object('type', 'codeBlock', 'attrs', jsonb_build_object('id', 'e6')),
    jsonb_build_object('type', 'horizontalRule', 'attrs', jsonb_build_object('id', 'e7')),
    pruebas.cd_tabla('e8', 'a', 'b'),
    jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', 'e9')),
    jsonb_build_object('type', 'galeria', 'attrs', jsonb_build_object('id', 'e10')),
    jsonb_build_object('type', 'cta', 'attrs', jsonb_build_object('id', 'e11')),
    jsonb_build_object('type', 'video', 'attrs', jsonb_build_object('id', 'e12'))))
$$;

-- Entradas raras para comprobar que las funciones de los checks nunca devuelven NULL (un check NULL se cumple).
create temporary table entradas_raras on commit drop as
  select v::jsonb as contenido from (values
    ('null'), ('1'), ('"doc"'), ('{}'), ('[]'), ('[null]'), ('{"type": "doc"}'), ('{"type": "doc", "content": null}'),
    ('{"type": "doc", "content": [null]}'), ('{"type": "doc", "content": [{"type": null, "attrs": {"id": "x"}}]}'),
    ('{"type": "doc", "content": [{"type": "paragraph", "attrs": null}]}'),
    ('{"type": "doc", "content": [{"type": "paragraph", "attrs": {"id": null}}]}'),
    ('{"type": "doc", "content": [{"type": "table", "attrs": {"id": "x"}, "content": "no es un arreglo"}]}')
  ) as x(v);

-- ===========================================================================
-- Estructura: funciones nuevas, immutable y con search_path vacío
-- ===========================================================================
select has_function('privado', 'tipos_elemento', array[]::text[], 'existe privado.tipos_elemento()');
select has_function('privado', 'documento_tiene_contenido', array['jsonb'], 'existe privado.documento_tiene_contenido(jsonb)');
select has_function('privado', 'documento_a_texto', array['jsonb'], 'existe privado.documento_a_texto(jsonb)');
select ok(coalesce((
    select count(*) = 3 and bool_and(p.provolatile = 'i')
    from pg_proc p
    where p.oid in (to_regprocedure('privado.tipos_elemento()'), to_regprocedure('privado.documento_tiene_contenido(jsonb)'),
                    to_regprocedure('privado.documento_a_texto(jsonb)'))), false),
  'tipos_elemento, documento_tiene_contenido y documento_a_texto son immutable');
select ok(coalesce((
    select count(*) = 4 and bool_and(p.proconfig @> array['search_path=""'])
    from pg_proc p
    where p.oid in (to_regprocedure('privado.tipos_elemento()'), to_regprocedure('privado.contenido_valido(jsonb)'),
                    to_regprocedure('privado.documento_tiene_contenido(jsonb)'),
                    to_regprocedure('privado.documento_a_texto(jsonb)'))), false),
  'las cuatro funciones del documento fijan search_path = ''''');

-- ===========================================================================
-- tipos_elemento: los doce tipos de primer nivel del contrato
-- ===========================================================================
select is(pruebas.cd_tipos(),
  array['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule', 'table',
        'imagen', 'galeria', 'cta', 'video'],
  'tipos_elemento devuelve los doce tipos de primer nivel en el orden del data-model');

-- ===========================================================================
-- contenido_valido: la forma mínima del documento (§VI.4)
-- ===========================================================================
select is(privado.contenido_valido('{"type": "doc", "content": []}'), true,
  'contenido_valido acepta el documento vacío');
select is(privado.contenido_valido(pruebas.cd_doce_tipos()), true,
  'contenido_valido acepta un documento con los doce tipos (solo mira la forma, no el detalle)');
select is(privado.contenido_valido(pruebas.cd_doc(
    (select jsonb_agg(jsonb_build_object('type', 'horizontalRule', 'attrs', jsonb_build_object('id', n::text)))
       from generate_series(1, 200) as n))), true,
  'contenido_valido acepta 200 elementos');
select is(privado.contenido_valido(pruebas.cd_doc(
    (select jsonb_agg(jsonb_build_object('type', 'horizontalRule', 'attrs', jsonb_build_object('id', n::text)))
       from generate_series(1, 201) as n))), false,
  'contenido_valido rechaza 201 elementos');
select is(privado.contenido_valido('[{"id": "b1", "tipo": "parrafo", "texto": "Hola"}]'), false,
  'contenido_valido rechaza el formato anterior (un arreglo de bloques)');
select is(privado.contenido_valido('[]'), false,
  'contenido_valido rechaza el arreglo vacío del formato anterior');
select is(privado.contenido_valido('{"type": "documento", "content": []}'), false,
  'contenido_valido rechaza un type distinto de doc');
select is(privado.contenido_valido('{"type": "doc"}'), false,
  'contenido_valido rechaza un documento sin content');
select is(privado.contenido_valido('{"type": "doc", "content": {"type": "paragraph"}}'), false,
  'contenido_valido rechaza un content que no es un arreglo');
select is(privado.contenido_valido('{"type": "doc", "content": [{"type": "parrafo", "attrs": {"id": "x"}}]}'), false,
  'contenido_valido rechaza un tipo de elemento que no está en tipos_elemento');
select is(privado.contenido_valido('{"type": "doc", "content": [{"type": "paragraph"}]}'), false,
  'contenido_valido rechaza un elemento sin attrs.id');
select is(privado.contenido_valido('{"type": "doc", "content": [{"type": "paragraph", "attrs": {"id": 7}}]}'), false,
  'contenido_valido rechaza un attrs.id que no es texto');
select is(privado.contenido_valido('{"type": "doc", "content": ["paragraph"]}'), false,
  'contenido_valido rechaza un elemento que no es un objeto');
select is_empty($$select contenido from entradas_raras where privado.contenido_valido(contenido) is null$$,
  'research D31 A5: contenido_valido nunca devuelve NULL (con las entradas raras devuelve false)');

-- ===========================================================================
-- documento_tiene_contenido: el requisito de publicación
-- ===========================================================================
select is(pruebas.cd_booleano('documento_tiene_contenido', '{"type": "doc", "content": []}'), false,
  'documento_tiene_contenido: el documento vacío no tiene contenido');
select is(pruebas.cd_booleano('documento_tiene_contenido', pruebas.cd_doc(jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'p1')),
    jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'p2'), 'content', '[]'::jsonb),
    jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'p3'),
      'content', jsonb_build_array(jsonb_build_object('type', 'hardBreak')))))), false,
  'documento_tiene_contenido: solo párrafos vacíos (sin content, content vacío o solo un salto) no es contenido');
select is(pruebas.cd_booleano('documento_tiene_contenido', pruebas.cd_doc(jsonb_build_array(pruebas.cd_tabla('t1', '', '')))), false,
  'documento_tiene_contenido: una tabla sin texto en ninguna celda no cuenta');
select is(pruebas.cd_booleano('documento_tiene_contenido', '[{"id": "b1", "tipo": "parrafo", "texto": "Hola"}]'), false,
  'documento_tiene_contenido: el formato anterior (un arreglo) da false sin error');
select is(pruebas.cd_booleano('documento_tiene_contenido', pruebas.cd_doc(jsonb_build_array(pruebas.cd_parrafo('p1', 'Hola')))), true,
  'documento_tiene_contenido: un párrafo con texto es contenido');
select is(pruebas.cd_booleano('documento_tiene_contenido', pruebas.cd_doc(jsonb_build_array(
    jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', 'i1',
      'imagen', jsonb_build_object('ruta', 'a.webp', 'ancho', 1, 'alto', 1, 'alt', 'x')))))), true,
  'documento_tiene_contenido: una imagen es contenido');
select is(pruebas.cd_booleano('documento_tiene_contenido', pruebas.cd_doc(jsonb_build_array(pruebas.cd_tabla('t1', '', 'Algo')))), true,
  'documento_tiene_contenido: una tabla con texto en una celda es contenido');
select is(pruebas.cd_booleano('documento_tiene_contenido', pruebas.cd_doc(jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'p1')),
    jsonb_build_object('type', 'horizontalRule', 'attrs', jsonb_build_object('id', 'h1'))))), true,
  'documento_tiene_contenido: un separador cuenta como contenido (solo no cuentan los párrafos vacíos)');
select ok(
  to_regprocedure('privado.documento_tiene_contenido(jsonb)') is not null
  and not exists (select 1 from entradas_raras where pruebas.cd_booleano('documento_tiene_contenido', contenido) is null),
  'research D31 A5: documento_tiene_contenido nunca devuelve NULL (con las entradas raras devuelve false)');

-- ===========================================================================
-- documento_a_texto: el texto de la búsqueda en orden de lectura
-- ===========================================================================
create temporary table texto_cd on commit drop as
  select pruebas.cd_texto(pruebas.cd_doc(jsonb_build_array(
    jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('id', 'e1', 'level', 2),
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Primero palmera'))),
    -- Un mismo párrafo: "Pala" + "bra" con marca se unen sin espacio; el salto cuenta como espacio.
    jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', 'e2'), 'content', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'Segundo: Pala'),
      jsonb_build_object('type', 'text', 'text', 'bra', 'marks', jsonb_build_array(jsonb_build_object('type', 'bold'))),
      jsonb_build_object('type', 'text', 'text', ' uno'),
      jsonb_build_object('type', 'hardBreak'),
      jsonb_build_object('type', 'text', 'text', 'dos '),
      jsonb_build_object('type', 'text', 'text', 'enlace visible', 'marks', jsonb_build_array(
        jsonb_build_object('type', 'link', 'attrs', jsonb_build_object('href', 'https://oculto.example/ruta')))))),
    jsonb_build_object('type', 'blockquote', 'attrs', jsonb_build_object('id', 'e3', 'autor', 'Tercero Gaviota',
        'fuente', 'https://fuente.example/cita'),
      'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Cita del faro'))))),
    jsonb_build_object('type', 'codeBlock', 'attrs', jsonb_build_object('id', 'e4', 'lenguaje', 'js'),
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'const secretoDeCodigo = 1;'))),
    pruebas.cd_tabla('e5', 'Cuarto pulpo', 'celda del calamar', 'descripción del arrecife'),
    jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', 'e6',
      'imagen', jsonb_build_object('ruta', 'articulos/oculta.webp', 'ancho', 1, 'alto', 1, 'alt', 'Quinto velero'),
      'leyenda', 'leyenda del muelle'))
  ))) as texto;

select ok(coalesce((select texto ilike all (array['%Tercero Gaviota%', '%Cuarto pulpo%', '%celda del calamar%',
    '%descripción del arrecife%', '%Quinto velero%', '%leyenda del muelle%', '%enlace visible%']) from texto_cd), false),
  'documento_a_texto incluye el autor de la cita, las celdas y la descripción de la tabla, el alt y la leyenda');
select ok(coalesce((select texto not ilike '%secretoDeCodigo%' and texto not ilike '%oculto.example%'
    and texto not ilike '%fuente.example%' and texto not ilike '%articulos/oculta.webp%' from texto_cd), false),
  'documento_a_texto excluye el codeBlock y las URL (href, fuente y ruta)');
select ok(coalesce((select strpos(texto, 'Primero') < strpos(texto, 'Segundo')
    and strpos(texto, 'Segundo') < strpos(texto, 'Tercero') and strpos(texto, 'Tercero') < strpos(texto, 'Cuarto')
    and strpos(texto, 'Cuarto') < strpos(texto, 'Quinto') and strpos(texto, 'Primero') > 0 from texto_cd), false),
  'documento_a_texto respeta el orden de lectura de los elementos');
select is((select (char_length(texto) - char_length(replace(texto, 'palmera', ''))) / char_length('palmera') from texto_cd), 1,
  'documento_a_texto no duplica el texto (palmera aparece una vez)');
select ok(coalesce((select texto like '%Palabra uno dos%' from texto_cd), false),
  'documento_a_texto une los textos de un párrafo sin espacio (marca parcial) y el salto de línea cuenta como espacio');
select is(pruebas.cd_texto('[{"id": "b1", "tipo": "parrafo", "texto": "Hola"}]'), '',
  'documento_a_texto da '''' con el formato anterior (un arreglo)');
select is(pruebas.cd_texto('{"type": "doc", "content": []}'), '',
  'documento_a_texto da '''' con el documento vacío');

-- ===========================================================================
-- Default de contenido y checks recreados (research D31 A2)
-- ===========================================================================
select pruebas.como('cd-editor@prueba.local');
select lives_ok($$
  insert into public.articulos (id, titulo, autor_id)
  values ('a8000000-0000-4000-8000-000000000001', 'Documento por defecto', auth.uid())
$$, 'un insert sin contenido usa el default y pasa el check (como authenticated)');
select pruebas.como_postgres();
select is((select contenido from public.articulos where id = 'a8000000-0000-4000-8000-000000000001'),
  '{"type": "doc", "content": []}'::jsonb,
  'el default de articulos.contenido es el documento vacío');
select results_eq(
  $$select conname::text collate "default", convalidated from pg_constraint
     where conrelid = 'public.articulos'::regclass
       and conname in ('articulos_contenido_check', 'articulos_requisitos_publicacion') order by conname$$,
  $$values ('articulos_contenido_check'::text, true), ('articulos_requisitos_publicacion'::text, true)$$,
  'research D31 A2: después de la migración en local los dos checks quedan convalidated');
select ok(coalesce((
    select bool_and(case conname
             when 'articulos_contenido_check' then pg_get_constraintdef(oid) ilike '%contenido_valido(contenido)%'
             else pg_get_constraintdef(oid) ilike '%documento_tiene_contenido(contenido)%' end) and count(*) = 2
    from pg_constraint
    where conrelid = 'public.articulos'::regclass
      and conname in ('articulos_contenido_check', 'articulos_requisitos_publicacion')), false),
  'articulos_requisitos_publicacion usa documento_tiene_contenido y articulos_contenido_check, contenido_valido');
select ok(coalesce((
    select p.prosrc ilike '%documento_tiene_contenido%'
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.articulos'::regclass and t.tgname = 'a40_validar_estado'), false),
  'la función de a40_validar_estado usa documento_tiene_contenido para el requisito de contenido');
select ok(coalesce((
    select p.prosrc ilike '%documento_a_texto%' and p.prosrc not ilike '%bloques_a_texto%'
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.articulos'::regclass and t.tgname = 'a50_calcular_busqueda'), false),
  'privado.calcular_busqueda (a50) usa documento_a_texto');

select * from finish();
rollback;
