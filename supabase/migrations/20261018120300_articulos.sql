-- Artículos: tabla, campos del sistema, bloqueo optimista y RLS.
-- Spec 001 H1 · research D6, D8, D10, D13 · data-model "articulos".
-- Estados y publicación: 20261018120400_estados_y_publicacion.sql (H2).
-- Búsqueda: 20261018120800_busqueda.sql (H5).

create table public.articulos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  slug text not null default '' unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), -- lo genera a10_asignar_slug
  extracto text check (char_length(extracto) <= 300),
  titulo_seo text check (char_length(titulo_seo) <= 60),
  descripcion_seo text check (char_length(descripcion_seo) <= 160),
  imagen_destacada jsonb check (imagen_destacada is null or privado.imagen_valida(imagen_destacada)),
  contenido jsonb not null default '[]' check (privado.contenido_valido(contenido)),
  estado public.estado_articulo not null default 'borrador',
  programado_para timestamptz,
  publicado_en timestamptz,
  autor_id uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  categoria_id uuid references public.categorias (id) on delete restrict,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index articulos_estado_publicado_idx on public.articulos (estado, publicado_en desc);
create index articulos_categoria_publicado_idx on public.articulos (categoria_id, publicado_en desc);
create index articulos_autor_idx on public.articulos (autor_id);

-- ---------------------------------------------------------------------------
-- Campos que gestiona el sistema (B5). Solo se aplica a peticiones de cliente:
-- el seed y el cron corren como postgres.
-- ---------------------------------------------------------------------------
create function privado.campos_sistema_articulo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not privado.es_cliente() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.version := 1;
    new.publicado_en := null;
    new.estado := 'borrador';
    new.creado_en := now();
  else
    new.autor_id := old.autor_id;
    new.creado_en := old.creado_en;
    new.publicado_en := old.publicado_en;
  end if;
  return new;
end
$$;

-- Bloqueo optimista (D13). Los recálculos derivados lanzados desde otro trigger
-- no cuentan como edición; el cron sí incrementa la versión.
create function privado.controlar_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    new.version := old.version;
    return new;
  end if;

  if new.version is distinct from old.version then
    raise exception using errcode = 'P0001', message = 'conflicto_version';
  end if;
  new.version := old.version + 1;
  return new;
end
$$;

-- Orden alfabético de los triggers (D21).
create trigger a10_asignar_slug
  before insert or update on public.articulos
  for each row execute function privado.asignar_slug('titulo');
create trigger a20_campos_sistema
  before insert or update on public.articulos
  for each row execute function privado.campos_sistema_articulo();
create trigger a30_controlar_version
  before update on public.articulos
  for each row execute function privado.controlar_version();
create trigger a90_actualizado_en
  before update on public.articulos
  for each row execute function privado.fijar_actualizado_en();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.articulos enable row level security;

create policy articulos_select_publico on public.articulos
  for select to anon
  using (estado = 'publicado' and publicado_en <= now());

create policy articulos_select_equipo on public.articulos
  for select to authenticated
  using ((estado = 'publicado' and publicado_en <= now()) or (select privado.es_equipo()));

create policy articulos_insert_equipo on public.articulos
  for insert to authenticated
  with check ((select privado.es_equipo()) and autor_id = (select auth.uid()));

create policy articulos_update_equipo on public.articulos
  for update to authenticated
  using ((select privado.es_equipo()))
  with check ((select privado.es_equipo()));

create policy articulos_delete_admin on public.articulos
  for delete to authenticated
  using ((select privado.es_admin()));

grant select on public.articulos to anon, authenticated;
grant insert, update, delete on public.articulos to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: previsualización del slug para el panel. Definer porque los clientes no
-- tienen execute sobre privado.slug_disponible (D20); misma fuente que el trigger.
-- ---------------------------------------------------------------------------
create function public.previsualizar_slug(texto text, tipo public.tipo_entidad)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_equipo() then
    raise exception using errcode = 'P0001', message = 'sin_permiso';
  end if;
  return privado.slug_disponible(tipo, texto);
end
$$;

revoke execute on function public.previsualizar_slug(text, public.tipo_entidad) from public, anon, authenticated;
grant execute on function public.previsualizar_slug(text, public.tipo_entidad) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones de privado
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function
  privado.es_cliente(),
  privado.tipos_bloque(),
  privado.contenido_valido(jsonb),
  privado.imagen_valida(jsonb),
  privado.es_equipo()
  to anon, authenticated;
grant execute on function privado.es_admin() to authenticated;
