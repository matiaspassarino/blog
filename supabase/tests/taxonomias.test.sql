-- T045: taxonomías y etiquetado (H3-E3, H3-E4, RF-012, RF-015, RF-016, D11, D22, D23).
-- Tabla articulos_etiquetas (políticas ae_select_publico y ae_select_equipo, sin
-- escritura directa), RPC public.asignar_etiquetas, trigger a05_impedir_borrado_en_uso
-- de categorias, triggers z10_registrar_redireccion y z30_borrar_redirecciones de
-- categorias y etiquetas, y etiquetas en privado.mensaje_articulo (z90, n10 y el RPC).
-- Los secretos de Vault se crean dentro de la transacción (se deshacen con el
-- rollback) y se cuentan las filas nuevas de net.http_request_queue.
-- No depende del seed: usuarios @prueba.local y slugs propios (prefijo h3-tax-).
begin;
\ir helpers/pruebas.psql
select plan(58);

-- Sin secretos de revalidación al empezar: el armado de datos no notifica.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('h3-tax-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Tres Tax Editor"}');
select pruebas.crear_usuario('h3-tax-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Tres Tax Admin"}');
select pruebas.crear_usuario('h3-tax-inactivo@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Tres Tax Inactivo"}');
update public.perfiles set activo = false
 where id = (select id from auth.users where email = 'h3-tax-inactivo@prueba.local');

-- Libera los slugs, nombres y redirecciones que usa el test (se deshace con el rollback).
delete from public.articulos where slug like 'h3-tax-%';
delete from public.redirecciones where slug_anterior like 'h3-tax-%';
delete from public.categorias where slug like 'h3-tax-%' or lower(nombre) like 'h3 tax %';
delete from public.etiquetas where slug like 'h3-tax-%' or lower(nombre) like 'h3 tax %';

insert into public.categorias (id, nombre, slug) values
  ('c3000000-0000-4000-8000-000000000001', 'H3 Tax En Uso', 'h3-tax-en-uso'),
  ('c3000000-0000-4000-8000-000000000002', 'H3 Tax Libre', 'h3-tax-libre'),
  ('c3000000-0000-4000-8000-000000000003', 'H3 Tax Renombrada', 'h3-tax-cat-vieja'),
  ('c3000000-0000-4000-8000-000000000004', 'H3 Tax Para Borrar', 'h3-tax-cat-borrar'),
  ('c3000000-0000-4000-8000-000000000005', 'H3 Tax Otra', 'h3-tax-otra');
insert into public.etiquetas (id, nombre, slug) values
  ('e3000000-0000-4000-8000-000000000001', 'H3 Tax Seo', 'h3-tax-seo'),
  ('e3000000-0000-4000-8000-000000000002', 'H3 Tax Diseño', 'h3-tax-diseno'),
  ('e3000000-0000-4000-8000-000000000003', 'H3 Tax Tipografía', 'h3-tax-tipografia'),
  ('e3000000-0000-4000-8000-000000000004', 'H3 Tax Efímera', 'h3-tax-efimera'),
  ('e3000000-0000-4000-8000-000000000005', 'H3 Tax Renombrada', 'h3-tax-eti-vieja');

-- Artículos de partida, cargados por el sistema (sin secretos: no notifican). El
-- autor es el admin: el editor opera sobre artículos de otro autor (RF-024).
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
select x.id::uuid, 'H3 taxonomías ' || x.sufijo, 'h3-tax-' || x.sufijo,
       '[{"id": "b3000000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Texto."}]',
       x.categoria_id::uuid,
       (select id from auth.users where email = 'h3-tax-admin@prueba.local'),
       x.estado::public.estado_articulo, x.publicado_en
from (values
  -- La categoría en uso tiene 2 artículos: uno publicado y un borrador (el conteo incluye todos los estados).
  ('a3000000-0000-4000-8000-000000000001', 'publicado', 'publicado', now() - interval '1 day',
   'c3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'borrador', 'borrador', null::timestamptz,
   'c3000000-0000-4000-8000-000000000001'),
  -- Publicado con fecha futura (solo lo puede crear el sistema): no es público todavía.
  ('a3000000-0000-4000-8000-000000000003', 'publicado-futuro', 'publicado', now() + interval '1 day',
   'c3000000-0000-4000-8000-000000000005'),
  ('a3000000-0000-4000-8000-000000000004', 'para-borrar', 'publicado', now() - interval '1 day',
   'c3000000-0000-4000-8000-000000000005')
) as x(id, sufijo, estado, publicado_en, categoria_id);

-- Etiquetado inicial como sistema (así lo carga el seed).
insert into public.articulos_etiquetas (articulo_id, etiqueta_id) values
  ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000004'),
  ('a3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000004'),
  ('a3000000-0000-4000-8000-000000000003', 'e3000000-0000-4000-8000-000000000002'),
  ('a3000000-0000-4000-8000-000000000004', 'e3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000004', 'e3000000-0000-4000-8000-000000000003');

-- Ejecuta una sentencia como el rol en curso y devuelve sqlstate, message y
-- detail del error (o nulls si no falla): throws_ok no verifica el detail.
create function pruebas.error_de(sentencia text)
returns table (estado_sql text, mensaje text, detalle text)
language plpgsql as $$
declare
  v_estado text;
  v_mensaje text;
  v_detalle text;
begin
  execute sentencia;
  return query select null::text, null::text, null::text;
exception when others then
  get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text, v_detalle = pg_exception_detail;
  return query select v_estado, v_mensaje, v_detalle;
end
$$;
grant execute on function pruebas.error_de(text) to authenticated;

-- Etiquetas de un artículo, leídas como postgres (sin RLS), ordenadas por slug.
create function pruebas.etiquetas_de(articulo uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.slug order by e.slug), '{}')
  from public.articulos_etiquetas ae join public.etiquetas e on e.id = ae.etiqueta_id
  where ae.articulo_id = articulo
$$;

-- Versión actual de un artículo, leída como postgres (sin RLS).
create function pruebas.version_de(articulo uuid) returns int
language sql stable security definer set search_path = '' as $$
  select a.version from public.articulos a where a.id = articulo
$$;
grant execute on function pruebas.version_de(uuid) to authenticated;

-- Marca de la cola: solo cuentan las filas posteriores a la última marca.
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
-- Elementos de un arreglo jsonb de texto, ordenados (para comparar sin depender del orden).
create function pruebas.ordenados(arreglo jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(arreglo) as t(x)
$$;

-- Hay columna busqueda solo desde H5 (T058). Devuelve null si no existe.
create function pruebas.busqueda_coincide(articulo uuid, termino text) returns boolean
language plpgsql as $$
declare
  resultado boolean;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'articulos' and column_name = 'busqueda'
  ) then
    return null;
  end if;
  execute 'select busqueda @@ websearch_to_tsquery(''pg_catalog.spanish'', $2) from public.articulos where id = $1'
    into resultado using articulo, termino;
  return resultado;
end
$$;

-- ===========================================================================
-- H3-E3 · RF-016 · D23: una categoría en uso no se puede borrar
-- ===========================================================================
select pruebas.como('h3-tax-editor@prueba.local');
select results_eq(
  $$select estado_sql, mensaje, detalle
      from pruebas.error_de('delete from public.categorias where id = ''c3000000-0000-4000-8000-000000000001''')$$,
  $$values ('P0001'::text, 'categoria_en_uso'::text, '2'::text)$$,
  'H3-E3: borrar una categoría con 2 artículos (publicado y borrador) lanza categoria_en_uso con detail = 2'
);
select pruebas.como_postgres();
select isnt_empty($$select 1 from public.categorias where id = 'c3000000-0000-4000-8000-000000000001'$$,
  'H3-E3: la categoría en uso se conserva');
select is((select count(*)::int from public.articulos where categoria_id = 'c3000000-0000-4000-8000-000000000001'), 2,
  'H3-E3: sus artículos siguen asignados');

select pruebas.como('h3-tax-editor@prueba.local');
select lives_ok($$delete from public.categorias where id = 'c3000000-0000-4000-8000-000000000002'$$,
  'RF-016: un editor puede borrar una categoría sin artículos');
select pruebas.como_postgres();
select is_empty($$select 1 from public.categorias where id = 'c3000000-0000-4000-8000-000000000002'$$,
  'RF-016: la categoría sin artículos se borró');

-- ===========================================================================
-- H3-E4 · RF-016: borrar una etiqueta la quita de sus artículos y los conserva
-- ===========================================================================
select pruebas.como('h3-tax-editor@prueba.local');
select lives_ok($$delete from public.etiquetas where id = 'e3000000-0000-4000-8000-000000000004'$$,
  'H3-E4: un editor puede borrar una etiqueta asignada a artículos');
select pruebas.como_postgres();
select is_empty($$select 1 from public.articulos_etiquetas where etiqueta_id = 'e3000000-0000-4000-8000-000000000004'$$,
  'H3-E4: la etiqueta borrada se quita de todos sus artículos (cascade)');
select is(
  (select count(*)::int from public.articulos
    where id in ('a3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002')),
  2, 'H3-E4: los artículos que tenían la etiqueta se conservan');
select is(pruebas.etiquetas_de('a3000000-0000-4000-8000-000000000001'), array['h3-tax-diseno', 'h3-tax-seo'],
  'H3-E4: el artículo conserva sus otras etiquetas');

-- ===========================================================================
-- RLS de articulos_etiquetas: anon solo ve las de publicados; el equipo, todas
-- ===========================================================================
select pruebas.como_anon();
select results_eq(
  $$select articulo_id, etiqueta_id from public.articulos_etiquetas
     where articulo_id::text like 'a3000000-%' order by articulo_id, etiqueta_id$$,
  $$values ('a3000000-0000-4000-8000-000000000001'::uuid, 'e3000000-0000-4000-8000-000000000001'::uuid),
           ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002'),
           ('a3000000-0000-4000-8000-000000000004', 'e3000000-0000-4000-8000-000000000001'),
           ('a3000000-0000-4000-8000-000000000004', 'e3000000-0000-4000-8000-000000000003')$$,
  'ae_select_publico: anon ve solo las etiquetas de artículos publicados (ni borrador ni publicado a futuro)'
);
select pruebas.como('h3-tax-editor@prueba.local');
select is(
  (select count(*)::int from public.articulos_etiquetas where articulo_id::text like 'a3000000-%'), 6,
  'ae_select_equipo: el equipo ve las etiquetas de todos los artículos, en cualquier estado'
);
select pruebas.como('h3-tax-inactivo@prueba.local');
select is(
  (select count(*)::int from public.articulos_etiquetas where articulo_id::text like 'a3000000-%'), 4,
  'ae_select_equipo: un miembro desactivado ve solo las de publicados (como un visitante)'
);

-- ===========================================================================
-- D22: nadie escribe directo en articulos_etiquetas (única vía: el RPC)
-- ===========================================================================
select pruebas.como_anon();
select throws_ok($$
  insert into public.articulos_etiquetas (articulo_id, etiqueta_id)
  values ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003')
$$, '42501', null, 'D22: anon no puede insertar en articulos_etiquetas');
select pruebas.como('h3-tax-editor@prueba.local');
select throws_ok($$
  insert into public.articulos_etiquetas (articulo_id, etiqueta_id)
  values ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003')
$$, '42501', null, 'D22: un editor que inserta directo en articulos_etiquetas recibe permission denied');
select throws_ok($$
  delete from public.articulos_etiquetas where articulo_id = 'a3000000-0000-4000-8000-000000000001'
$$, '42501', null, 'D22: un editor que borra directo de articulos_etiquetas recibe permission denied');
select throws_ok($$
  update public.articulos_etiquetas set etiqueta_id = 'e3000000-0000-4000-8000-000000000003'
   where articulo_id = 'a3000000-0000-4000-8000-000000000001'
$$, '42501', null, 'D22: un editor tampoco puede modificar articulos_etiquetas');
select pruebas.como('h3-tax-admin@prueba.local');
select throws_ok($$
  insert into public.articulos_etiquetas (articulo_id, etiqueta_id)
  values ('a3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003')
$$, '42501', null, 'D22: un admin tampoco inserta directo en articulos_etiquetas');
select pruebas.como_postgres();
select is(pruebas.etiquetas_de('a3000000-0000-4000-8000-000000000001'), array['h3-tax-diseno', 'h3-tax-seo'],
  'D22: los intentos de escritura directa no cambiaron nada');

-- ===========================================================================
-- D22 · RF-015: asignar_etiquetas(articulo_id, etiqueta_ids, version)
-- ===========================================================================
select pruebas.como_anon();
select throws_ok($$
  select public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002',
    array['e3000000-0000-4000-8000-000000000001']::uuid[], 1)
$$, '42501', null, 'anon no puede ejecutar asignar_etiquetas');

select pruebas.como('h3-tax-inactivo@prueba.local');
select throws_ok($$
  select public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002',
    array['e3000000-0000-4000-8000-000000000001']::uuid[], pruebas.version_de('a3000000-0000-4000-8000-000000000002'))
$$, 'P0001', 'sin_permiso', 'un miembro desactivado que ejecuta asignar_etiquetas recibe sin_permiso');

-- Reemplaza el conjunto (borrador de otro autor: D22, RF-024).
select pruebas.como('h3-tax-editor@prueba.local');
select is(
  public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002',
    array['e3000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003']::uuid[], 1),
  2, 'D22: asignar_etiquetas devuelve la versión nueva (versión enviada + 1)'
);
select pruebas.como_postgres();
select is(pruebas.etiquetas_de('a3000000-0000-4000-8000-000000000002'), array['h3-tax-seo', 'h3-tax-tipografia'],
  'D22: asignar_etiquetas reemplaza el conjunto completo (quita diseño, agrega seo y tipografía)');
select is(pruebas.version_de('a3000000-0000-4000-8000-000000000002'), 2,
  'D22 (I3): la versión devuelta es igual a la de la fila: un solo incremento');

-- Versión vieja: conflicto y no cambia nada.
select pruebas.como('h3-tax-editor@prueba.local');
select throws_ok($$
  select public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002',
    array['e3000000-0000-4000-8000-000000000002']::uuid[], 1)
$$, 'P0001', 'conflicto_version', 'RF-008: asignar_etiquetas con una versión vieja lanza conflicto_version');
select pruebas.como_postgres();
select is(pruebas.etiquetas_de('a3000000-0000-4000-8000-000000000002'), array['h3-tax-seo', 'h3-tax-tipografia'],
  'RF-008: con conflicto_version las etiquetas no cambian');
select is(pruebas.version_de('a3000000-0000-4000-8000-000000000002'), 2,
  'RF-008: con conflicto_version la versión no cambia');

-- Repetidos en el arreglo: se guardan una sola vez.
select pruebas.como('h3-tax-editor@prueba.local');
select is(
  public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002',
    array['e3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000002']::uuid[], 2),
  3, 'D22: asignar_etiquetas acepta ids repetidos'
);
select pruebas.como_postgres();
select is(pruebas.etiquetas_de('a3000000-0000-4000-8000-000000000002'), array['h3-tax-diseno'],
  'D22: los ids repetidos se guardan una sola vez');

-- Arreglo vacío: quita todas.
select pruebas.como('h3-tax-editor@prueba.local');
select is(public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002', '{}'::uuid[], 3), 4,
  'RF-015: asignar_etiquetas con un arreglo vacío funciona');
select pruebas.como_postgres();
select is(pruebas.etiquetas_de('a3000000-0000-4000-8000-000000000002'), '{}'::text[],
  'RF-015: con un arreglo vacío el artículo queda sin etiquetas');

select pruebas.como('h3-tax-editor@prueba.local');
select throws_ok($$
  select public.asignar_etiquetas('a3000000-0000-4000-8000-0000000000ff',
    array['e3000000-0000-4000-8000-000000000001']::uuid[], 1)
$$, 'P0001', 'no_encontrado', 'asignar_etiquetas sobre un artículo inexistente lanza no_encontrado');

-- ===========================================================================
-- RF-013 · A4-M2: notificaciones con etiquetas (secretos de Vault en la transacción)
-- ===========================================================================
select pruebas.como_postgres();
select vault.create_secret('http://prueba.local', 'url_web_revalidacion');
select vault.create_secret('secreto-de-prueba-h3', 'secreto_revalidacion');

-- asignar_etiquetas sobre un borrador no notifica.
select pruebas.marcar_cola();
select pruebas.como('h3-tax-editor@prueba.local');
select public.asignar_etiquetas('a3000000-0000-4000-8000-000000000002',
  array['e3000000-0000-4000-8000-000000000001']::uuid[], 4);
select pruebas.como_postgres();
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'RF-013: asignar_etiquetas sobre un borrador no encola');

-- Publicado: seo + diseño → diseño + tipografía.
select pruebas.marcar_cola();
select pruebas.como('h3-tax-editor@prueba.local');
select is(
  public.asignar_etiquetas('a3000000-0000-4000-8000-000000000001',
    array['e3000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000003']::uuid[],
    pruebas.version_de('a3000000-0000-4000-8000-000000000001')),
  2, 'D22: sobre un publicado, asignar_etiquetas devuelve la versión nueva'
);
select pruebas.como_postgres();
select is(pruebas.version_de('a3000000-0000-4000-8000-000000000001'), 2,
  'D22 (I3): sobre un publicado, la versión de la fila es la devuelta (sin doble incremento)');
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'D22 · RF-013: asignar_etiquetas sobre un publicado encola un solo mensaje');
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo ->> 'id', cuerpo -> 'slugs', cuerpo -> 'categorias' from pruebas.cola_nueva()$$,
  $$values ('articulo'::text, 'a3000000-0000-4000-8000-000000000001'::text, '["h3-tax-publicado"]'::jsonb,
            '["h3-tax-en-uso"]'::jsonb)$$,
  'contrato: el mensaje de asignar_etiquetas es de tipo articulo, con su slug y su categoría'
);
select is((select pruebas.ordenados(cuerpo -> 'etiquetas') from pruebas.cola_nueva()),
  array['h3-tax-diseno', 'h3-tax-seo', 'h3-tax-tipografia'],
  'A4-M2: etiquetas lleva la unión de las anteriores y las nuevas, sin repetidos');

-- busqueda llega en H5 (T058): hasta entonces estas dos aserciones se saltean.
select case when pruebas.busqueda_coincide('a3000000-0000-4000-8000-000000000001', 'tipografía') is null
  then skip('busqueda llega en H5 (T058): no se puede verificar que incluya las etiquetas nuevas', 2)
  else collect_tap(
    ok(pruebas.busqueda_coincide('a3000000-0000-4000-8000-000000000001', 'tipografía'),
       'D22: después de asignar_etiquetas, busqueda incluye el nombre de una etiqueta nueva'),
    ok(not pruebas.busqueda_coincide('a3000000-0000-4000-8000-000000000001', 'seo'),
       'D22: después de asignar_etiquetas, busqueda ya no incluye una etiqueta quitada')
  ) end;

-- Un update de un publicado (título) notifica con sus etiquetas actuales.
select pruebas.marcar_cola();
select pruebas.como('h3-tax-editor@prueba.local');
update public.articulos set titulo = 'H3 taxonomías título nuevo',
       version = pruebas.version_de('a3000000-0000-4000-8000-000000000001')
 where id = 'a3000000-0000-4000-8000-000000000001';
select pruebas.como_postgres();
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: editar el título de un publicado encola un mensaje');
select is((select pruebas.ordenados(cuerpo -> 'etiquetas') from pruebas.cola_nueva()),
  array['h3-tax-diseno', 'h3-tax-tipografia'],
  'contrato: el mensaje de un update lleva las etiquetas actuales del artículo');

-- Borrar un publicado notifica con sus etiquetas reales (n10, antes del cascade).
select pruebas.marcar_cola();
select pruebas.como('h3-tax-admin@prueba.local');
delete from public.articulos where id = 'a3000000-0000-4000-8000-000000000004';
select pruebas.como_postgres();
select is_empty($$select 1 from public.articulos_etiquetas where articulo_id = 'a3000000-0000-4000-8000-000000000004'$$,
  'control: borrar el artículo borra sus filas de articulos_etiquetas (cascade)');
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: borrar un publicado con etiquetas encola un mensaje');
select is((select pruebas.ordenados(cuerpo -> 'etiquetas') from pruebas.cola_nueva()),
  array['h3-tax-seo', 'h3-tax-tipografia'],
  'contrato: el mensaje del borrado lleva las etiquetas que tenía (n10 las lee antes del cascade)');

-- ===========================================================================
-- RF-012 · D11: cambiar el slug de una categoría o etiqueta crea una redirección
-- ===========================================================================
-- Renombrar sin tocar el slug no lo cambia ni redirige (las URLs son estables).
select pruebas.como('h3-tax-editor@prueba.local');
update public.categorias set nombre = 'H3 Tax Renombrada Otra' where id = 'c3000000-0000-4000-8000-000000000003';
select pruebas.como_postgres();
select is((select slug from public.categorias where id = 'c3000000-0000-4000-8000-000000000003'), 'h3-tax-cat-vieja',
  'caso borde: renombrar una categoría no cambia su slug');
select is_empty($$select 1 from public.redirecciones where entidad_id = 'c3000000-0000-4000-8000-000000000003'$$,
  'caso borde: renombrar una categoría no crea redirección');

select pruebas.como('h3-tax-editor@prueba.local');
update public.categorias set slug = 'h3-tax-cat-nueva' where id = 'c3000000-0000-4000-8000-000000000003';
update public.etiquetas set slug = 'h3-tax-eti-nueva' where id = 'e3000000-0000-4000-8000-000000000005';
select pruebas.como_postgres();
select results_eq(
  $$select tipo_entidad::text, slug_anterior, entidad_id from public.redirecciones
     where slug_anterior in ('h3-tax-cat-vieja', 'h3-tax-eti-vieja') order by slug_anterior$$,
  $$values ('categoria'::text, 'h3-tax-cat-vieja'::text, 'c3000000-0000-4000-8000-000000000003'::uuid),
           ('etiqueta', 'h3-tax-eti-vieja', 'e3000000-0000-4000-8000-000000000005')$$,
  'RF-012: cambiar el slug de una categoría o de una etiqueta registra el anterior (siempre: son públicas)'
);

select pruebas.como_anon();
select is(public.resolver_redireccion('categoria', 'h3-tax-cat-vieja'), 'h3-tax-cat-nueva',
  'RSEO-003: para el visitante, el slug anterior de la categoría resuelve al nuevo');
select is(public.resolver_redireccion('etiqueta', 'h3-tax-eti-vieja'), 'h3-tax-eti-nueva',
  'RSEO-003: para el visitante, el slug anterior de la etiqueta resuelve al nuevo');
select is(public.resolver_redireccion('etiqueta', 'h3-tax-cat-vieja'), null,
  'resolver_redireccion distingue categoría de etiqueta');

-- Sin cadenas: A → B → C deja A y B apuntando a la entidad; volver a A borra la de A.
select pruebas.como('h3-tax-editor@prueba.local');
update public.categorias set slug = 'h3-tax-cat-tercera' where id = 'c3000000-0000-4000-8000-000000000003';
select pruebas.como_anon();
select is(public.resolver_redireccion('categoria', 'h3-tax-cat-vieja'), 'h3-tax-cat-tercera',
  'D11: después de A → B → C, el slug A resuelve al actual (sin cadenas)');
select pruebas.como('h3-tax-editor@prueba.local');
update public.categorias set slug = 'h3-tax-cat-vieja' where id = 'c3000000-0000-4000-8000-000000000003';
select pruebas.como_postgres();
select results_eq(
  $$select slug_anterior from public.redirecciones
     where entidad_id = 'c3000000-0000-4000-8000-000000000003' order by slug_anterior$$,
  $$values ('h3-tax-cat-nueva'::text), ('h3-tax-cat-tercera'::text)$$,
  'D11: volver al slug A borra su redirección y registra C'
);

-- Un slug anterior queda reservado para su 301 (A3-M1) mientras exista la entidad.
insert into public.etiquetas (nombre, slug) values ('H3 Tax Intrusa', 'h3-tax-eti-vieja');
select is((select slug from public.etiquetas where nombre = 'H3 Tax Intrusa'), 'h3-tax-eti-vieja-2',
  'A3-M1: una etiqueta nueva no ocupa el slug anterior de otra');

-- ===========================================================================
-- z30_borrar_redirecciones: borrar una taxonomía renombrada libera su slug anterior
-- (observación de arquitecto-db, ronda 4)
-- ===========================================================================
select pruebas.como('h3-tax-editor@prueba.local');
update public.categorias set slug = 'h3-tax-cat-borrar-nueva' where id = 'c3000000-0000-4000-8000-000000000004';
delete from public.categorias where id = 'c3000000-0000-4000-8000-000000000004';
delete from public.etiquetas where id = 'e3000000-0000-4000-8000-000000000005';
select pruebas.como_postgres();
select is_empty(
  $$select 1 from public.redirecciones
     where entidad_id in ('c3000000-0000-4000-8000-000000000004', 'e3000000-0000-4000-8000-000000000005')$$,
  'z30: borrar una categoría o una etiqueta borra sus redirecciones'
);
select pruebas.como('h3-tax-editor@prueba.local');
insert into public.categorias (nombre, slug) values ('H3 Tax Reusa Categoría', 'h3-tax-cat-borrar');
insert into public.etiquetas (nombre, slug) values ('H3 Tax Reusa Etiqueta', 'h3-tax-eti-nueva');
select pruebas.como_postgres();
select is((select slug from public.categorias where nombre = 'H3 Tax Reusa Categoría'), 'h3-tax-cat-borrar',
  'z30: una categoría nueva puede usar el slug anterior de una categoría borrada');
select is((select slug from public.etiquetas where nombre = 'H3 Tax Reusa Etiqueta'), 'h3-tax-eti-nueva',
  'z30: una etiqueta nueva puede usar el slug de una etiqueta renombrada y borrada');
select is(public.resolver_redireccion('etiqueta', 'h3-tax-eti-vieja'), null,
  'z30: el slug anterior de la etiqueta borrada ya no redirige');

-- Solo los triggers escriben redirecciones de taxonomías.
select pruebas.como('h3-tax-editor@prueba.local');
select throws_ok($$
  insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id)
  values ('categoria', 'h3-tax-intrusa', 'c3000000-0000-4000-8000-000000000001')
$$, '42501', null, 'un editor no puede insertar redirecciones de categorías');

select pruebas.como_postgres();
select * from finish();
rollback;
