-- T034: publicación y máquina de estados (H2-E1, H2-E3, H2-E5, RF-009, RF-010).
-- Trigger a40_validar_estado, checks de estado de articulos, campos_sistema_articulo
-- de H2 (el cliente ya puede cambiar estado y programado_para) y visibilidad por rol.
-- research D6 · data-model "Máquina de estados".
-- No depende del seed: crea sus propios usuarios @prueba.local, su categoría y
-- sus artículos con slugs propios (prefijo h2-pub-).
begin;
\ir helpers/pruebas.psql
select plan(43);

select pruebas.crear_usuario('h2-pub-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Pub Editor"}');
select pruebas.crear_usuario('h2-pub-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Dos Pub Admin"}');

delete from public.articulos where slug like 'h2-pub-%';
delete from public.categorias where slug like 'h2-pub-%' or lower(nombre) = lower('H2 Pub Categoría');
insert into public.categorias (nombre, slug) values ('H2 Pub Categoría', 'h2-pub-categoria');

create function pruebas.contenido_h2() returns jsonb
language sql immutable as $$
  select '[{"id": "b2000000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Cuerpo publicable."}]'::jsonb
$$;
create function pruebas.categoria_h2() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.categorias where slug = 'h2-pub-categoria'
$$;
create function pruebas.autor_h2() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = 'h2-pub-editor@prueba.local'
$$;

-- Crea, como sistema (postgres), un artículo listo para publicar en el estado
-- de origen y devuelve su id. El sistema (seed) puede insertar en cualquier estado.
create function pruebas.articulo_en(origen public.estado_articulo, sufijo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  nuevo uuid;
begin
  insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, programado_para, publicado_en)
  values (
    'H2 matriz ' || sufijo, 'h2-pub-' || sufijo, pruebas.contenido_h2(), pruebas.categoria_h2(), pruebas.autor_h2(),
    origen,
    case when origen = 'programado' then now() + interval '1 day' end,
    case when origen in ('publicado', 'archivado') then now() - interval '1 day' end
  )
  returning id into nuevo;
  return nuevo;
end
$$;

-- Cambia el estado con la versión actual (como el rol en curso) y devuelve el
-- estado resultante. Si el destino es programado, envía una fecha futura.
create function pruebas.transicion(articulo uuid, destino public.estado_articulo) returns text
language plpgsql as $$
declare
  resultado text;
begin
  update public.articulos
     set estado = destino,
         programado_para = case when destino = 'programado' then now() + interval '2 days' else programado_para end,
         version = (select a.version from public.articulos a where a.id = articulo)
   where id = articulo
  returning estado::text into resultado;
  return resultado;
end
$$;

-- Igual que transicion, pero devuelve el error como texto: 'SQLSTATE mensaje: detalle'.
create function pruebas.intentar_transicion(articulo uuid, destino public.estado_articulo) returns text
language plpgsql as $$
declare
  detalle text;
begin
  return pruebas.transicion(articulo, destino);
exception when others then
  get stacked diagnostics detalle = pg_exception_detail;
  return format('%s %s: %s', sqlstate, sqlerrm, detalle);
end
$$;

grant execute on function pruebas.contenido_h2(), pruebas.categoria_h2(), pruebas.autor_h2(),
  pruebas.transicion(uuid, public.estado_articulo), pruebas.intentar_transicion(uuid, public.estado_articulo)
  to anon, authenticated;

-- Artículos de la matriz, uno por combinación (los crea el sistema).
create temporary table matriz on commit drop as
select o.origen, d.destino,
       (o.origen, d.destino) in (
         ('borrador'::public.estado_articulo, 'programado'::public.estado_articulo),
         ('borrador', 'publicado'), ('programado', 'borrador'), ('programado', 'publicado'),
         ('publicado', 'archivado'), ('publicado', 'borrador'), ('archivado', 'borrador')
       ) as permitida,
       pruebas.articulo_en(o.origen, 'm-' || o.origen || '-' || d.destino) as id
from unnest(enum_range(null::public.estado_articulo)) as o(origen)
cross join unnest(enum_range(null::public.estado_articulo)) as d(destino)
where o.origen <> d.destino;
grant select on matriz to authenticated, anon;

select is((select count(*)::int from matriz where permitida), 7,
  'RF-009: la matriz tiene exactamente 7 transiciones permitidas');

-- ---------------------------------------------------------------------------
-- RF-009: las 7 transiciones permitidas (como editor, un cliente)
-- ---------------------------------------------------------------------------
select pruebas.como('h2-pub-editor@prueba.local');
select is(pruebas.intentar_transicion(id, destino), destino::text,
          format('RF-009: %s → %s se permite', origen, destino))
from matriz where permitida order by origen, destino;

-- ---------------------------------------------------------------------------
-- RF-009: las otras 5 combinaciones lanzan estado_invalido
-- ---------------------------------------------------------------------------
select throws_ok(format('select pruebas.transicion(%L, %L)', id, destino), 'P0001', 'estado_invalido',
                 format('RF-009: %s → %s lanza estado_invalido', origen, destino))
from matriz where not permitida order by origen, destino;

-- La matriz vale para todos los roles: también para el sistema (postgres).
select pruebas.como_postgres();
select throws_ok(
  format('select pruebas.transicion(%L, %L)', pruebas.articulo_en('archivado', 'sistema-archivado'), 'publicado'),
  'P0001', 'estado_invalido', 'RF-009: archivado → publicado lanza estado_invalido también para el sistema');

-- Editar sin cambiar de estado no es una transición: se permite.
select pruebas.como('h2-pub-editor@prueba.local');
select lives_ok(
  format($$update public.articulos set titulo = 'Publicado editado',
             version = (select a.version from public.articulos a where a.id = %1$L) where id = %1$L$$,
         (select id from matriz where origen = 'publicado' and destino = 'programado')),
  'RF-009: editar un artículo sin cambiar su estado no es una transición y se permite');

-- ---------------------------------------------------------------------------
-- H2-E5 y RF-010: requisitos para publicar
-- ---------------------------------------------------------------------------
insert into public.articulos (id, titulo, slug, contenido)
  values ('a2000000-0000-4000-8000-000000000001', 'H2 sin categoría', 'h2-pub-sin-categoria', pruebas.contenido_h2());
select is(
  pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000001', 'publicado'),
  'P0001 requisitos_publicacion: categoria',
  'H2-E5: publicar un borrador sin categoría lanza requisitos_publicacion con detail = categoria'
);
select is(
  pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000001', 'programado'),
  'P0001 requisitos_publicacion: categoria',
  'RF-010: programar un borrador sin categoría lanza requisitos_publicacion con detail = categoria'
);

insert into public.articulos (id, titulo, slug, categoria_id)
  values ('a2000000-0000-4000-8000-000000000002', 'H2 sin bloques', 'h2-pub-sin-bloques', pruebas.categoria_h2());
select is(
  pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000002', 'publicado'),
  'P0001 requisitos_publicacion: contenido',
  'RF-010: publicar un borrador sin bloques lanza requisitos_publicacion con detail = contenido'
);
select pruebas.como_postgres();
select results_eq(
  $$select estado::text, publicado_en is null from public.articulos
    where id in ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002')$$,
  $$values ('borrador'::text, true), ('borrador'::text, true)$$,
  'H2-E5: la publicación rechazada no cambia nada'
);
select throws_ok($$
  insert into public.articulos (titulo, slug, contenido, autor_id, estado, publicado_en)
  values ('H2 sistema sin categoría', 'h2-pub-sistema-sin-categoria', pruebas.contenido_h2(), pruebas.autor_h2(),
          'publicado', now())
$$, 'P0001', 'requisitos_publicacion', 'RF-010: el sistema tampoco inserta un publicado sin categoría');

-- ---------------------------------------------------------------------------
-- H2-E1: un editor publica un borrador con categoría
-- ---------------------------------------------------------------------------
select pruebas.como('h2-pub-editor@prueba.local');
insert into public.articulos (id, titulo, slug, contenido, categoria_id)
  values ('a2000000-0000-4000-8000-000000000003', 'H2 para publicar', 'h2-pub-para-publicar',
          pruebas.contenido_h2(), pruebas.categoria_h2());

select pruebas.como_anon();
select is_empty($$select 1 from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'H2-E1: antes de publicarlo, el visitante no ve el borrador');

select pruebas.como('h2-pub-editor@prueba.local');
select is(pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000003', 'publicado'), 'publicado',
  'H2-E1: el editor publica el borrador con categoría');
select ok(
  (select publicado_en between now() - interval '1 minute' and clock_timestamp()
   from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'),
  'H2-E1: la primera publicación registra publicado_en ≈ now()'
);
select is((select programado_para from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'), null,
  'H2-E1: un publicado no conserva programado_para');

select pruebas.como_anon();
select results_eq(
  $$select titulo, slug, contenido from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'$$,
  $$values ('H2 para publicar'::text, 'h2-pub-para-publicar'::text, pruebas.contenido_h2())$$,
  'H2-E1: el visitante lee el artículo publicado completo'
);

-- ---------------------------------------------------------------------------
-- H2-E3: archivar oculta para el visitante y conserva para el equipo
-- ---------------------------------------------------------------------------
select pruebas.como('h2-pub-editor@prueba.local');
select is(pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000003', 'archivado'), 'archivado',
  'H2-E3: el editor archiva el artículo publicado');
select pruebas.como_anon();
select is_empty($$select 1 from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'H2-E3: el artículo archivado deja de ser visible para el visitante');
select pruebas.como('h2-pub-editor@prueba.local');
select isnt_empty($$select 1 from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'H2-E3: el artículo archivado se conserva visible para el equipo (editor)');
select pruebas.como('h2-pub-admin@prueba.local');
select isnt_empty($$select 1 from public.articulos where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'H2-E3: el artículo archivado se conserva visible para el equipo (admin)');

-- ---------------------------------------------------------------------------
-- Despublicar (publicado → borrador) oculta para el visitante
-- ---------------------------------------------------------------------------
select pruebas.como('h2-pub-editor@prueba.local');
insert into public.articulos (id, titulo, slug, contenido, categoria_id)
  values ('a2000000-0000-4000-8000-000000000004', 'H2 para despublicar', 'h2-pub-para-despublicar',
          pruebas.contenido_h2(), pruebas.categoria_h2());
select pruebas.transicion('a2000000-0000-4000-8000-000000000004', 'publicado');
select pruebas.como_anon();
select isnt_empty($$select 1 from public.articulos where id = 'a2000000-0000-4000-8000-000000000004'$$,
  'un artículo publicado es visible para el visitante');
select pruebas.como('h2-pub-editor@prueba.local');
select is(pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000004', 'borrador'), 'borrador',
  'publicado → borrador (despublicar) se permite');
select pruebas.como_anon();
select is_empty($$select 1 from public.articulos where id = 'a2000000-0000-4000-8000-000000000004'$$,
  'despublicar oculta el artículo para el visitante');

-- ---------------------------------------------------------------------------
-- D6: la republicación conserva el publicado_en original
-- ---------------------------------------------------------------------------
select pruebas.como_postgres();
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
  values ('a2000000-0000-4000-8000-000000000005', 'H2 republicar', 'h2-pub-republicar', pruebas.contenido_h2(),
          pruebas.categoria_h2(), pruebas.autor_h2(), 'publicado', '2025-03-01 12:00+00');
select is((select publicado_en from public.articulos where id = 'a2000000-0000-4000-8000-000000000005'),
  '2025-03-01 12:00+00'::timestamptz,
  'D18: un insert del sistema en publicado conserva el publicado_en que trae');

select pruebas.como('h2-pub-editor@prueba.local');
select is(
  pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000005', 'archivado') || ' → '
  || pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000005', 'borrador') || ' → '
  || pruebas.intentar_transicion('a2000000-0000-4000-8000-000000000005', 'publicado'),
  'archivado → borrador → publicado',
  'D6: el editor archiva, pasa a borrador y vuelve a publicar'
);
select is((select publicado_en from public.articulos where id = 'a2000000-0000-4000-8000-000000000005'),
  '2025-03-01 12:00+00'::timestamptz,
  'D6: la republicación conserva el publicado_en original');

-- ---------------------------------------------------------------------------
-- D18: el sistema (seed) puede insertar en cualquier estado
-- ---------------------------------------------------------------------------
select pruebas.como_postgres();
select lives_ok($$
  insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
  values ('H2 seed archivado', 'h2-pub-seed-archivado', pruebas.contenido_h2(), pruebas.categoria_h2(),
          pruebas.autor_h2(), 'archivado', '2025-01-01 10:00+00')
$$, 'D18: el sistema puede insertar un artículo archivado');
select lives_ok($$
  insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, programado_para)
  values ('H2 seed programado', 'h2-pub-seed-programado', pruebas.contenido_h2(), pruebas.categoria_h2(),
          pruebas.autor_h2(), 'programado', now() + interval '3 days')
$$, 'D18: el sistema puede insertar un artículo programado con fecha futura');
select results_eq(
  $$select estado::text, programado_para > now() from public.articulos where slug = 'h2-pub-seed-programado'$$,
  $$values ('programado'::text, true)$$,
  'D18: el programado insertado por el sistema conserva estado y fecha'
);

-- ---------------------------------------------------------------------------
-- Checks declarativos de estado (sin triggers, para probar el check en sí)
-- ---------------------------------------------------------------------------
alter table public.articulos disable trigger user;
select lives_ok($$
  insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
  values ('H2 check control', 'h2-pub-check-control', pruebas.contenido_h2(), pruebas.categoria_h2(),
          pruebas.autor_h2(), 'publicado', now())
$$, 'checks: control positivo (un publicado completo se acepta aun sin triggers)');
select throws_ok($$
  insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en)
  values ('H2 check publicado', 'h2-pub-check-publicado', pruebas.contenido_h2(), pruebas.categoria_h2(),
          pruebas.autor_h2(), 'publicado', null)
$$, '23514', null, 'check: estado <> publicado or publicado_en is not null');
select throws_ok($$
  insert into public.articulos (titulo, slug, contenido, categoria_id, autor_id, estado, programado_para)
  values ('H2 check programado', 'h2-pub-check-programado', pruebas.contenido_h2(), pruebas.categoria_h2(),
          pruebas.autor_h2(), 'programado', null)
$$, '23514', null, 'check: estado <> programado or programado_para is not null');
select throws_ok($$
  insert into public.articulos (titulo, slug, contenido, autor_id, estado, publicado_en)
  values ('H2 check sin categoría', 'h2-pub-check-sin-categoria', pruebas.contenido_h2(),
          pruebas.autor_h2(), 'publicado', now())
$$, '23514', null, 'check: un publicado sin categoría viola el check de requisitos');
select throws_ok($$
  insert into public.articulos (titulo, slug, categoria_id, autor_id, estado, publicado_en)
  values ('H2 check sin bloques', 'h2-pub-check-sin-bloques', pruebas.categoria_h2(),
          pruebas.autor_h2(), 'publicado', now())
$$, '23514', null, 'check: un publicado sin bloques viola el check de requisitos');
alter table public.articulos enable trigger user;

select pruebas.como_postgres();
select * from finish();
rollback;
