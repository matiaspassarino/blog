-- Etiquetado y taxonomías: articulos_etiquetas, asignar_etiquetas, categorías en
-- uso y redirecciones de taxonomías.
-- Spec 001 H3 · research D11, D22, D23 · data-model "articulos_etiquetas".
-- La única vía de escritura de articulos_etiquetas es asignar_etiquetas (D22).

create table public.articulos_etiquetas (
  articulo_id uuid not null references public.articulos (id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas (id) on delete cascade,
  primary key (articulo_id, etiqueta_id)
);
create index articulos_etiquetas_etiqueta_idx on public.articulos_etiquetas (etiqueta_id, articulo_id);

-- Lectura: lo que es visible del artículo. Sin políticas de escritura.
alter table public.articulos_etiquetas enable row level security;
create policy ae_select_publico on public.articulos_etiquetas
  for select to anon
  using (exists (select 1 from public.articulos a where a.id = articulo_id and a.estado = 'publicado' and a.publicado_en <= now()));
create policy ae_select_equipo on public.articulos_etiquetas
  for select to authenticated
  using (exists (select 1 from public.articulos a where a.id = articulo_id and a.estado = 'publicado' and a.publicado_en <= now())
         or (select privado.es_equipo()));
grant select on public.articulos_etiquetas to anon, authenticated;

-- ---------------------------------------------------------------------------
-- mensaje_articulo con etiquetas (validación A4-M2). Drop + create: con un
-- parámetro más como sobrecarga, las llamadas de 3 argumentos serían ambiguas.
-- PL/pgSQL no registra dependencias, así que se recrean también los llamadores.
-- Los parámetros se califican (mensaje_articulo.id): sin eso, `id` dentro del
-- subselect resolvería a la columna e.id sin error.
-- ---------------------------------------------------------------------------
drop function privado.mensaje_articulo(uuid, jsonb, uuid[]);
create function privado.mensaje_articulo(id uuid, slugs jsonb, categoria_ids uuid[], etiqueta_ids_extra uuid[] default '{}')
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'tipo', 'articulo',
    'id', mensaje_articulo.id,
    'slugs', slugs,
    'categorias', (
      select coalesce(jsonb_agg(distinct c.slug), '[]'::jsonb)
      from public.categorias c
      where c.id = any (categoria_ids)
    ),
    'etiquetas', (
      select coalesce(jsonb_agg(distinct e.slug), '[]'::jsonb)
      from public.etiquetas e
      where e.id in (select ae.etiqueta_id from public.articulos_etiquetas ae where ae.articulo_id = mensaje_articulo.id)
         or e.id = any (etiqueta_ids_extra)
    )
  )
$$;

create or replace function privado.notificar_cambio_articulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes_publico boolean := tg_op = 'UPDATE' and privado.es_publico(old.estado, old.publicado_en);
  ahora_publico boolean := privado.es_publico(new.estado, new.publicado_en);
begin
  if not (antes_publico or ahora_publico) then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - '{busqueda,version,actualizado_en}'::text[])
       = (to_jsonb(old) - '{busqueda,version,actualizado_en}'::text[]) then
    return null;
  end if;
  perform privado.notificar_cambio_publico(privado.mensaje_articulo(
    new.id,
    privado.slugs_afectados(new.slug, case when tg_op = 'UPDATE' then old.slug end),
    array[new.categoria_id, case when tg_op = 'UPDATE' then old.categoria_id end]
  ));
  return null;
end
$$;

create or replace function privado.notificar_borrado_articulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if privado.es_publico(old.estado, old.publicado_en) then
    perform privado.notificar_cambio_publico(
      privado.mensaje_articulo(old.id, privado.slugs_afectados(null, old.slug), array[old.categoria_id])
    );
  end if;
  return old;
end
$$;

-- ---------------------------------------------------------------------------
-- asignar_etiquetas (D22): atómica, una sola subida de versión y una sola
-- notificación con las etiquetas de antes y de después. Parámetros calificados
-- (articulo_id y version chocan con columnas).
-- ---------------------------------------------------------------------------
create function public.asignar_etiquetas(articulo_id uuid, etiqueta_ids uuid[], version int)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fila record;
  anteriores uuid[];
begin
  if not privado.es_equipo() then
    raise exception using errcode = 'P0001', message = 'sin_permiso';
  end if;
  -- Validación de entrada antes de tocar nada (validación A5-M2).
  if asignar_etiquetas.etiqueta_ids is null
     or array_ndims(asignar_etiquetas.etiqueta_ids) > 1
     or array_position(asignar_etiquetas.etiqueta_ids, null) is not null then
    raise exception using errcode = 'P0001', message = 'contenido_invalido', detail = 'etiquetas';
  end if;
  if (select count(distinct t.id) from unnest(asignar_etiquetas.etiqueta_ids) as t(id)) > 100 then
    raise exception using errcode = 'P0001', message = 'contenido_invalido', detail = 'etiquetas: máximo 100';
  end if;
  -- Orden de bloqueo: etiquetas (por id) y después el artículo, igual que el
  -- borrado de una etiqueta (etiqueta → articulos_etiquetas → artículo). Con el
  -- orden inverso había deadlock (validación A6-M1). El for key share vuelve
  -- atómico el chequeo de existencia frente a un borrado concurrente (A6-M3).
  if (
    select count(*) from (
      select 1 from public.etiquetas e
      where e.id = any (asignar_etiquetas.etiqueta_ids)
      order by e.id
      for key share
    ) as bloqueadas
  ) <> (select count(distinct t.id) from unnest(asignar_etiquetas.etiqueta_ids) as t(id)) then
    raise exception using errcode = 'P0001', message = 'no_encontrado', detail = 'etiqueta';
  end if;

  select a.version, a.slug, a.categoria_id, a.estado, a.publicado_en into fila
  from public.articulos a where a.id = asignar_etiquetas.articulo_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'no_encontrado';
  end if;
  if fila.version is distinct from asignar_etiquetas.version then
    raise exception using errcode = 'P0001', message = 'conflicto_version';
  end if;

  select coalesce(array_agg(ae.etiqueta_id), '{}') into anteriores
  from public.articulos_etiquetas ae where ae.articulo_id = asignar_etiquetas.articulo_id;

  -- Reemplazo por diferencia: borrar todo y reinsertar podía trabarse (deadlock)
  -- con el borrado concurrente de una etiqueta que se conserva (validación A5-M1).
  delete from public.articulos_etiquetas ae
  where ae.articulo_id = asignar_etiquetas.articulo_id
    and ae.etiqueta_id <> all (asignar_etiquetas.etiqueta_ids);
  insert into public.articulos_etiquetas (articulo_id, etiqueta_id)
  select distinct asignar_etiquetas.articulo_id, t.id from unnest(asignar_etiquetas.etiqueta_ids) as t(id)
  on conflict do nothing;

  update public.articulos a set version = asignar_etiquetas.version where a.id = asignar_etiquetas.articulo_id;

  if privado.es_publico(fila.estado, fila.publicado_en) then
    perform privado.notificar_cambio_publico(privado.mensaje_articulo(
      asignar_etiquetas.articulo_id, privado.slugs_afectados(fila.slug, null), array[fila.categoria_id], anteriores));
  end if;
  return asignar_etiquetas.version + 1;
end
$$;
revoke execute on function public.asignar_etiquetas(uuid, uuid[], int) from public, anon, authenticated;
grant execute on function public.asignar_etiquetas(uuid, uuid[], int) to authenticated;

-- ---------------------------------------------------------------------------
-- Categorías en uso (RF-016, D23): error accionable con el conteo
-- ---------------------------------------------------------------------------
create function privado.impedir_borrado_categoria_en_uso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conteo int;
begin
  select count(*) into conteo from public.articulos a where a.categoria_id = old.id;
  if conteo > 0 then
    raise exception using errcode = 'P0001', message = 'categoria_en_uso', detail = conteo::text;
  end if;
  return old;
end
$$;
create trigger a05_impedir_borrado_en_uso
  before delete on public.categorias
  for each row execute function privado.impedir_borrado_categoria_en_uso();

-- ---------------------------------------------------------------------------
-- Redirecciones de taxonomías (siempre públicas; condición en el WHEN, A3-B1).
-- z30 y no z20: z20 queda para z20_recalcular_articulos (H5).
-- ---------------------------------------------------------------------------
create trigger z10_registrar_redireccion
  after update on public.categorias
  for each row when (old.slug is distinct from new.slug)
  execute function privado.registrar_redireccion('categoria');
create trigger z30_borrar_redirecciones
  after delete on public.categorias
  for each row execute function privado.borrar_redirecciones('categoria');
create trigger z10_registrar_redireccion
  after update on public.etiquetas
  for each row when (old.slug is distinct from new.slug)
  execute function privado.registrar_redireccion('etiqueta');
create trigger z30_borrar_redirecciones
  after delete on public.etiquetas
  for each row execute function privado.borrar_redirecciones('etiqueta');

-- ---------------------------------------------------------------------------
-- Sitemap (RSEO-004, validación A5-B1). Un único jsonb: PostgREST corta las
-- respuestas de filas en max_rows (1000), un escalar no. Invoker: la RLS decide
-- qué es visible; el predicado de publicado va explícito.
-- ---------------------------------------------------------------------------
create function public.entradas_sitemap()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.tipo, x.slug), '[]'::jsonb)
  from (
    select 'articulo' as tipo, a.slug, a.actualizado_en
    from public.articulos a
    where a.estado = 'publicado' and a.publicado_en <= now()
    union all
    select 'categoria', c.slug, c.actualizado_en
    from public.categorias c
    where exists (
      select 1 from public.articulos a
      where a.categoria_id = c.id and a.estado = 'publicado' and a.publicado_en <= now()
    )
    union all
    select 'etiqueta', e.slug, e.actualizado_en
    from public.etiquetas e
    where exists (
      select 1 from public.articulos_etiquetas ae
      join public.articulos a on a.id = ae.articulo_id
      where ae.etiqueta_id = e.id and a.estado = 'publicado' and a.publicado_en <= now()
    )
  ) as x
$$;

revoke execute on function public.entradas_sitemap() from public, anon, authenticated;
grant execute on function public.entradas_sitemap() to anon, authenticated;
