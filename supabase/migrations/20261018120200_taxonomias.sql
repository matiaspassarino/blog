-- Categorías, etiquetas y redirecciones (estructura base).
-- Spec 001 · research D10, D11, D23 · data-model "categorias y etiquetas", "redirecciones".
-- Redirecciones por cambio de slug y protección de categorías en uso: H3
-- (20261018120600_etiquetado.sql).

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  slug text not null default '' unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), -- lo genera a10_asignar_slug
  descripcion text check (char_length(descripcion) <= 300),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  slug text not null default '' unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), -- lo genera a10_asignar_slug
  descripcion text check (char_length(descripcion) <= 300),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index categorias_nombre_unico on public.categorias (lower(nombre));
create unique index etiquetas_nombre_unico on public.etiquetas (lower(nombre));

create trigger a05_id_inmutable
  before update on public.categorias
  for each row execute function privado.impedir_cambio_id();
create trigger a10_asignar_slug
  before insert or update on public.categorias
  for each row execute function privado.asignar_slug('nombre');
create trigger a90_actualizado_en
  before update on public.categorias
  for each row execute function privado.fijar_actualizado_en();

create trigger a05_id_inmutable
  before update on public.etiquetas
  for each row execute function privado.impedir_cambio_id();
create trigger a10_asignar_slug
  before insert or update on public.etiquetas
  for each row execute function privado.asignar_slug('nombre');
create trigger a90_actualizado_en
  before update on public.etiquetas
  for each row execute function privado.fijar_actualizado_en();

-- Polimórfica: la integridad con la entidad la mantienen los triggers (H2, H3).
create table public.redirecciones (
  id uuid primary key default gen_random_uuid(),
  tipo_entidad public.tipo_entidad not null,
  slug_anterior text not null,
  entidad_id uuid not null,
  creado_en timestamptz not null default now(),
  unique (tipo_entidad, slug_anterior)
);

create index redirecciones_entidad_idx on public.redirecciones (entidad_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.categorias enable row level security;
alter table public.etiquetas enable row level security;
alter table public.redirecciones enable row level security;

create policy categorias_select on public.categorias
  for select to anon, authenticated using (true);
create policy categorias_insert_equipo on public.categorias
  for insert to authenticated with check ((select privado.es_equipo()));
create policy categorias_update_equipo on public.categorias
  for update to authenticated
  using ((select privado.es_equipo()))
  with check ((select privado.es_equipo()));
create policy categorias_delete_equipo on public.categorias
  for delete to authenticated using ((select privado.es_equipo()));

create policy etiquetas_select on public.etiquetas
  for select to anon, authenticated using (true);
create policy etiquetas_insert_equipo on public.etiquetas
  for insert to authenticated with check ((select privado.es_equipo()));
create policy etiquetas_update_equipo on public.etiquetas
  for update to authenticated
  using ((select privado.es_equipo()))
  with check ((select privado.es_equipo()));
create policy etiquetas_delete_equipo on public.etiquetas
  for delete to authenticated using ((select privado.es_equipo()));

-- Provisional: se reemplaza en H2 para ocultar redirecciones de artículos no visibles (D24).
create policy redirecciones_select on public.redirecciones
  for select to anon, authenticated using (tipo_entidad <> 'articulo');

grant select on public.categorias, public.etiquetas, public.redirecciones to anon, authenticated;
grant insert, update, delete on public.categorias, public.etiquetas to authenticated;
