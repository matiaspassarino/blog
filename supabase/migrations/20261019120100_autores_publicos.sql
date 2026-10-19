-- Autores públicos: slug inmutable, vista y sitemap con autores, aviso de cambios de autor.
-- Spec 002 · research D10, D11, D14 · data-model "Migración 2".

-- ---------------------------------------------------------------------------
-- 1. Columna (nullable mientras dura el backfill)
-- ---------------------------------------------------------------------------
alter table public.perfiles add column slug text;

-- ---------------------------------------------------------------------------
-- 2. slug_disponible y asignar_slug conocen a los autores (misma firma: conservan grants)
-- ---------------------------------------------------------------------------
create or replace function privado.slug_disponible(tipo public.tipo_entidad, texto text, excluir uuid default null)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text := privado.slugificar(texto);
  candidato text;
  sufijo int := 1;
  ocupado boolean;
begin
  -- Sin tipo, el case da null y el bucle nunca terminaría (validación A-M6).
  if tipo is null then
    raise exception using errcode = '22004', message = 'tipo_requerido';
  end if;
  if base = '' then
    base := 'sin-titulo';
  end if;

  candidato := base;
  loop
    ocupado := case tipo
      when 'articulo' then exists (
        select 1 from public.articulos where slug = candidato and id is distinct from excluir)
      when 'categoria' then exists (
        select 1 from public.categorias where slug = candidato and id is distinct from excluir)
      when 'etiqueta' then exists (
        select 1 from public.etiquetas where slug = candidato and id is distinct from excluir)
      when 'autor' then exists (
        select 1 from public.perfiles where slug = candidato and id is distinct from excluir)
    end;
    -- El slug anterior de otra entidad sigue reservado para su 301 (validación A3-M1).
    ocupado := ocupado or exists (
      select 1 from public.redirecciones r
      where r.tipo_entidad = tipo and r.slug_anterior = candidato and r.entidad_id is distinct from excluir
    );
    exit when not ocupado;
    sufijo := sufijo + 1;
    candidato := base || '-' || sufijo;
  end loop;
  return candidato;
end
$$;

create or replace function privado.asignar_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tipo public.tipo_entidad;
begin
  tipo := case tg_table_name
    when 'articulos' then 'articulo'
    when 'categorias' then 'categoria'
    when 'etiquetas' then 'etiqueta'
    when 'perfiles' then 'autor'
  end;
  if tipo is null then
    raise exception 'asignar_slug: tabla no soportada %', tg_table_name;
  end if;

  -- Solo se calcula al crear o cuando el slug cambia: si no, una edición
  -- cualquiera podría cambiar una URL publicada (validación A4-M1). Escribir ''
  -- sigue regenerándolo, porque es distinto del anterior.
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;

  new.slug := privado.slug_disponible(
    tipo,
    coalesce(nullif(btrim(new.slug), ''), to_jsonb(new) ->> tg_argv[0]),
    new.id
  );
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill fila por fila: dentro de una sola sentencia, slug_disponible no ve
-- los slugs que esa sentencia ya asignó y dos homónimos chocarían en el unique.
-- Sin a90_actualizado_en, para no pisar el lastmod del sitemap.
-- ---------------------------------------------------------------------------
alter table public.perfiles disable trigger a90_actualizado_en;
do $$
declare
  r record;
begin
  for r in select id, nombre from public.perfiles order by creado_en, id loop
    update public.perfiles
      set slug = privado.slug_disponible('autor', r.nombre, r.id)
      where id = r.id;
  end loop;
end
$$;
alter table public.perfiles enable trigger a90_actualizado_en;

-- ---------------------------------------------------------------------------
-- 4. Restricciones
-- ---------------------------------------------------------------------------
alter table public.perfiles
  alter column slug set default '',
  alter column slug set not null,
  add constraint perfiles_slug_key unique (slug),
  add constraint perfiles_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------

-- Solo en el alta: el slug del autor es inmutable (aclaración 2026-10-19, RF-011).
create trigger a10_asignar_slug
  before insert on public.perfiles
  for each row execute function privado.asignar_slug('nombre');

-- Trigger propio y no dentro de proteger_perfil: la H6 de la 001 reemplaza esa
-- función y borraría la regla (research D10). postgres y service_role sí pueden
-- corregir un slug (mantenimiento).
create function privado.impedir_cambio_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente() then
    raise exception using errcode = 'P0001', message = 'sin_permiso', detail = 'slug';
  end if;
  return new;
end
$$;

create trigger a15_slug_inmutable
  before update on public.perfiles
  for each row when (new.slug is distinct from old.slug)
  execute function privado.impedir_cambio_slug();

-- Aviso de cambios de autor (adelantado de la H6 de la 001, research D11): con tags
-- alcanza con el slug del autor; el sitio invalida autor:<id>.
create function privado.notificar_cambio_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.articulos
    where autor_id = new.id and privado.es_publico(estado, publicado_en)
  ) then
    perform privado.notificar_cambio_publico(jsonb_build_object(
      'tipo', 'autor',
      'id', new.id,
      'slugs', privado.slugs_afectados(new.slug, old.slug)
    ));
  end if;
  return null;
end
$$;

create trigger z90_notificar_cambio_autor
  after update on public.perfiles
  for each row
  when ((old.nombre, old.biografia, old.avatar, old.slug) is distinct from (new.nombre, new.biografia, new.avatar, new.slug))
  execute function privado.notificar_cambio_autor();

revoke execute on function privado.impedir_cambio_slug(), privado.notificar_cambio_autor()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Vista pública: slug y actualizado_en se agregan al final (create or replace
-- solo admite columnas nuevas al final). Hay que repetir las opciones: sin ellas
-- se resetean y se pierde security_barrier.
-- ---------------------------------------------------------------------------
create or replace view public.autores_publicos with (security_invoker = false, security_barrier = true) as
select p.id, p.nombre, p.biografia, p.avatar, p.slug, p.actualizado_en
from public.perfiles p
where exists (
  select 1 from public.articulos a
  -- Predicado inline: las funciones de una vista se verifican con el rol de quien
  -- consulta, y es_publico no es ejecutable por clientes.
  where a.autor_id = p.id and a.estado = 'publicado' and a.publicado_en <= now()
);

revoke all on public.autores_publicos from public, anon, authenticated;
grant select on public.autores_publicos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Sitemap con autores. La RPC es invoker y anon no lee perfiles: la rama de
-- autores pasa por la vista definer, nunca por la tabla.
-- ---------------------------------------------------------------------------
create or replace function public.entradas_sitemap()
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
    union all
    select 'autor', v.slug, greatest(v.actualizado_en, max(a.actualizado_en))
    from public.autores_publicos v
    join public.articulos a on a.autor_id = v.id and a.estado = 'publicado' and a.publicado_en <= now()
    group by v.id, v.slug, v.actualizado_en -- sobre una vista no hay dependencia funcional por PK
  ) as x
$$;

-- ---------------------------------------------------------------------------
-- 8. Índice para el listado por autor; reemplaza a articulos_autor_idx y sigue
-- cubriendo la FK (§V.8). Sin parcial: la política de authenticated tiene un
-- "or es_equipo()" y no lo aprovecharía.
-- ---------------------------------------------------------------------------
drop index public.articulos_autor_idx;
create index articulos_autor_publicado_idx on public.articulos (autor_id, publicado_en desc);
