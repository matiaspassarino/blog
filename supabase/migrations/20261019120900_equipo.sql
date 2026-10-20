-- Gestión del equipo: el admin cambia rol y estado, siempre queda un admin activo,
-- y las cuentas creadas por la Admin API se activan al recibir su rol.
-- Spec 001 · H6 · RF-021 a RF-026 · research D2, D3, D4 · data-model "perfiles".
-- El aviso de cambios de autor ya existe desde la spec 002 (z90_notificar_cambio_autor).

-- ---------------------------------------------------------------------------
-- 1. El admin edita cualquier perfil (rol y activo incluidos, ver a20).
-- ---------------------------------------------------------------------------
create policy perfiles_update_admin on public.perfiles
  for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- 2. a20 amplía la protección del MVP: un cliente sigue sin poder tocar id ni
--    creado_en, y solo el admin activo cambia rol o activo. No es otro trigger.
-- ---------------------------------------------------------------------------
create or replace function privado.proteger_perfil()
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
  if (new.rol, new.activo) is distinct from (old.rol, old.activo) and not privado.es_admin() then
    raise exception using errcode = 'P0001', message = 'sin_permiso';
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Siempre queda al menos un admin activo (RF-023), también para postgres.
--    After row: con una sentencia que toca varios admins, el chequeo ve el estado
--    final. El lock serializa dos degradaciones simultáneas de admins distintos.
-- ---------------------------------------------------------------------------
create function privado.garantizar_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('perfiles.ultimo_admin'));
  if not exists (select 1 from public.perfiles where rol = 'admin' and activo) then
    raise exception using errcode = 'P0001', message = 'ultimo_admin';
  end if;
  return null;
end
$$;

create trigger z10_garantizar_admin
  after update on public.perfiles
  for each row execute function privado.garantizar_admin();

-- ---------------------------------------------------------------------------
-- 4. Activación por la Admin API (nota de T063): auth.admin.createUser guarda
--    app_metadata después del insert, así que crear_perfil no ve el rol y el
--    perfil nace inactivo. Cuando el rol pasa de nulo a un valor, el perfil lo
--    toma y se activa. raw_app_meta_data solo lo escribe el servidor (D3), y un
--    cambio posterior de un rol ya asignado no reactiva a un desactivado.
-- ---------------------------------------------------------------------------
create function privado.activar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfiles
  set rol = (new.raw_app_meta_data ->> 'rol')::public.rol_miembro, activo = true
  where id = new.id;
  return null;
end
$$;

create trigger activar_perfil
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data ->> 'rol' is null and new.raw_app_meta_data ->> 'rol' is not null)
  execute function privado.activar_perfil();

revoke execute on function privado.garantizar_admin() from public, anon, authenticated;
revoke execute on function privado.activar_perfil() from public, anon, authenticated;
