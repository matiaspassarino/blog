-- T114 (spec 005, Historia 5; RF-023, RF-030; data-model "Conversión de los artículos existentes" y "Pruebas pgTAP";
-- research D25 y D31 A2 a A4): el SQL que genera el script de conversión, aplicado sobre artículos en el formato
-- anterior con la base en el estado real de la nube antes del corte (checks recreados `not valid`).
-- Se elimina después del corte, junto con su fixture (data-model, paso 5).
--
-- El SQL viene de la fixture `fixtures/conversion-corpus.psql` (la genera T120 desde
-- packages/bloques/scripts/convertir-contenido.test.ts, que comprueba que no se desvía), que lo deja en la variable
-- psql `sql_conversion`. Sus dos artículos (ENTRADA_FIXTURE de esa prueba) son los que se insertan acá:
--   c0a00000-…-001: borrador, versión 1, "párrafos con dos, tres y cuatro líneas en blanco" del corpus
--   c0a00000-…-002: publicado, versión 1, "artículo del seed: JavaScript moderno" del corpus
-- FASE ROJA: la fixture es un marcador que falla con feature_not_supported (no P0001): las aserciones fallan por
-- separado y el archivo no se aborta.
--
-- Todo ocurre en la transacción de la prueba (drop y add de los checks, triggers, secretos de Vault): el rollback
-- final deja la base como estaba.
begin;
\ir helpers/pruebas.psql
\ir fixtures/conversion-corpus.psql
select plan(19);

-- Sin secretos de revalidación al preparar (insertar no encola nada); se crean antes de convertir.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('conv-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Conv Editor"}');
insert into public.categorias (nombre, slug) values ('Conv Categoría', 'conv-categoria');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function pruebas.conv_ids() returns uuid[]
language sql immutable as $$
  select array['c0a00000-0000-4000-8000-000000000001', 'c0a00000-0000-4000-8000-000000000002']::uuid[]
$$;
create function pruebas.conv_checks() returns table (nombre text, validado boolean)
language sql as $$
  select c.conname::text, c.convalidated
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.articulos'::regclass
    and c.conname in ('articulos_contenido_check', 'articulos_requisitos_publicacion')
  order by 1
$$;
create function pruebas.conv_triggers() returns table (nombre text, estado "char")
language sql as $$
  select t.tgname::text, t.tgenabled
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'public.articulos'::regclass
    and t.tgname in ('a30_controlar_version', 'a40_validar_estado', 'a50_calcular_busqueda', 'a90_actualizado_en',
                     'z90_notificar_cambio')
  order by 1
$$;
create function pruebas.conv_encuentra(articulo uuid, palabra text) returns boolean
language sql as $$
  select coalesce((
    select a.busqueda @@ (websearch_to_tsquery('public.es_sin_tildes', palabra)
                          || websearch_to_tsquery('pg_catalog.spanish', palabra))
    from public.articulos a where a.id = articulo), false)
$$;

-- Marca de la cola de pg_net: solo cuentan las filas posteriores a la última marca.
create temporary table marca_cola (id bigint) on commit drop;
insert into marca_cola values (0);
create function pruebas.marcar_cola() returns void
language sql as $$
  update marca_cola set id = coalesce((select max(q.id) from net.http_request_queue q), 0)
$$;
create function pruebas.cola_nueva() returns bigint
language sql as $$
  select count(*) from net.http_request_queue q
  where q.id > (select m.id from marca_cola m) and q.url like 'http://prueba.local%'
$$;

-- ---------------------------------------------------------------------------
-- Setup: el estado de la nube antes del corte. Los checks se quitan, se insertan los dos artículos en el formato
-- anterior (con a40 desactivado: el publicado tampoco tendría "contenido" para la regla nueva) y los checks vuelven
-- `not valid`. El borrador se inserta con la versión 2: la fixture espera la 1 (caso "la versión no coincide").
-- ---------------------------------------------------------------------------
alter table public.articulos
  drop constraint articulos_contenido_check,
  drop constraint articulos_requisitos_publicacion;
alter table public.articulos disable trigger a40_validar_estado;
insert into public.articulos
  (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en, version, actualizado_en)
values
  ('c0a00000-0000-4000-8000-000000000001', 'Conversión borrador', 'conv-borrador',
   '[{"id":"00000000-0000-4000-8000-000000000022","tipo":"parrafo","texto":"Uno\n\nDos"},{"id":"00000000-0000-4000-8000-000000000023","tipo":"parrafo","texto":"Uno\n\n\nDos\n\n\n\nTres"},{"id":"00000000-0000-4000-8000-000000000024","tipo":"parrafo","texto":"Salto simple\ny doble\n\ny triple\n\n\nfin"}]',
   (select id from public.categorias where slug = 'conv-categoria'),
   (select id from auth.users where email = 'conv-editor@prueba.local'),
   'borrador', null, 2, '2026-01-01 12:00+00'),
  ('c0a00000-0000-4000-8000-000000000002', 'Conversión publicada', 'conv-publicada',
   '[{"id":"00000000-0000-4000-8000-000000000061","tipo":"parrafo","texto":"JavaScript cambió mucho en los últimos años. Estas son las herramientas que conviene conocer primero."},{"id":"00000000-0000-4000-8000-000000000062","tipo":"codigo","codigo":"const respuesta = await fetch(''/api/articulos'');\nconst articulos = await respuesta.json();","lenguaje":"js"},{"id":"00000000-0000-4000-8000-000000000063","tipo":"lista","ordenada":true,"items":["Módulos con `import` y `export`.","Promesas y `async`/`await`.","Desestructuración y operador spread."]}]',
   (select id from public.categorias where slug = 'conv-categoria'),
   (select id from auth.users where email = 'conv-editor@prueba.local'),
   'publicado', now() - interval '1 day', 1, '2026-01-01 12:00+00');
alter table public.articulos enable trigger a40_validar_estado;
alter table public.articulos
  add constraint articulos_contenido_check check (privado.contenido_valido(contenido)) not valid,
  add constraint articulos_requisitos_publicacion check (
    estado not in ('programado', 'publicado')
    or (categoria_id is not null and privado.documento_tiene_contenido(contenido))
  ) not valid;

create temporary table previas_conv on commit drop as
  select id, version, actualizado_en, contenido from public.articulos where id = any (pruebas.conv_ids());

select is(
  (select count(*)::int from public.articulos where id = any (pruebas.conv_ids()) and jsonb_typeof(contenido) = 'array'),
  2,
  'setup: el borrador y el publicado están en el formato anterior');
select results_eq(
  'select * from pruebas.conv_checks()',
  $$values ('articulos_contenido_check', false), ('articulos_requisitos_publicacion', false)$$,
  'setup: los dos checks están not valid (el estado de la nube antes del corte)');
select is(pruebas.conv_encuentra('c0a00000-0000-4000-8000-000000000002', 'desestructuración'), false,
  'setup: antes de convertir, la búsqueda no encuentra el texto del contenido anterior');

-- ---------------------------------------------------------------------------
-- Con una versión que no coincide (alguien guardó después del export): falla entera y todo queda igual.
-- ---------------------------------------------------------------------------
select throws_ok(:'sql_conversion', 'P0001', null,
  'RF-023: si la versión de un artículo no coincide con la del export, la conversión lanza una excepción');
select results_eq(
  $$select a.id, a.contenido = p.contenido, a.version = p.version
      from public.articulos a join previas_conv p using (id) order by a.id$$,
  $$values ('c0a00000-0000-4000-8000-000000000001'::uuid, true, true),
           ('c0a00000-0000-4000-8000-000000000002'::uuid, true, true)$$,
  'RF-030: tras la excepción, ningún artículo cambió (tampoco el que sí coincidía): todo o nada');
select results_eq(
  'select * from pruebas.conv_checks()',
  $$values ('articulos_contenido_check', false), ('articulos_requisitos_publicacion', false)$$,
  'RF-030: tras la excepción, los checks siguen not valid');
select results_eq(
  'select * from pruebas.conv_triggers()',
  $$values ('a30_controlar_version', 'O'::"char"), ('a40_validar_estado', 'O'), ('a50_calcular_busqueda', 'O'),
           ('a90_actualizado_en', 'O'), ('z90_notificar_cambio', 'O')$$,
  'RF-030: tras la excepción, los triggers siguen activos');

-- ---------------------------------------------------------------------------
-- La versión vuelve a la del export (sin pasar por los checks `not valid`, que rechazarían el arreglo).
-- ---------------------------------------------------------------------------
alter table public.articulos
  drop constraint articulos_contenido_check,
  drop constraint articulos_requisitos_publicacion;
alter table public.articulos disable trigger a30_controlar_version, disable trigger a90_actualizado_en;
update public.articulos set version = 1 where id = 'c0a00000-0000-4000-8000-000000000001';
alter table public.articulos enable trigger a30_controlar_version, enable trigger a90_actualizado_en;
alter table public.articulos
  add constraint articulos_contenido_check check (privado.contenido_valido(contenido)) not valid,
  add constraint articulos_requisitos_publicacion check (
    estado not in ('programado', 'publicado')
    or (categoria_id is not null and privado.documento_tiene_contenido(contenido))
  ) not valid;
delete from previas_conv;
insert into previas_conv
  select id, version, actualizado_en, contenido from public.articulos where id = any (pruebas.conv_ids());

-- Con secretos (en la transacción) z90 encolaría un aviso por el publicado: la conversión no tiene que hacerlo.
select vault.create_secret('http://prueba.local', 'url_web_revalidacion');
select vault.create_secret('secreto-de-prueba-conversion', 'secreto_revalidacion');
select pruebas.marcar_cola();

-- ---------------------------------------------------------------------------
-- La conversión
-- ---------------------------------------------------------------------------
select lives_ok(:'sql_conversion', 'RF-023: el SQL de la conversión corre sin errores sobre la base del corte');

select results_eq(
  $$select id, jsonb_typeof(contenido), contenido ->> 'type' from public.articulos
     where id = any (pruebas.conv_ids()) order by id$$,
  $$values ('c0a00000-0000-4000-8000-000000000001'::uuid, 'object', 'doc'),
           ('c0a00000-0000-4000-8000-000000000002'::uuid, 'object', 'doc')$$,
  'RF-023: los dos artículos quedan como documentos');
select is(
  (select count(*)::int from public.articulos where jsonb_typeof(contenido) = 'array'),
  0,
  'RF-030: ningún artículo queda en el formato anterior');
select is(
  (select jsonb_agg(e -> 'type' order by n) from public.articulos a,
     jsonb_array_elements(a.contenido -> 'content') with ordinality as x(e, n)
   where a.id = 'c0a00000-0000-4000-8000-000000000001'),
  '["paragraph","paragraph","paragraph","paragraph","paragraph","paragraph","paragraph","paragraph"]'::jsonb,
  'D25: los párrafos con líneas en blanco del borrador son ocho paragraph (uno por tramo)');
select is(
  (select contenido #>> '{content,0,attrs,id}' from public.articulos where id = 'c0a00000-0000-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000022',
  'D25: el primer paragraph conserva el id del bloque');
select is(
  (select jsonb_agg(e -> 'type' order by n) from public.articulos a,
     jsonb_array_elements(a.contenido -> 'content') with ordinality as x(e, n)
   where a.id = 'c0a00000-0000-4000-8000-000000000002'),
  '["paragraph","codeBlock","orderedList"]'::jsonb,
  'RF-023: el publicado conserva sus tres elementos en orden');
select results_eq(
  $$select a.id, a.version = p.version, a.actualizado_en = p.actualizado_en
      from public.articulos a join previas_conv p using (id) order by a.id$$,
  $$values ('c0a00000-0000-4000-8000-000000000001'::uuid, true, true),
           ('c0a00000-0000-4000-8000-000000000002'::uuid, true, true)$$,
  'RF-023: la conversión no cambia version ni actualizado_en');
select is(pruebas.cola_nueva(), 0::bigint,
  'RF-023: la conversión no encola avisos de revalidación (z90 desactivado durante el update)');
select ok(pruebas.conv_encuentra('c0a00000-0000-4000-8000-000000000002', 'desestructuración'),
  'RF-023: a50 queda activo y la búsqueda encuentra una palabra del documento convertido');
select results_eq(
  'select * from pruebas.conv_checks()',
  $$values ('articulos_contenido_check', true), ('articulos_requisitos_publicacion', true)$$,
  'RF-030: después de la conversión, los dos checks quedan convalidated');
select results_eq(
  'select * from pruebas.conv_triggers()',
  $$values ('a30_controlar_version', 'O'::"char"), ('a40_validar_estado', 'O'), ('a50_calcular_busqueda', 'O'),
           ('a90_actualizado_en', 'O'), ('z90_notificar_cambio', 'O')$$,
  'RF-023: después de la conversión, los triggers vuelven a estar activos (tgenabled = O)');

-- Control: con z90 de nuevo activo, un cambio del publicado sí encola (la cola vacía de arriba no era por otra cosa).
-- Si el update falla (por ejemplo, el publicado sigue en el formato anterior y a40 lo rechaza), da -1 sin abortar.
create function pruebas.conv_avisos_al_editar() returns bigint
language plpgsql as $$
begin
  perform pruebas.marcar_cola();
  update public.articulos set titulo = 'Conversión publicada (editada)'
   where id = 'c0a00000-0000-4000-8000-000000000002';
  return pruebas.cola_nueva();
exception when others then
  return -1;
end
$$;
select ok(pruebas.conv_avisos_al_editar() > 0,
  'control: después de la conversión, editar el publicado vuelve a encolar avisos');

select * from finish();
rollback;
