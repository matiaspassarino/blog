-- Perfiles del equipo, roles y RLS base.
-- Spec 001 · research D2, D3, D4 · data-model "perfiles".
-- proteger_perfil ya impide que un cliente cambie rol o activo; H6
-- (20261019120900_equipo.sql) agrega perfiles_update_admin y garantizar_admin
-- y la amplía con create or replace para que el admin sí pueda.

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  biografia text check (char_length(biografia) <= 500),
  avatar jsonb check (avatar is null or privado.imagen_valida(avatar)),
  rol public.rol_miembro not null default 'editor',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger a90_actualizado_en
  before update on public.perfiles
  for each row execute function privado.fijar_actualizado_en();

-- ---------------------------------------------------------------------------
-- Auxiliares de autorización (D2). Las políticas las invocan como
-- (select privado.es_equipo()) para evaluarlas una vez por consulta.
-- ---------------------------------------------------------------------------
create function privado.es_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo
  )
$$;

create function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and activo and rol = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- Alta automática (D3). raw_app_meta_data solo lo escribe el servidor: una
-- cuenta sin rol asignado por el servidor nace inactiva.
-- ---------------------------------------------------------------------------
create function privado.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, rol, activo)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)), 80),
    coalesce((new.raw_app_meta_data ->> 'rol')::public.rol_miembro, 'editor'),
    -- {"rol": null} no cuenta como rol asignado por el servidor (validación A-M5).
    (new.raw_app_meta_data ->> 'rol') is not null
  );
  return new;
end
$$;

create trigger crear_perfil
  after insert on auth.users
  for each row execute function privado.crear_perfil();

-- ---------------------------------------------------------------------------
-- Protección de campos sensibles (D4). RLS controla filas, no columnas: sin
-- esto un editor podría hacerse admin editando su propia fila. Hasta H6 ningún
-- cliente cambia rol ni activo; H6 la reemplaza permitiéndolo al admin.
-- ---------------------------------------------------------------------------
create function privado.proteger_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not privado.es_cliente() then
    return new;
  end if;

  new.id := old.id;
  new.creado_en := old.creado_en;
  if (new.rol, new.activo) is distinct from (old.rol, old.activo) then
    raise exception using errcode = 'P0001', message = 'sin_permiso';
  end if;
  return new;
end
$$;

create trigger a20_proteger_perfil
  before update on public.perfiles
  for each row execute function privado.proteger_perfil();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.perfiles enable row level security;

create policy perfiles_select_equipo on public.perfiles
  for select to authenticated
  using ((select privado.es_equipo()));

create policy perfiles_update_propio on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) and (select privado.es_equipo()))
  with check (id = (select auth.uid()) and (select privado.es_equipo()));

grant select, update on public.perfiles to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones nuevas (las demás de privado quedan sin execute)
-- ---------------------------------------------------------------------------
grant execute on function privado.es_equipo() to anon, authenticated, service_role;
grant execute on function privado.es_admin() to authenticated, service_role;
