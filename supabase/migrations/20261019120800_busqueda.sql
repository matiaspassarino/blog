-- Búsqueda full-text en español: documento por artículo, recálculos y RPC.
-- Spec 001 · H5 · RF-018 a RF-020, CE-004, CE-005 · research D12, D22.

-- ---------------------------------------------------------------------------
-- 1. Configuración: spanish con unaccent antes del stemmer (D12). El documento y
--    la consulta combinan las dos configuraciones, porque Snowball depende de las tildes.
-- ---------------------------------------------------------------------------
create text search configuration public.es_sin_tildes (copy = pg_catalog.spanish);
alter text search configuration public.es_sin_tildes
  alter mapping for hword, hword_part, word with extensions.unaccent, pg_catalog.spanish_stem;

-- ---------------------------------------------------------------------------
-- 2. Texto indexable de los bloques: sin `codigo` y sin las URL de los enlaces
--    Markdown; truncado para no superar el límite de 1 MB del tsvector.
--    Un contenido que no es arreglo da texto vacío: lo rechaza el check de la tabla.
-- ---------------------------------------------------------------------------
create function privado.bloques_a_texto(contenido jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(coalesce(string_agg(s.texto, ' '), ''), '\[([^\]]*)\]\([^)]*\)', '\1', 'g'), 200000)
  from jsonb_array_elements(case when jsonb_typeof(contenido) = 'array' then contenido else '[]' end) as b(bloque),
    lateral (
      select case bloque ->> 'tipo'
        when 'parrafo' then bloque ->> 'texto'
        when 'titulo' then bloque ->> 'texto'
        when 'cita' then concat_ws(' ', bloque ->> 'texto', bloque ->> 'autor')
        when 'lista' then (select string_agg(item, ' ') from jsonb_array_elements_text(bloque -> 'items') as item)
        when 'imagen' then concat_ws(' ', bloque -> 'imagen' ->> 'alt', bloque ->> 'leyenda')
        when 'galeria' then (select string_agg(imagen ->> 'alt', ' ') from jsonb_array_elements(bloque -> 'imagenes') as imagen)
        when 'cta' then concat_ws(' ', bloque ->> 'titulo', bloque ->> 'texto')
        when 'video' then bloque ->> 'titulo'
      end as texto
    ) as s
$$;

create function privado.documento_busqueda(texto text, peso "char")
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select setweight(
    to_tsvector('public.es_sin_tildes', coalesce(texto, '')) || to_tsvector('pg_catalog.spanish', coalesce(texto, '')),
    peso
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Columna, índice y trigger. Pesos: A título; B extracto, categoría y
--    etiquetas; C bloques. Las taxonomías se consultan, por eso es un trigger.
-- ---------------------------------------------------------------------------
alter table public.articulos add column busqueda tsvector;
create index articulos_busqueda_idx on public.articulos using gin (busqueda);

-- Definer: lee categorías y etiquetas aunque el editor que guarda no las vea todas.
create function privado.calcular_busqueda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.busqueda :=
    privado.documento_busqueda(new.titulo, 'A')
    || privado.documento_busqueda(
      concat_ws(' ',
        new.extracto,
        (select c.nombre from public.categorias c where c.id = new.categoria_id),
        (select string_agg(e.nombre, ' ')
           from public.articulos_etiquetas ae
           join public.etiquetas e on e.id = ae.etiqueta_id
          where ae.articulo_id = new.id)),
      'B')
    || privado.documento_busqueda(privado.bloques_a_texto(new.contenido), 'C');
  return new;
end
$$;

create trigger a50_calcular_busqueda
  before insert or update on public.articulos
  for each row execute function privado.calcular_busqueda();

-- ---------------------------------------------------------------------------
-- 4. Los recálculos lanzados desde otro trigger no son ediciones: conservan
--    actualizado_en (y a30, la versión), para no mover el lastmod del sitemap
--    ni el dateModified (validación ronda 5).
-- ---------------------------------------------------------------------------
create or replace function privado.fijar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    new.actualizado_en := old.actualizado_en;
  else
    new.actualizado_en := now();
  end if;
  return new;
end
$$;

-- Un update sin cambios que dispara a50. Lo usan los triggers de taxonomías y el seed.
-- Llamada directa (no desde un trigger) cuenta como edición: sube la versión y mueve
-- actualizado_en. Para un recálculo masivo, usar el patrón de la carga inicial (sección 6).
create function privado.recalcular_busqueda(articulo_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.articulos set titulo = titulo where id = any (articulo_ids)
$$;

create function privado.recalcular_por_taxonomia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'categorias' then
    perform privado.recalcular_busqueda(array(select a.id from public.articulos a where a.categoria_id = new.id));
  else
    perform privado.recalcular_busqueda(
      array(select ae.articulo_id from public.articulos_etiquetas ae where ae.etiqueta_id = new.id));
  end if;
  return null;
end
$$;

create trigger z20_recalcular_articulos
  after update on public.categorias
  for each row when (old.nombre is distinct from new.nombre)
  execute function privado.recalcular_por_taxonomia();
create trigger z20_recalcular_articulos
  after update on public.etiquetas
  for each row when (old.nombre is distinct from new.nombre)
  execute function privado.recalcular_por_taxonomia();

-- Borrar una etiqueta: se quitan antes sus filas puente (el cascade ya no encuentra
-- nada) y se recalculan sus artículos a profundidad 2, sin subir la versión.
create function privado.recalcular_al_borrar_etiqueta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  with quitadas as (
    delete from public.articulos_etiquetas where etiqueta_id = old.id returning articulo_id
  )
  select array_agg(articulo_id) into ids from quitadas;
  perform privado.recalcular_busqueda(ids);
  return old;
end
$$;

create trigger a20_recalcular_al_borrar
  before delete on public.etiquetas
  for each row execute function privado.recalcular_al_borrar_etiqueta();

revoke execute on function privado.bloques_a_texto(jsonb) from public, anon, authenticated;
revoke execute on function privado.documento_busqueda(text, "char") from public, anon, authenticated;
revoke execute on function privado.recalcular_busqueda(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC público (invoker: RLS aplica igual, y el filtro de publicados es explícito).
--    Devuelve la categoría completa para mapear a ResumenArticulo como los listados.
-- ---------------------------------------------------------------------------
create function public.buscar_articulos(consulta text, limite int default 12, desplazamiento int default 0)
returns table (
  id uuid,
  titulo text,
  slug text,
  extracto text,
  imagen_destacada jsonb,
  publicado_en timestamptz,
  categoria_id uuid,
  categoria_nombre text,
  categoria_slug text,
  rango real,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('public.es_sin_tildes', consulta)
      || websearch_to_tsquery('pg_catalog.spanish', consulta) as q
  )
  select a.id, a.titulo, a.slug, a.extracto, a.imagen_destacada, a.publicado_en,
    c.id, c.nombre, c.slug, ts_rank_cd(a.busqueda, q.q), count(*) over ()
  from public.articulos a
  cross join q
  left join public.categorias c on c.id = a.categoria_id
  where a.estado = 'publicado' and a.publicado_en <= now() and a.busqueda @@ q.q
  order by ts_rank_cd(a.busqueda, q.q) desc, a.publicado_en desc
  limit least(greatest(coalesce(limite, 12), 0), 50) offset greatest(coalesce(desplazamiento, 0), 0)
$$;

revoke execute on function public.buscar_articulos(text, int, int) from public, anon, authenticated;
grant execute on function public.buscar_articulos(text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Carga inicial sin subir la versión ni mover actualizado_en (validación A6-M2),
--    para no darle conflicto_version a un editor con un artículo abierto.
--    z90_notificar_cambio ignora los cambios que solo tocan busqueda.
-- ---------------------------------------------------------------------------
alter table public.articulos disable trigger a30_controlar_version;
alter table public.articulos disable trigger a90_actualizado_en;
update public.articulos set titulo = titulo;
alter table public.articulos enable trigger a30_controlar_version;
alter table public.articulos enable trigger a90_actualizado_en;
