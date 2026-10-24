-- T008: privilegios explícitos (research D20, data-model "Privilegios (D20)")
-- y matriz de permisos de la spec (CE-001) para los objetos de la Fase 2:
-- perfiles, categorias, etiquetas, redirecciones y funciones de `privado`.
-- Cada historia posterior agrega aquí sus objetos y sus celdas de la matriz
-- (T033, T044, T052, T060).
begin;
\ir helpers/pruebas.psql
select plan(141);

-- ---------------------------------------------------------------------------
-- Esquema privado
-- ---------------------------------------------------------------------------
select schema_privs_are('privado', 'anon', array['USAGE'],
  'anon solo tiene usage sobre el esquema privado');
select schema_privs_are('privado', 'authenticated', array['USAGE'],
  'authenticated solo tiene usage sobre el esquema privado');
select is_empty($$
  select 1
  from pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
  where n.nspname = 'privado' and a.grantee = 0
$$, 'PUBLIC no tiene privilegios sobre el esquema privado');

-- ---------------------------------------------------------------------------
-- Tablas (fila por fila de la tabla D20)
-- ---------------------------------------------------------------------------
select table_privs_are('public', 'perfiles', 'anon', array[]::text[],
  'anon no tiene privilegios sobre perfiles');
select table_privs_are('public', 'perfiles', 'authenticated', array['SELECT', 'UPDATE'],
  'authenticated solo tiene select y update sobre perfiles');
select table_privs_are('public', 'categorias', 'anon', array['SELECT'],
  'anon solo tiene select sobre categorias');
select table_privs_are('public', 'categorias', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated tiene select, insert, update y delete sobre categorias');
select table_privs_are('public', 'etiquetas', 'anon', array['SELECT'],
  'anon solo tiene select sobre etiquetas');
select table_privs_are('public', 'etiquetas', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated tiene select, insert, update y delete sobre etiquetas');
select table_privs_are('public', 'redirecciones', 'anon', array['SELECT'],
  'anon solo tiene select sobre redirecciones');
select table_privs_are('public', 'redirecciones', 'authenticated', array['SELECT'],
  'authenticated solo tiene select sobre redirecciones');

-- ---------------------------------------------------------------------------
-- Funciones de privado
-- Permitidas para anon: es_cliente, es_equipo, tipos_elemento, contenido_valido,
-- documento_tiene_contenido, imagen_valida. authenticated además: es_admin. El resto: sin execute.
-- Spec 005 (T096, data-model y research D31 A1): tipos_elemento y documento_tiene_contenido las evalúan el
-- check y a40 con el rol de quien guarda; documento_a_texto solo la llama calcular_busqueda (definer).
-- (es_cliente figura en T012 paso 12; la tabla D20 del data-model no la lista,
-- pero la necesitan los triggers que corren como el rol del cliente.)
-- ---------------------------------------------------------------------------
select function_privs_are('privado', 'es_cliente', array[]::text[], 'anon', array['EXECUTE'],
  'anon puede ejecutar privado.es_cliente');
select function_privs_are('privado', 'es_cliente', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar privado.es_cliente');
select function_privs_are('privado', 'es_equipo', array[]::text[], 'anon', array['EXECUTE'],
  'anon puede ejecutar privado.es_equipo');
select function_privs_are('privado', 'es_equipo', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar privado.es_equipo');
select function_privs_are('privado', 'es_admin', array[]::text[], 'anon', array[]::text[],
  'anon no puede ejecutar privado.es_admin');
select function_privs_are('privado', 'es_admin', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar privado.es_admin');
select function_privs_are('privado', 'tipos_elemento', array[]::text[], 'anon', array['EXECUTE'],
  'spec 005: anon puede ejecutar privado.tipos_elemento');
select function_privs_are('privado', 'tipos_elemento', array[]::text[], 'authenticated', array['EXECUTE'],
  'spec 005: authenticated puede ejecutar privado.tipos_elemento');
select function_privs_are('privado', 'tipos_elemento', array[]::text[], 'service_role', array['EXECUTE'],
  'spec 005: service_role puede ejecutar privado.tipos_elemento');
select function_privs_are('privado', 'documento_tiene_contenido', array['jsonb'], 'anon', array['EXECUTE'],
  'spec 005: anon puede ejecutar privado.documento_tiene_contenido');
select function_privs_are('privado', 'documento_tiene_contenido', array['jsonb'], 'authenticated', array['EXECUTE'],
  'spec 005: authenticated puede ejecutar privado.documento_tiene_contenido');
select function_privs_are('privado', 'documento_tiene_contenido', array['jsonb'], 'service_role', array['EXECUTE'],
  'spec 005: service_role puede ejecutar privado.documento_tiene_contenido');
select function_privs_are('privado', 'documento_a_texto', array['jsonb'], 'anon', array[]::text[],
  'spec 005: anon no puede ejecutar privado.documento_a_texto');
select function_privs_are('privado', 'documento_a_texto', array['jsonb'], 'authenticated', array[]::text[],
  'spec 005: authenticated no puede ejecutar privado.documento_a_texto');
select ok(
  to_regprocedure('privado.documento_a_texto(jsonb)') is not null and not exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = to_regprocedure('privado.documento_a_texto(jsonb)') and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'spec 005: PUBLIC no puede ejecutar privado.documento_a_texto');
select hasnt_function('privado', 'tipos_bloque', array[]::text[],
  'spec 005: privado.tipos_bloque ya no existe (la reemplaza tipos_elemento)');
select hasnt_function('privado', 'bloques_a_texto', array['jsonb'],
  'spec 005: privado.bloques_a_texto ya no existe (la reemplaza documento_a_texto)');
select function_privs_are('privado', 'contenido_valido', array['jsonb'], 'anon', array['EXECUTE'],
  'anon puede ejecutar privado.contenido_valido');
select function_privs_are('privado', 'contenido_valido', array['jsonb'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar privado.contenido_valido');
select function_privs_are('privado', 'imagen_valida', array['jsonb'], 'anon', array['EXECUTE'],
  'anon puede ejecutar privado.imagen_valida');
select function_privs_are('privado', 'imagen_valida', array['jsonb'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar privado.imagen_valida');
select function_privs_are('privado', 'slugificar', array['text'], 'anon', array[]::text[],
  'anon no puede ejecutar privado.slugificar');
select function_privs_are('privado', 'slugificar', array['text'], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.slugificar');
select function_privs_are('privado', 'fijar_actualizado_en', array[]::text[], 'anon', array[]::text[],
  'anon no puede ejecutar privado.fijar_actualizado_en');
select function_privs_are('privado', 'fijar_actualizado_en', array[]::text[], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.fijar_actualizado_en');
select function_privs_are('privado', 'slug_disponible', array['tipo_entidad', 'text', 'uuid'], 'anon', array[]::text[],
  'anon no puede ejecutar privado.slug_disponible');
select function_privs_are('privado', 'slug_disponible', array['tipo_entidad', 'text', 'uuid'], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.slug_disponible');
select function_privs_are('privado', 'asignar_slug', array[]::text[], 'anon', array[]::text[],
  'anon no puede ejecutar privado.asignar_slug');
select function_privs_are('privado', 'asignar_slug', array[]::text[], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.asignar_slug');
select function_privs_are('privado', 'crear_perfil', array[]::text[], 'anon', array[]::text[],
  'anon no puede ejecutar privado.crear_perfil');
select function_privs_are('privado', 'crear_perfil', array[]::text[], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.crear_perfil');

-- Barrido general: cualquier función de privado fuera de la lista permitida
-- (incluidas las que se agreguen después) no es ejecutable por los clientes.
select is_empty($$
  select p.oid::regprocedure
  from pg_proc p
  where p.pronamespace = 'privado'::regnamespace
    and p.proname not in ('es_cliente', 'es_equipo', 'tipos_elemento', 'contenido_valido', 'documento_tiene_contenido',
                          'imagen_valida', 'sin_tildes')
    and has_function_privilege('anon', p.oid, 'EXECUTE')
$$, 'anon no ejecuta funciones de privado fuera de la lista permitida');
select is_empty($$
  select p.oid::regprocedure
  from pg_proc p
  where p.pronamespace = 'privado'::regnamespace
    and p.proname not in ('es_cliente', 'es_equipo', 'es_admin', 'tipos_elemento', 'contenido_valido',
                          'documento_tiene_contenido', 'imagen_valida', 'sin_tildes')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
$$, 'authenticated no ejecuta funciones de privado fuera de la lista permitida');
select is_empty($$
  select p.oid::regprocedure
  from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.pronamespace = 'privado'::regnamespace
    and p.proname not in ('es_cliente', 'es_equipo', 'es_admin', 'tipos_elemento', 'contenido_valido',
                          'documento_tiene_contenido', 'imagen_valida', 'sin_tildes')
    and a.grantee = 0
    and a.privilege_type = 'EXECUTE'
$$, 'PUBLIC no ejecuta funciones de privado fuera de la lista permitida');

-- ---------------------------------------------------------------------------
-- Ningún rol de cliente tiene TRUNCATE ni REFERENCES en public
-- ---------------------------------------------------------------------------
select is_empty($$
  select c.oid::regclass
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (has_table_privilege('anon', c.oid, 'TRUNCATE')
         or has_table_privilege('anon', c.oid, 'REFERENCES'))
$$, 'anon no tiene TRUNCATE ni REFERENCES sobre ninguna tabla de public');
select is_empty($$
  select c.oid::regclass
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
         or has_table_privilege('authenticated', c.oid, 'REFERENCES'))
$$, 'authenticated no tiene TRUNCATE ni REFERENCES sobre ninguna tabla de public');

-- ---------------------------------------------------------------------------
-- pg_net: mitigación (research D14). Los grants de net.* los otorga
-- supabase_admin y postgres no puede revocarlos; net no está en los esquemas
-- expuestos por la API, así que se verifica que ninguna función invocable por
-- clientes llame a net.*.
-- ---------------------------------------------------------------------------
select is_empty($$
  select p.oid::regprocedure from pg_proc p
  where p.pronamespace in ('public'::regnamespace, 'privado'::regnamespace)
    and p.prosrc ilike '%net.http_%'
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'))
$$, 'ninguna función ejecutable por clientes llama a net.http_*');
select is_empty($$
  select p.oid::regprocedure from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prosecdef
    and p.prosrc ilike '%execute %'
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'))
$$, 'ninguna función definer expuesta ejecuta SQL dinámico');

-- ===========================================================================
-- Matriz de permisos (CE-001)
-- Celdas de la tabla "Requisitos de permisos" de la spec cuyos objetos existen
-- en esta fase. Visitante = anon; Editor y Admin = miembros activos.
-- ===========================================================================
select pruebas.como_postgres();
select pruebas.crear_usuario('admin@prueba.local', '{"rol":"admin"}', '{"nombre":"Admin Prueba"}');
select pruebas.crear_usuario('editor@prueba.local', '{"rol":"editor"}', '{"nombre":"Editor Prueba"}');
select pruebas.crear_usuario('desactivado@prueba.local', '{}', '{"nombre":"Cuenta Externa"}');
insert into public.categorias (nombre, slug) values ('Matriz', 'matriz');
insert into public.etiquetas (nombre, slug) values ('Matriz', 'matriz');
insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id)
  select 'categoria', 'matriz-vieja', id from public.categorias where slug = 'matriz';
insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id)
  values ('articulo', 'articulo-oculto', gen_random_uuid());

-- Leer categorías y etiquetas: Visitante ✓ · Editor ✓ · Admin ✓
select pruebas.como_anon();
select isnt_empty($$select 1 from public.categorias where slug = 'matriz'$$,
  'matriz: el visitante lee categorías');
select isnt_empty($$select 1 from public.etiquetas where slug = 'matriz'$$,
  'matriz: el visitante lee etiquetas');
select pruebas.como('editor@prueba.local');
select isnt_empty($$select 1 from public.categorias where slug = 'matriz'$$,
  'matriz: el editor lee categorías');
select isnt_empty($$select 1 from public.etiquetas where slug = 'matriz'$$,
  'matriz: el editor lee etiquetas');
select pruebas.como('admin@prueba.local');
select isnt_empty($$select 1 from public.categorias where slug = 'matriz'$$,
  'matriz: el admin lee categorías');
select isnt_empty($$select 1 from public.etiquetas where slug = 'matriz'$$,
  'matriz: el admin lee etiquetas');

-- Crear, editar y eliminar categorías y etiquetas: Visitante ✗
select pruebas.como_anon();
select throws_ok($$insert into public.categorias (nombre) values ('Del visitante')$$,
  '42501', null, 'matriz: el visitante no crea categorías');
select throws_ok($$update public.categorias set descripcion = 'x' where slug = 'matriz'$$,
  '42501', null, 'matriz: el visitante no edita categorías');
select throws_ok($$delete from public.categorias where slug = 'matriz'$$,
  '42501', null, 'matriz: el visitante no borra categorías');
select throws_ok($$insert into public.etiquetas (nombre) values ('Del visitante')$$,
  '42501', null, 'matriz: el visitante no crea etiquetas');
select throws_ok($$update public.etiquetas set descripcion = 'x' where slug = 'matriz'$$,
  '42501', null, 'matriz: el visitante no edita etiquetas');
select throws_ok($$delete from public.etiquetas where slug = 'matriz'$$,
  '42501', null, 'matriz: el visitante no borra etiquetas');

-- Crear, editar y eliminar categorías y etiquetas: Editor ✓
select pruebas.como('editor@prueba.local');
select lives_ok($$insert into public.categorias (nombre) values ('Del editor')$$,
  'matriz: el editor crea categorías');
select lives_ok($$update public.categorias set descripcion = 'editada' where nombre = 'Del editor'$$,
  'matriz: el editor edita categorías (sin error)');
select isnt_empty($$select 1 from public.categorias where nombre = 'Del editor' and descripcion = 'editada'$$,
  'matriz: la edición del editor sobre categorías se aplicó');
select lives_ok($$delete from public.categorias where nombre = 'Del editor'$$,
  'matriz: el editor borra categorías (sin error)');
select is_empty($$select 1 from public.categorias where nombre = 'Del editor'$$,
  'matriz: el borrado del editor sobre categorías se aplicó');
select lives_ok($$insert into public.etiquetas (nombre) values ('Del editor')$$,
  'matriz: el editor crea etiquetas');
select lives_ok($$update public.etiquetas set descripcion = 'editada' where nombre = 'Del editor'$$,
  'matriz: el editor edita etiquetas (sin error)');
select isnt_empty($$select 1 from public.etiquetas where nombre = 'Del editor' and descripcion = 'editada'$$,
  'matriz: la edición del editor sobre etiquetas se aplicó');
select lives_ok($$delete from public.etiquetas where nombre = 'Del editor'$$,
  'matriz: el editor borra etiquetas (sin error)');
select is_empty($$select 1 from public.etiquetas where nombre = 'Del editor'$$,
  'matriz: el borrado del editor sobre etiquetas se aplicó');

-- Crear, editar y eliminar categorías y etiquetas: Admin ✓
select pruebas.como('admin@prueba.local');
select lives_ok($$insert into public.categorias (nombre) values ('Del admin')$$,
  'matriz: el admin crea categorías');
select lives_ok($$update public.categorias set descripcion = 'editada' where nombre = 'Del admin'$$,
  'matriz: el admin edita categorías (sin error)');
select isnt_empty($$select 1 from public.categorias where nombre = 'Del admin' and descripcion = 'editada'$$,
  'matriz: la edición del admin sobre categorías se aplicó');
select lives_ok($$delete from public.categorias where nombre = 'Del admin'$$,
  'matriz: el admin borra categorías (sin error)');
select is_empty($$select 1 from public.categorias where nombre = 'Del admin'$$,
  'matriz: el borrado del admin sobre categorías se aplicó');
select lives_ok($$insert into public.etiquetas (nombre) values ('Del admin')$$,
  'matriz: el admin crea etiquetas');
select lives_ok($$update public.etiquetas set descripcion = 'editada' where nombre = 'Del admin'$$,
  'matriz: el admin edita etiquetas (sin error)');
select isnt_empty($$select 1 from public.etiquetas where nombre = 'Del admin' and descripcion = 'editada'$$,
  'matriz: la edición del admin sobre etiquetas se aplicó');
select lives_ok($$delete from public.etiquetas where nombre = 'Del admin'$$,
  'matriz: el admin borra etiquetas (sin error)');
select is_empty($$select 1 from public.etiquetas where nombre = 'Del admin'$$,
  'matriz: el borrado del admin sobre etiquetas se aplicó');

-- Política *_escritura_equipo, caso negativo: una cuenta sin perfil activo
-- (autenticada, pero fuera del equipo) no escribe taxonomías.
select pruebas.como('desactivado@prueba.local');
select throws_ok($$insert into public.categorias (nombre) values ('Del desactivado')$$,
  '42501', null, 'matriz: un miembro desactivado no crea categorías');
select throws_ok($$insert into public.etiquetas (nombre) values ('Del desactivado')$$,
  '42501', null, 'matriz: un miembro desactivado no crea etiquetas');
select lives_ok($$update public.categorias set descripcion = 'hackeada' where slug = 'matriz'$$,
  'matriz: el update de un miembro desactivado no da error (RLS lo filtra)');
select lives_ok($$delete from public.categorias where slug = 'matriz'$$,
  'matriz: el delete de un miembro desactivado no da error (RLS lo filtra)');
select pruebas.como_postgres();
select isnt_empty($$select 1 from public.categorias where slug = 'matriz' and descripcion is null$$,
  'matriz: la categoría sigue intacta tras los intentos del miembro desactivado');

-- Leer datos públicos de autores: Editor ✓ · Admin ✓ (tabla perfiles).
-- El visitante ✓ (solo autores con publicados) se cubre con la vista
-- autores_publicos en H2 (T044); aquí se verifica que no lee la tabla directa.
select pruebas.como_anon();
select throws_ok($$select * from public.perfiles$$,
  '42501', null, 'matriz: el visitante no lee la tabla perfiles directamente');
select pruebas.como('editor@prueba.local');
select isnt_empty($$select nombre, biografia, avatar from public.perfiles$$,
  'matriz: el editor lee los datos de los autores');
select pruebas.como('admin@prueba.local');
select isnt_empty($$select nombre, biografia, avatar from public.perfiles$$,
  'matriz: el admin lee los datos de los autores');

-- Editar el perfil propio: Visitante ✗ · Editor ✓ · Admin ✓
select pruebas.como_anon();
select throws_ok($$update public.perfiles set nombre = 'Visitante'$$,
  '42501', null, 'matriz: el visitante no edita perfiles');
select pruebas.como('editor@prueba.local');
select lives_ok($$update public.perfiles set nombre = 'Editor Editado', biografia = 'Bio del editor' where id = auth.uid()$$,
  'matriz: el editor edita su perfil (sin error)');
select isnt_empty($$select 1 from public.perfiles where id = auth.uid() and nombre = 'Editor Editado' and biografia = 'Bio del editor'$$,
  'matriz: la edición del perfil propio del editor se aplicó');
select pruebas.como('admin@prueba.local');
select lives_ok($$update public.perfiles set nombre = 'Admin Editado', biografia = 'Bio del admin' where id = auth.uid()$$,
  'matriz: el admin edita su perfil (sin error)');
select isnt_empty($$select 1 from public.perfiles where id = auth.uid() and nombre = 'Admin Editado' and biografia = 'Bio del admin'$$,
  'matriz: la edición del perfil propio del admin se aplicó');

-- Redirecciones: se leen las de categorías y etiquetas, no las de artículos
-- no visibles, y ningún cliente las escribe (solo los triggers definer).
select pruebas.como_anon();
select isnt_empty($$select 1 from public.redirecciones where slug_anterior = 'matriz-vieja'$$,
  'matriz: el visitante lee redirecciones de categorías');
select is_empty($$select 1 from public.redirecciones where slug_anterior = 'articulo-oculto'$$,
  'matriz: el visitante no ve redirecciones de artículos no visibles');
select throws_ok($$insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id) values ('categoria', 'x', gen_random_uuid())$$,
  '42501', null, 'matriz: el visitante no escribe redirecciones');
select pruebas.como('editor@prueba.local');
select isnt_empty($$select 1 from public.redirecciones where slug_anterior = 'matriz-vieja'$$,
  'matriz: el editor lee redirecciones de categorías');
select is_empty($$select 1 from public.redirecciones where slug_anterior = 'articulo-oculto'$$,
  'matriz: el editor no ve redirecciones de artículos inexistentes');
select throws_ok($$insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id) values ('categoria', 'x', gen_random_uuid())$$,
  '42501', null, 'matriz: el editor no escribe redirecciones');
select pruebas.como('admin@prueba.local');
select isnt_empty($$select 1 from public.redirecciones where slug_anterior = 'matriz-vieja'$$,
  'matriz: el admin lee redirecciones de categorías');
select is_empty($$select 1 from public.redirecciones where slug_anterior = 'articulo-oculto'$$,
  'matriz: el admin no ve redirecciones de artículos inexistentes');
select throws_ok($$insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id) values ('categoria', 'x', gen_random_uuid())$$,
  '42501', null, 'matriz: el admin no escribe redirecciones');

-- ===========================================================================
-- H1 (T033): artículos, previsualizar_slug y storage `medios`
-- ===========================================================================
select pruebas.como_postgres();
select table_privs_are('public', 'articulos', 'anon', array['SELECT'],
  'anon solo tiene select sobre articulos');
select table_privs_are('public', 'articulos', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated tiene select, insert, update y delete sobre articulos');
select function_privs_are('public', 'previsualizar_slug', array['text', 'tipo_entidad'], 'anon', array[]::text[],
  'anon no puede ejecutar previsualizar_slug');
select function_privs_are('public', 'previsualizar_slug', array['text', 'tipo_entidad'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar previsualizar_slug');
select is(
  (select array_agg(policyname::text order by policyname) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'medios%'),
  array['medios_delete_equipo', 'medios_insert_equipo', 'medios_select', 'medios_update_equipo'],
  'storage.objects tiene exactamente las políticas de medios'
);

-- Matriz: crear artículos (como autor)
select pruebas.como_anon();
select throws_ok($$insert into public.articulos (titulo) values ('Matriz anon')$$,
  '42501', null, 'matriz: el visitante no crea artículos');
select pruebas.como('editor@prueba.local');
select lives_ok($$insert into public.articulos (titulo, slug) values ('Matriz editor', 'matriz-editor')$$,
  'matriz: el editor crea artículos');
select pruebas.como('admin@prueba.local');
select lives_ok($$insert into public.articulos (titulo, slug) values ('Matriz admin', 'matriz-admin')$$,
  'matriz: el admin crea artículos');
select pruebas.como('desactivado@prueba.local');
select throws_ok($$insert into public.articulos (titulo) values ('Matriz desactivado')$$,
  '42501', null, 'matriz: un miembro inactivo no crea artículos');

-- Matriz: eliminar definitivamente (solo admin; el editor solo archiva)
select pruebas.como('editor@prueba.local');
delete from public.articulos where slug = 'matriz-editor';
select pruebas.como_postgres();
select isnt_empty($$select 1 from public.articulos where slug = 'matriz-editor'$$,
  'matriz: el editor no elimina artículos');
select pruebas.como('admin@prueba.local');
delete from public.articulos where slug = 'matriz-editor';
select pruebas.como_postgres();
select is_empty($$select 1 from public.articulos where slug = 'matriz-editor'$$,
  'matriz: el admin elimina artículos');

-- ===========================================================================
-- H2 (T044): autores_publicos, resolver_redireccion y funciones de notificación
-- ===========================================================================
select pruebas.como_postgres();
select table_privs_are('public', 'autores_publicos', 'anon', array['SELECT'],
  'anon solo tiene select sobre autores_publicos');
select table_privs_are('public', 'autores_publicos', 'authenticated', array['SELECT'],
  'authenticated solo tiene select sobre autores_publicos');
select function_privs_are('public', 'resolver_redireccion', array['tipo_entidad', 'text'], 'anon', array['EXECUTE'],
  'anon puede ejecutar resolver_redireccion');
select function_privs_are('public', 'resolver_redireccion', array['tipo_entidad', 'text'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar resolver_redireccion');
select function_privs_are('privado', 'notificar_cambio_publico', array['jsonb'], 'anon', array[]::text[],
  'anon no puede ejecutar privado.notificar_cambio_publico');
select function_privs_are('privado', 'notificar_cambio_publico', array['jsonb'], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.notificar_cambio_publico');
select function_privs_are('privado', 'es_publico', array['estado_articulo', 'timestamptz'], 'anon', array[]::text[],
  'anon no puede ejecutar privado.es_publico');

-- ===========================================================================
-- H3 (T052): articulos_etiquetas (solo lectura) y asignar_etiquetas
-- ===========================================================================
select pruebas.como_postgres();
select table_privs_are('public', 'articulos_etiquetas', 'anon', array['SELECT'],
  'anon solo tiene select sobre articulos_etiquetas');
select table_privs_are('public', 'articulos_etiquetas', 'authenticated', array['SELECT'],
  'authenticated solo tiene select sobre articulos_etiquetas (escribe solo vía asignar_etiquetas)');
select function_privs_are('public', 'asignar_etiquetas', array['uuid', 'uuid[]', 'integer'], 'anon', array[]::text[],
  'anon no puede ejecutar asignar_etiquetas');
select function_privs_are('public', 'asignar_etiquetas', array['uuid', 'uuid[]', 'integer'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar asignar_etiquetas');
select is(
  (select prosecdef from pg_proc where oid = 'public.asignar_etiquetas(uuid, uuid[], integer)'::regprocedure),
  true, 'asignar_etiquetas es security definer (con chequeo es_equipo)');
select function_privs_are('privado', 'mensaje_articulo', array['uuid', 'jsonb', 'uuid[]', 'uuid[]'], 'authenticated', array[]::text[],
  'authenticated no puede ejecutar privado.mensaje_articulo');

select function_privs_are('public', 'entradas_sitemap', array[]::text[], 'anon', array['EXECUTE'],
  'anon puede ejecutar entradas_sitemap');
select is(
  (select prosecdef from pg_proc where oid = 'public.entradas_sitemap()'::regprocedure),
  false, 'entradas_sitemap es invoker (la RLS decide qué es visible)');

-- ===========================================================================
-- Spec 002 (T016): slug de autores y notificación de cambios de autor
-- ===========================================================================
select function_privs_are('public', 'entradas_sitemap', array[]::text[], 'authenticated', array['EXECUTE'],
  'spec 002: authenticated sigue pudiendo ejecutar entradas_sitemap');
select function_privs_are('privado', 'impedir_cambio_slug', array[]::text[], 'anon', array[]::text[],
  'spec 002: anon no puede ejecutar privado.impedir_cambio_slug');
select function_privs_are('privado', 'impedir_cambio_slug', array[]::text[], 'authenticated', array[]::text[],
  'spec 002: authenticated no puede ejecutar privado.impedir_cambio_slug');
select function_privs_are('privado', 'notificar_cambio_autor', array[]::text[], 'anon', array[]::text[],
  'spec 002: anon no puede ejecutar privado.notificar_cambio_autor');
select function_privs_are('privado', 'notificar_cambio_autor', array[]::text[], 'authenticated', array[]::text[],
  'spec 002: authenticated no puede ejecutar privado.notificar_cambio_autor');
select ok(
  to_regprocedure('privado.impedir_cambio_slug()') is not null and not exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = to_regprocedure('privado.impedir_cambio_slug()') and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'spec 002: PUBLIC no puede ejecutar privado.impedir_cambio_slug');
select ok(
  to_regprocedure('privado.notificar_cambio_autor()') is not null and not exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = to_regprocedure('privado.notificar_cambio_autor()') and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'spec 002: PUBLIC no puede ejecutar privado.notificar_cambio_autor');

-- ===========================================================================
-- H5 (T060): buscar_articulos (anon y authenticated) y recalcular_busqueda (solo el sistema)
-- ===========================================================================
select function_privs_are('public', 'buscar_articulos', array['text', 'integer', 'integer'], 'anon', array['EXECUTE'],
  'H5: anon puede ejecutar buscar_articulos');
select function_privs_are('public', 'buscar_articulos', array['text', 'integer', 'integer'], 'authenticated', array['EXECUTE'],
  'H5: authenticated puede ejecutar buscar_articulos');
select function_privs_are('privado', 'recalcular_busqueda', array['uuid[]'], 'anon', array[]::text[],
  'H5: anon no puede ejecutar privado.recalcular_busqueda');
select function_privs_are('privado', 'recalcular_busqueda', array['uuid[]'], 'authenticated', array[]::text[],
  'H5: authenticated no puede ejecutar privado.recalcular_busqueda');
select ok(
  to_regprocedure('privado.recalcular_busqueda(uuid[])') is not null and not exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = to_regprocedure('privado.recalcular_busqueda(uuid[])') and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'H5: PUBLIC no puede ejecutar privado.recalcular_busqueda');

select pruebas.como_postgres();
select * from finish();
rollback;
