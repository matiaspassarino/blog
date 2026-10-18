-- Datos de demo navegables (constitucion.md §V.9, spec 001 RF-028).
-- Solo para entornos locales y de demo: las contraseñas son públicas.

-- ---------------------------------------------------------------------------
-- Usuarios (el trigger privado.crear_perfil crea los perfiles)
-- ---------------------------------------------------------------------------
with usuarios (id, email, contrasenia, rol, nombre) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@demo.local', 'demo-admin-2026', 'admin', 'Ana Admin'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'editora@demo.local', 'demo-editora-2026', 'editor', 'Eva Editora'),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'editor@demo.local', 'demo-editor-2026', 'editor', 'Edu Editor')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt(u.contrasenia, extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'rol', u.rol),
  jsonb_build_object('nombre', u.nombre), now(), now(),
  '', '', '', ''
from usuarios u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@demo.local';
