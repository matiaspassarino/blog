-- T053: programar una publicación (H4-E1 a H4-E4, RF-011, CE-003).
-- privado.publicar_programados() (cron), jobs de pg_cron y la parte de
-- a40_validar_estado que toca a la programación.
-- research D6 · data-model "Máquina de estados" · tasks T054.
-- No depende del seed: crea sus propios usuarios @prueba.local, su categoría y
-- sus artículos con slugs propios (prefijo h4-prog-).
begin;
\ir helpers/pruebas.psql
select plan(29);

select pruebas.crear_usuario('h4-prog-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Cuatro Editor"}');

delete from public.articulos where slug like 'h4-prog-%';
delete from public.categorias where slug like 'h4-prog-%' or lower(nombre) = lower('H4 Prog Categoría');
insert into public.categorias (nombre, slug) values ('H4 Prog Categoría', 'h4-prog-categoria');

create function pruebas.contenido_h4() returns jsonb
language sql immutable as $$
  select '{"type": "doc", "content": [{"type": "paragraph", "attrs": {"id": "b4000000-0000-4000-8000-000000000001"}, "content": [{"type": "text", "text": "Cuerpo programable."}]}]}'::jsonb
$$;
create function pruebas.categoria_h4() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.categorias where slug = 'h4-prog-categoria'
$$;

-- Cambia estado y programado_para con la versión actual (como el rol en curso)
-- y devuelve el estado resultante.
create function pruebas.programar_h4(articulo uuid, destino public.estado_articulo, fecha timestamptz) returns text
language plpgsql as $$
declare
  resultado text;
begin
  update public.articulos
     set estado = destino,
         programado_para = fecha,
         version = (select a.version from public.articulos a where a.id = articulo)
   where id = articulo
  returning estado::text into resultado;
  return resultado;
end
$$;

grant execute on function pruebas.contenido_h4(), pruebas.categoria_h4(),
  pruebas.programar_h4(uuid, public.estado_articulo, timestamptz)
  to anon, authenticated;

-- Borradores del editor, con categoría y bloques (listos para programar).
select pruebas.como('h4-prog-editor@prueba.local');
insert into public.articulos (id, titulo, slug, contenido, categoria_id) values
  ('a4000000-0000-4000-8000-000000000001', 'H4 programar', 'h4-prog-programar', pruebas.contenido_h4(), pruebas.categoria_h4()),
  ('a4000000-0000-4000-8000-000000000002', 'H4 fecha pasada', 'h4-prog-fecha-pasada', pruebas.contenido_h4(), pruebas.categoria_h4()),
  ('a4000000-0000-4000-8000-000000000003', 'H4 cancelar', 'h4-prog-cancelar', pruebas.contenido_h4(), pruebas.categoria_h4()),
  ('a4000000-0000-4000-8000-000000000004', 'H4 vencido', 'h4-prog-vencido', pruebas.contenido_h4(), pruebas.categoria_h4()),
  ('a4000000-0000-4000-8000-000000000005', 'H4 futuro', 'h4-prog-futuro', pruebas.contenido_h4(), pruebas.categoria_h4()),
  ('a4000000-0000-4000-8000-000000000006', 'H4 manual', 'h4-prog-manual', pruebas.contenido_h4(), pruebas.categoria_h4());

-- ---------------------------------------------------------------------------
-- H4-E1: programar para mañana deja el artículo programado e invisible
-- ---------------------------------------------------------------------------
select is(
  pruebas.programar_h4('a4000000-0000-4000-8000-000000000001', 'programado', now() + interval '1 day'),
  'programado',
  'H4-E1: el editor programa un borrador con categoría para mañana'
);
select results_eq(
  $$select estado::text, programado_para, publicado_en is null
    from public.articulos where id = 'a4000000-0000-4000-8000-000000000001'$$,
  $$values ('programado'::text, now() + interval '1 day', true)$$,
  'H4-E1: queda en estado programado, con programado_para y sin publicado_en'
);
select pruebas.como_anon();
select is_empty($$select 1 from public.articulos where id = 'a4000000-0000-4000-8000-000000000001'$$,
  'H4-E1: el visitante no ve el artículo programado (tabla)');
select is_empty($$select 1 from public.articulos where slug = 'h4-prog-programar'$$,
  'H4-E1: el visitante tampoco lo encuentra por slug');

-- ---------------------------------------------------------------------------
-- H4-E3 y RF-011: programar para una fecha pasada se rechaza
-- ---------------------------------------------------------------------------
select pruebas.como('h4-prog-editor@prueba.local');
select throws_ok(
  $$select pruebas.programar_h4('a4000000-0000-4000-8000-000000000002', 'programado', now() - interval '1 hour')$$,
  'P0001', 'fecha_no_futura',
  'H4-E3: programar para una fecha pasada lanza fecha_no_futura'
);
select throws_ok(
  $$select pruebas.programar_h4('a4000000-0000-4000-8000-000000000002', 'programado', now())$$,
  'P0001', 'fecha_no_futura',
  'RF-011: programar para ahora mismo (no futura) lanza fecha_no_futura'
);
select results_eq(
  $$select estado::text, programado_para is null from public.articulos where id = 'a4000000-0000-4000-8000-000000000002'$$,
  $$values ('borrador'::text, true)$$,
  'H4-E3: la programación rechazada no cambia nada'
);

-- ---------------------------------------------------------------------------
-- H4-E4: cancelar la programación vuelve a borrador y limpia programado_para
-- ---------------------------------------------------------------------------
select pruebas.programar_h4('a4000000-0000-4000-8000-000000000003', 'programado', now() + interval '2 days');
select is(
  pruebas.programar_h4('a4000000-0000-4000-8000-000000000003', 'borrador',
    (select programado_para from public.articulos where id = 'a4000000-0000-4000-8000-000000000003')),
  'borrador',
  'H4-E4: el editor cancela la programación (programado → borrador)'
);
select results_eq(
  $$select estado::text, programado_para is null, publicado_en is null
    from public.articulos where id = 'a4000000-0000-4000-8000-000000000003'$$,
  $$values ('borrador'::text, true, true)$$,
  'H4-E4: cancelar limpia programado_para y no publica'
);

-- ---------------------------------------------------------------------------
-- H4-E2, RF-011, CE-003: el cron publica los programados vencidos
-- ---------------------------------------------------------------------------
select pruebas.programar_h4('a4000000-0000-4000-8000-000000000004', 'programado', now() + interval '1 day');
select pruebas.programar_h4('a4000000-0000-4000-8000-000000000005', 'programado', now() + interval '1 day');

-- El sistema (postgres) fuerza la fecha al pasado: simula que llegó la hora.
select pruebas.como_postgres();
update public.articulos
   set programado_para = '2026-01-15 10:00+00',
       version = version
 where id = 'a4000000-0000-4000-8000-000000000004';
select results_eq(
  $$select estado::text, programado_para from public.articulos where id = 'a4000000-0000-4000-8000-000000000004'$$,
  $$values ('programado'::text, '2026-01-15 10:00+00'::timestamptz)$$,
  'preparación: el sistema puede dejar un programado con la fecha vencida'
);

create temporary table versiones_previas on commit drop as
  select id, version from public.articulos
  where id in ('a4000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000005');

select has_function('privado', 'publicar_programados', array[]::text[],
  'existe privado.publicar_programados()');
select is_definer('privado', 'publicar_programados', array[]::text[],
  'privado.publicar_programados() es security definer');
select lives_ok('select privado.publicar_programados()',
  'H4-E2: privado.publicar_programados() se ejecuta sin errores');

select results_eq(
  $$select estado::text, publicado_en, programado_para is null
    from public.articulos where id = 'a4000000-0000-4000-8000-000000000004'$$,
  $$values ('publicado'::text, '2026-01-15 10:00+00'::timestamptz, true)$$,
  'H4-E2: el programado vencido pasa a publicado con publicado_en = programado_para'
);
select is(
  (select contenido from public.articulos where id = 'a4000000-0000-4000-8000-000000000004'),
  pruebas.contenido_h4(),
  'spec 005 (T096): publicar_programados publica un programado con un documento y no lo cambia'
);
select is(
  (select a.version from public.articulos a where a.id = 'a4000000-0000-4000-8000-000000000004'),
  (select v.version + 1 from versiones_previas v where v.id = 'a4000000-0000-4000-8000-000000000004'),
  'H4-E2: la publicación automática incrementa la versión'
);
select pruebas.como_anon();
select isnt_empty($$select 1 from public.articulos where id = 'a4000000-0000-4000-8000-000000000004'$$,
  'H4-E2: después de publicarse solo, el visitante lo ve');

select pruebas.como_postgres();
select results_eq(
  $$select a.estado::text, a.programado_para = now() + interval '1 day', a.version = v.version, a.publicado_en is null
    from public.articulos a join versiones_previas v using (id)
    where a.id = 'a4000000-0000-4000-8000-000000000005'$$,
  $$values ('programado'::text, true, true, true)$$,
  'H4-E2: un programado con fecha futura no se toca'
);
select pruebas.como_anon();
select is_empty($$select 1 from public.articulos where id = 'a4000000-0000-4000-8000-000000000005'$$,
  'H4-E2: el programado futuro sigue invisible para el visitante');

-- Una segunda pasada no vuelve a tocar lo ya publicado.
select pruebas.como_postgres();
select lives_ok('select privado.publicar_programados()',
  'H4-E2: una segunda ejecución del cron no falla');
select is(
  (select a.version from public.articulos a where a.id = 'a4000000-0000-4000-8000-000000000004'),
  (select v.version + 1 from versiones_previas v where v.id = 'a4000000-0000-4000-8000-000000000004'),
  'H4-E2: una segunda ejecución no vuelve a tocar el artículo ya publicado'
);

-- ---------------------------------------------------------------------------
-- Caso borde: publicar manualmente un programado usa now() y descarta la programación
-- ---------------------------------------------------------------------------
select pruebas.como('h4-prog-editor@prueba.local');
select pruebas.programar_h4('a4000000-0000-4000-8000-000000000006', 'programado', now() + interval '3 days');
select is(
  pruebas.programar_h4('a4000000-0000-4000-8000-000000000006', 'publicado',
    (select programado_para from public.articulos where id = 'a4000000-0000-4000-8000-000000000006')),
  'publicado',
  'borde H4: el editor publica manualmente un artículo programado antes de su hora'
);
select results_eq(
  $$select publicado_en = now(), programado_para is null
    from public.articulos where id = 'a4000000-0000-4000-8000-000000000006'$$,
  $$values (true, true)$$,
  'borde H4: la publicación manual usa now() como publicado_en y descarta programado_para'
);

-- ---------------------------------------------------------------------------
-- Jobs de pg_cron (CE-003: publicación en menos de 60 s)
-- ---------------------------------------------------------------------------
select pruebas.como_postgres();
select results_eq(
  $$select schedule, active from cron.job where jobname = 'publicar-programados'$$,
  $$values ('* * * * *'::text, true)$$,
  'CE-003: existe el job publicar-programados, activo y cada minuto (* * * * *)'
);
select ok(
  coalesce((select command ilike '%privado.publicar_programados()%' from cron.job where jobname = 'publicar-programados'), false),
  'CE-003: el job publicar-programados ejecuta privado.publicar_programados()'
);
select isnt_empty($$select 1 from cron.job where jobname = 'limpiar-historial-cron'$$,
  'existe el job limpiar-historial-cron');
select ok(
  coalesce((select command ilike '%cron.job_run_details%' from cron.job where jobname = 'limpiar-historial-cron'), false),
  'el job limpiar-historial-cron limpia cron.job_run_details'
);

-- ---------------------------------------------------------------------------
-- Privilegios: publicar_programados solo la ejecuta el sistema
-- ---------------------------------------------------------------------------
select function_privs_are('privado', 'publicar_programados', array[]::text[], 'anon', array[]::text[],
  'anon no puede ejecutar privado.publicar_programados');
select function_privs_are('privado', 'publicar_programados', array[]::text[], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.publicar_programados');

select pruebas.como_postgres();
select * from finish();
rollback;
