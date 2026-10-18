---

description: "Lista de tareas: modelo de contenido del blog"
---

# Tareas: Modelo de contenido del blog

**Entrada**: Documentos de diseño en `/specs/001-modelo-de-contenido/`: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/) y [quickstart.md](quickstart.md).

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: OBLIGATORIOS (constitucion.md §IX). En cada historia, las tareas de test van primero, las escribe el agente `escritor-tests` y **deben fallar** antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario. Cada historia agrega su propia migración, sus tests y sus módulos en `packages/*`.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo: toca archivos distintos y no depende de tareas incompletas.
- **[Historia]**: H1 a H6, según spec.md.

## Convenciones de rutas

- Migraciones: `supabase/migrations/2026101812NNNN_<nombre>.sql`, con timestamps crecientes en el orden de esta lista.
- pgTAP: `supabase/tests/<nombre>.test.sql`. Cada archivo arranca con `begin; select plan(N);` y cierra con `select * from finish(); rollback;`.
- Helpers pgTAP: `supabase/tests/00_helpers.test.sql`, que se carga primero por orden alfabético.
- Vitest: `packages/<pkg>/src/**/*.test.ts`.
- Reglas transversales en **todas** las funciones SQL: `set search_path = ''`, nombres calificados (`public.`, `privado.`, `extensions.unaccent`), triggers con prefijo de orden (`a10_` … `z90_`, research D21) y sin `update of`.
- Errores de dominio: `raise exception using errcode = 'P0001', message = '<codigo>', detail = '<detalle>'`, con los códigos de [contracts/db.md](contracts/db.md).

---

## Fase 1: Preparación

**Propósito**: Dependencias, configuración y entorno de tests.

- [X] T001 Agregar `zod@4.6.7` como dependencia de `packages/bloques/package.json` (`pnpm --filter @blog/bloques add zod@4.6.7`). Si `minimumReleaseAge` lo bloquea, elegir la versión 4.6.x anterior y **no** agregar exclusiones.
- [X] T002 Agregar `@supabase/supabase-js@2.118.0` y `@blog/bloques: workspace:*` a `packages/db/package.json`.
- [X] T003 [P] En `supabase/config.toml`, poner `enable_signup = false` en `[auth]` (línea ~177) **y** en `[auth.email]` (línea ~222) (research D3, B3).
- [X] T004 [P] Crear `packages/db/vitest.config.ts` con `globalSetup` en `packages/db/src/pruebas/entorno.ts`. Ese setup lee la URL y las claves de `supabase status -o env` (o de las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`). Si no están disponibles, marca la suite de integración como saltada con un aviso (si `CI=true`, en cambio, falla).
- [X] T005 [P] Crear `packages/db/src/pruebas/clientes.ts` con `clienteAnon()` y `clienteComo(email, contrasenia)`, que inician sesión con los usuarios demo de [quickstart.md](quickstart.md#usuarios-de-demo). Solo se usa en tests; agregar `src/pruebas/**` a `ignore` de producción en `knip.json`.
- [X] T006 [P] En `.github/workflows/ci.yml`, job `base-de-datos`: después de `supabase test db`, agregar los pasos `pnpm install --frozen-lockfile` y `pnpm --filter @blog/db test` con Supabase levantado, para que corran los tests de integración.

---

## Fase 2: Fundacional (bloqueante)

**Propósito**: Privilegios, utilidades, perfiles mínimos y taxonomías base. Todas las historias dependen de esto.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase.

### Tests (escribir primero, deben fallar)

- [X] T007 [P] Crear `supabase/tests/00_helpers.test.sql` con las funciones de test en el esquema `pruebas`: `pruebas.como_anon()`, `pruebas.como(email text)` (que hace `set local role authenticated` y `set local request.jwt.claims` con el `sub` del usuario) y `pruebas.como_postgres()`. El archivo incluye `select plan(1); select pass('helpers cargados');`.
- [X] T008 [P] Crear `supabase/tests/privilegios.test.sql` con `table_privs_are` y `function_privs_are` para **cada** fila de la tabla "Privilegios (D20)" de [data-model.md](data-model.md#privilegios-d20) que exista en esta fase (`perfiles`, `categorias`, `etiquetas`, `redirecciones`, funciones de `privado`). Verificar también:
  - que `anon` y `authenticated` **no** tienen TRUNCATE ni REFERENCES sobre ninguna tabla de `public`;
  - como mitigación de `pg_net` (research D14): que ninguna función ejecutable por clientes llame a `net.http_*` y que ninguna función definer expuesta en `public` ejecute SQL dinámico;
  - que `PUBLIC` no tiene `execute` sobre funciones de `privado` fuera de la lista permitida.
  Incluir además una sección **"Matriz de permisos" (CE-001)**, con un `lives_ok` o `throws_ok` por cada celda de la tabla "Requisitos de permisos" de [spec.md](spec.md) cuyo objeto exista en la fase; por ejemplo, que anon no pueda crear, editar ni borrar categorías y etiquetas, y que anon no pueda editar perfiles.
  Cada historia posterior agrega aquí sus objetos y sus celdas de la matriz.
- [X] T009 [P] Crear `supabase/tests/perfiles_base.test.sql`. Debe verificar:
  - el insert en `auth.users` con `raw_app_meta_data = '{"rol":"admin"}'` crea un perfil `rol = admin, activo = true`;
  - sin `rol` en `raw_app_meta_data`, se crea con `rol = editor, activo = false`;
  - `nombre` se toma de `raw_user_meta_data->>'nombre'`, o de la parte local del email si falta;
  - `es_equipo()` es true solo para miembros activos, `es_admin()` solo para admins activos, y ambas son false para anon;
  - `anon` no puede hacer `select` sobre `perfiles`;
  - un miembro activo edita su `nombre` y `biografia`, pero uno desactivado no puede (B4).
- [X] T010 [P] Crear `supabase/tests/slugs.test.sql`. Debe verificar:
  - `privado.slugificar('Año de Diseño!') = 'ano-de-diseno'`;
  - el colapso de guiones y el recorte de bordes;
  - la creación de una categoría sin slug lo genera a partir del nombre;
  - un nombre repetido con otra capitalización (`SEO` frente a `seo`) es rechazado por `unique (lower(nombre))`;
  - un slug informado se normaliza;
  - un slug duplicado recibe el sufijo `-2`, después `-3`;
  - el check `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` rechaza valores inválidos insertados por `postgres` con el trigger deshabilitado.
- [X] T011 [P] Crear `packages/db/src/errores.test.ts`. Debe verificar que `traducirError` mapea:
  - el `P0001` con mensaje `conflicto_version`, `estado_invalido`, `requisitos_publicacion` (y su `detail`), `fecha_no_futura`, `categoria_en_uso` (con el conteo), `ultimo_admin` y `contenido_invalido`;
  - el `42501` y el error de RLS a `sin_permiso`;
  - el `23505` sobre `slug` a `slug_duplicado`;
  - el `PGRST116` a `no_encontrado`;
  - cualquier otro error a un `ErrorDominio` genérico que conserva la causa.

### Implementación

- [X] T012 Crear `supabase/migrations/20261018120000_fundacion.sql` (research D20, D10, D8 y [data-model.md](data-model.md#privilegios-d20)), en este orden:
  1. `alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;` y `... revoke execute on functions from public, anon, authenticated;`
  2. `create extension if not exists unaccent with schema extensions;`, lo mismo para `pg_net`, y `create extension if not exists pg_cron;`. **No** revocar `net.*`: los grants los otorga `supabase_admin` y `postgres` no puede revocarlos (verificado; el revoke solo emite un WARNING). La mitigación es que ninguna función invocable por clientes llame a `net.http_*` ni ejecute SQL dinámico siendo definer, y que `net` no esté en los esquemas expuestos por la API (research D14). Lo verifica T008.
  3. `create schema privado; revoke all on schema privado from public; grant usage on schema privado to anon, authenticated;` Los default privileges por esquema **no pueden** quitar el `EXECUTE` que `PUBLIC` recibe por defecto (verificado por escritor-tests), así que: `alter default privileges for role postgres revoke execute on functions from public;` (global) y, **al final de cada migración** que cree funciones en `privado`, `revoke execute on all functions in schema privado from public, anon, authenticated;` seguido de los `grant` explícitos.
  4. Los enums `public.rol_miembro ('admin','editor')`, `public.estado_articulo ('borrador','programado','publicado','archivado')` y `public.tipo_entidad ('articulo','categoria','etiqueta')`.
  5. `privado.es_cliente()`, `stable`: `select current_setting('role', true) in ('anon','authenticated')`.
  6. `privado.slugificar(text)`, `immutable`: aplica `extensions.unaccent`, `lower`, reemplaza `[^a-z0-9]+` por `-` y recorta los `-` de los bordes. Para que sea `immutable`, usar `extensions.unaccent('extensions.unaccent'::regdictionary, $1)`.
  7. `privado.tipos_bloque()`, `immutable`, que devuelve `text[]` con exactamente `parrafo, titulo, imagen, cita, lista, galeria, cta, separador, codigo, video`.
  8. `privado.imagen_valida(jsonb)`, `immutable`: es un objeto, `ruta` es string no vacío, `ancho` y `alto` son números > 0, y `alt` es un string no vacío **o** `decorativa = true`.
  9. `privado.contenido_valido(jsonb)`, `immutable`: `jsonb_typeof = 'array'`, `jsonb_array_length <= 200`, y cada elemento es un objeto con `id` string y `tipo` en `privado.tipos_bloque()`.
  10. `privado.fijar_actualizado_en()`, una función de trigger que asigna `new.actualizado_en = now()`.
  11. `privado.asignar_slug()`, **`security definer`** (corre como el rol del editor y necesita llamar a `slugificar` y consultar unicidad), una función de trigger genérica que recibe la columna de origen como `tg_argv[0]`. Si `new.slug` es null o vacío, toma la origen; normaliza con `slugificar`; si existe otra fila con ese slug en `tg_table_name`, agrega `-2`, `-3`… Usa `format('%I', tg_table_name)` **solo** contra `public.articulos`, `public.categorias` o `public.etiquetas`, validado con un `case`.
  12. Los `grant execute` sobre `privado.es_cliente`, `tipos_bloque`, `contenido_valido` e `imagen_valida` a `anon, authenticated`. Las funciones se crean con el owner `postgres`.
- [X] T013 Crear `supabase/migrations/20261018120100_perfiles.sql` ([data-model.md](data-model.md#perfiles)):
  - **Tabla** `public.perfiles` con estas columnas:
    - `id uuid primary key references auth.users(id) on delete restrict`
    - `nombre text not null check (char_length(btrim(nombre)) between 1 and 80)`
    - `biografia text check (char_length(biografia) <= 500)`
    - `avatar jsonb check (avatar is null or privado.imagen_valida(avatar))`
    - `rol public.rol_miembro not null default 'editor'`
    - `activo boolean not null default true`
    - `creado_en` y `actualizado_en`, ambas `timestamptz not null default now()`
  - **Funciones auxiliares**, `stable security definer`:
    - `privado.es_equipo()`: `exists (select 1 from public.perfiles where id = (select auth.uid()) and activo)`. `grant execute` a `anon, authenticated`.
    - `privado.es_admin()`: lo mismo, con `rol = 'admin'`. `grant execute` a `authenticated`.
  - **Trigger** `privado.crear_perfil()`, definer, `after insert on auth.users`, con la lógica de research D3:
    - `nombre := coalesce(nullif(btrim(new.raw_user_meta_data->>'nombre'),''), split_part(new.email,'@',1))`
    - `rol := coalesce((new.raw_app_meta_data->>'rol')::public.rol_miembro, 'editor')`
    - `activo := new.raw_app_meta_data ? 'rol'`
  - **Trigger** `a90_actualizado_en`.
  - **RLS**: `alter table ... enable row level security` y las políticas `perfiles_select_equipo` (select to authenticated using `E`) y `perfiles_update_propio` (update to authenticated, using y with check `id = (select auth.uid()) and (select privado.es_equipo())`).
  - **Grants**: `grant select, update on public.perfiles to authenticated`.
- [X] T014 Crear `supabase/migrations/20261018120200_taxonomias.sql` ([data-model.md](data-model.md#categorias-y-etiquetas-misma-forma)):
  - **Tablas** `public.categorias` y `public.etiquetas`, con estas columnas:
    - `id uuid primary key default gen_random_uuid()`
    - `nombre text not null check (char_length(btrim(nombre)) between 1 and 60)`
    - `slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`
    - `descripcion text check (char_length(descripcion) <= 300)`
    - `creado_en` y `actualizado_en`
  - `create unique index ... on (lower(nombre))`.
  - **Triggers** `a10_asignar_slug` (`execute function privado.asignar_slug('nombre')`) y `a90_actualizado_en`.
  - **Tabla** `public.redirecciones`, con estas columnas:
    - `id uuid primary key default gen_random_uuid()`
    - `tipo_entidad public.tipo_entidad not null`
    - `slug_anterior text not null`
    - `entidad_id uuid not null`
    - `creado_en timestamptz not null default now()`
    - con `unique (tipo_entidad, slug_anterior)` e índice `(entidad_id)`.
  - **RLS**:
    - `categorias_select` y `etiquetas_select` (select to anon, authenticated using `true`).
    - `*_escritura_equipo` (insert, update y delete to authenticated, using y check `(select privado.es_equipo())`).
    - `redirecciones_select` provisional: `using (tipo_entidad <> 'articulo')`. Se reemplaza en T034.
  - **Grants**:
    - `select` sobre las tres tablas a `anon, authenticated`.
    - `insert, update, delete` sobre `categorias` y `etiquetas` a `authenticated`.
- [X] T015 Escribir en `supabase/seed.sql` la sección **usuarios**:
  - Insertar en `auth.users` (y en `auth.identities` con `provider = 'email'`) a `admin@demo.local`, `editora@demo.local` y `editor@demo.local`, con las contraseñas de [quickstart.md](quickstart.md#usuarios-de-demo) hasheadas con `extensions.crypt(..., extensions.gen_salt('bf'))`, `email_confirmed_at = now()`, `raw_app_meta_data = '{"provider":"email","providers":["email"],"rol":"admin|editor"}'` y `raw_user_meta_data` con `nombre` (`Ana Admin`, `Eva Editora`, `Edu Editor`).
  - Encabezado: "-- Solo para entornos locales y de demo".
- [X] T016 Ejecutar `pnpm db:reset && pnpm db:tipos` y commitear `packages/db/src/tipos.ts`.
- [X] T017 [P] Crear `packages/db/src/cliente.ts`, con `export type ClienteBlog = SupabaseClient<Database>` y `crearClientePublico(url, claveAnon)` (`auth: { persistSession: false }`).
- [X] T018 [P] Crear `packages/db/src/errores.ts`, con `ErrorDominio`, `CodigoError` y `traducirError` según [contracts/db.md](contracts/db.md#errores-de-dominio). Debe pasar T011.
- [X] T019 Actualizar `packages/db/src/index.ts` para que reexporte `cliente`, `errores` y los tipos `Database`. Ejecutar `pnpm test:db` y `pnpm --filter @blog/db test`: T007 a T011 tienen que pasar.

**Checkpoint**: Base lista. Hay privilegios cerrados, perfiles con alta controlada y taxonomías con slugs.

---

## Fase 3: Historia 1 - Redactar un artículo con bloques como borrador (P1) 🎯 MVP

**Objetivo**: Un miembro del equipo crea y edita artículos en borrador, con contenido validado en bloques. Los visitantes no los ven.

**Prueba independiente**: Como `editor@demo.local`, crear un artículo con 3 bloques y releerlo (con contenido, orden y estado `borrador` intactos). Como anon, no obtenerlo. Un bloque inválido se rechaza con su índice y campo.

### Tests de la Historia 1 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T020 [P] [H1] Crear `packages/bloques/src/imagen.test.ts`:
  - imagen válida;
  - error cuando falta `alt` y `decorativa = false`, con el mensaje "La imagen necesita un texto alternativo o marcarse como decorativa";
  - válida si `decorativa = true` sin `alt`;
  - rechazo de `ancho`/`alto` ≤ 0 o no enteros, y de `alt` > 200.
- [X] T021 [P] [H1] Crear `packages/bloques/src/esquema.test.ts`, con un caso válido y al menos un caso inválido **por cada uno** de los 10 tipos, siguiendo la tabla de [contracts/bloques.md](contracts/bloques.md#tipos-de-bloque):
  - `parrafo` con `texto` de 1–5.000;
  - `titulo` con `nivel` 2, 3 o 4 y texto de 1–150;
  - `cita` con texto ≤ 1.000 y `fuente` https;
  - `lista` con 1–50 items de 1–500;
  - `galeria` con 2–24 imágenes y `columnas` 2, 3 o 4 (3 por defecto);
  - `cta` con etiqueta de 1–40 y `url` interna `/…` o https;
  - `codigo` ≤ 20.000 con `lenguaje` `^[a-z0-9+#-]{1,20}$`;
  - `video` con `proveedor` youtube o vimeo, `idVideo` válido por proveedor y `titulo` obligatorio;
  - `separador`;
  - `imagen` con leyenda ≤ 300.
  Además: un `tipo` inexistente se rechaza, más de 200 bloques se rechazan, y todo bloque exige `id` uuid.
- [X] T022 [P] [H1] Crear `packages/bloques/src/validar.test.ts` (H1-E2, CE-006):
  - `validarContenido` devuelve **todos** los errores, con `indice` en base 0 y `campo` con ruta de puntos (`imagen.alt`, `items.3`);
  - los mensajes están en español;
  - nunca lanza, ni siquiera con entradas `null`, string u objeto;
  - un contenido válido devuelve `{ ok: true, contenido }`.
- [X] T023 [P] [H1] Crear `packages/bloques/src/utilidades.test.ts`:
  - `textoPlano` concatena el texto de `parrafo`, `titulo`, `cita` y `lista`, sin marcas Markdown ni URLs, y omite `codigo`;
  - `crearBloque(tipo)` devuelve un bloque con `id` nuevo que **no** pasa la validación hasta completarse (salvo `separador`).
- [X] T024 [P] [H1] Crear `supabase/tests/articulos_borrador.test.sql` (H1-E1, H1-E3, H1-E4, RF-008, B5). Debe verificar:
  - el insert como editor con 3 bloques queda `estado = borrador`, con el slug derivado del título y `version = 1`;
  - un segundo artículo con el mismo título recibe el slug `mi-articulo-2`;
  - anon no ve el borrador (`is_empty`);
  - un insert con `autor_id` ajeno se rechaza;
  - si un editor intenta escribir `publicado_en`, `version = 99` o `estado = 'publicado'` en el insert, se fuerzan `null`, `1` y `borrador`;
  - en el update se conservan `autor_id` y `publicado_en`;
  - cambiar el `titulo` de un borrador **no** cambia su `slug` (caso borde de la spec);
  - un update con una `version` desactualizada lanza `conflicto_version`;
  - un update correcto incrementa la versión;
  - un `contenido` con un `tipo` inexistente o con más de 200 elementos viola el check;
  - un editor no puede borrar (solo un admin);
  - un editor desactivado no puede insertar.
- [X] T025 [P] [H1] Crear `supabase/tests/storage.test.sql`:
  - anon puede leer objetos del bucket `medios` y no puede insertar;
  - un editor activo puede insertar, actualizar y borrar en `medios`;
  - un editor desactivado no puede;
  - ninguna política permite operar en otro `bucket_id`.
- [X] T026 [P] [H1] Crear `packages/db/src/consultas/equipo-articulos.test.ts`, de integración (con sesión de editor):
  - `crearArticulo` con contenido inválido devuelve `contenido_invalido` con `ErrorBloque[]` **sin** llamar a la base (espiar `from`);
  - `actualizarArticulo` siempre envía `version` en el filtro;
  - un conflicto se traduce a `ErrorDominio('conflicto_version')`;
  - `previsualizarSlug('Año de Diseño', 'articulo')` devuelve `ano-de-diseno`.

### Implementación de la Historia 1

- [X] T027 [P] [H1] Crear `packages/bloques/src/imagen.ts` con `esquemaImagen`, `{ ruta: string min 1, ancho: int > 0, alto: int > 0, alt?: string 1–200, decorativa: boolean default false }`, más un `superRefine` que exige `alt` si no es decorativa.
- [X] T028 [H1] Crear `packages/bloques/src/esquema.ts`, con `esquemaBloque` (`z.discriminatedUnion('tipo', [...])` sobre la base `{ id: z.uuid(), tipo }`) y `esquemaContenido` (`z.array(esquemaBloque).max(200)`), siguiendo [contracts/bloques.md](contracts/bloques.md#tipos-de-bloque). Reutiliza `esquemaImagen` y `TIPOS_BLOQUE` del `index.ts` existente. Debe pasar T021. Depende de T027.
- [X] T029 [H1] Crear `packages/bloques/src/validar.ts` (`validarContenido` y `ErrorBloque`, que convierte `issues` de Zod a `{ indice, campo, mensaje }`) y `packages/bloques/src/utilidades.ts` (`textoPlano` y `crearBloque`). Actualizar `packages/bloques/src/index.ts` para reexportar todo según [contracts/bloques.md](contracts/bloques.md#exportaciones). Deben pasar T020, T022 y T023.
- [X] T030 [H1] Crear `supabase/migrations/20261018120300_articulos.sql` ([data-model.md](data-model.md#articulos)):
  - **Antes, corregir `20261018120000_fundacion.sql`**. Está permitido porque la rama no se mergeó (ver Notas). Son dos errores que detectó escritor-tests: un `check` que da NULL se considera cumplido.
    - `privado.imagen_valida` devuelve NULL (no false) si falta `ruta`, `ancho`, `alto` o `alt`: envolver la expresión en `coalesce(..., false)`.
    - `privado.contenido_valido` acepta bloques sin `id` o sin `tipo` (`jsonb_typeof(null) <> 'string'` da NULL): usar `is distinct from` y `coalesce`.
    - Agregar casos de regresión a `supabase/tests/slugs.test.sql` (o a un archivo `utilidades.test.sql`) para ambas funciones, incluido `perfiles.avatar` sin alt.
  - **Tabla** `public.articulos`, con las columnas exactamente como en el data-model y estas reglas:
    - `titulo`: `not null check (char_length(btrim(titulo)) between 1 and 120)`
    - `slug`: `not null default '' unique`, con el check de formato. El `default ''` evita que el tipo `Insert` exija el slug, porque lo genera `a10`. Aplicar el mismo `default ''` a `categorias.slug` y `etiquetas.slug` en `20261018120200_taxonomias.sql`.
    - `autor_id`: `default auth.uid()`. La política de insert exige que sea el usuario actual, así que `crearArticulo` no lo envía.
    - `extracto ≤ 300`, `titulo_seo ≤ 60`, `descripcion_seo ≤ 160`
    - `imagen_destacada`: `check (imagen_destacada is null or privado.imagen_valida(imagen_destacada))`
    - `contenido jsonb not null default '[]' check (privado.contenido_valido(contenido))`
    - `estado`, `programado_para` y `publicado_en`
    - `autor_id`: `not null references public.perfiles(id) on delete restrict`
    - `categoria_id`: `references public.categorias(id) on delete restrict`
    - `version integer not null default 1`
    - `creado_en` y `actualizado_en`
    La columna `busqueda` se agrega en H5.
  - **Índices** `(estado, publicado_en desc)`, `(categoria_id, publicado_en desc)` y `(autor_id)`.
  - **Triggers**:
    - `a10_asignar_slug` (`privado.asignar_slug('titulo')`)
    - `a20_campos_sistema`: si `privado.es_cliente()`, en el insert fuerza `version := 1`, `publicado_en := null`, `estado := 'borrador'` y `creado_en := now()`; en el update conserva `autor_id`, `creado_en` y `publicado_en` de `old`.
    - `a30_controlar_version`: con `pg_trigger_depth() > 1` hace `new.version := old.version`; si no, `new.version <> old.version` lanza `conflicto_version`, y `new.version := old.version + 1`.
    - `a90_actualizado_en`
  - **RLS**:
    - `articulos_select_publico` (to anon): `estado = 'publicado' and publicado_en <= now()`
    - `articulos_select_equipo` (to authenticated): lo mismo `or (select privado.es_equipo())`
    - `articulos_insert_equipo`: with check `(select privado.es_equipo()) and autor_id = (select auth.uid())`
    - `articulos_update_equipo`: using y check `E`
    - `articulos_delete_admin`: using `A`
  - **Grants**: `select` a `anon, authenticated`; `insert, update, delete` a `authenticated`.
  - **RPC** `public.previsualizar_slug(texto text, tipo public.tipo_entidad)`, `stable`, **`security definer`** (necesita `slugificar`, que `authenticated` no puede ejecutar por D20), con `set search_path = ''`, `case` estático, sin SQL dinámico y con chequeo `privado.es_equipo()`. `revoke execute ... from public` y `grant execute` solo a `authenticated`.
- [X] T031 [P] [H1] Crear `supabase/migrations/20261018120310_storage.sql`: `insert into storage.buckets (id, name, public) values ('medios','medios', true) on conflict do nothing`, con las políticas `medios_select` (select to anon, authenticated using `bucket_id = 'medios'`), `medios_insert_equipo` (insert, with check), `medios_update_equipo` (update, using y with check) y `medios_delete_equipo` (delete, using). Las tres de escritura van `to authenticated` con la condición `bucket_id = 'medios' and (select privado.es_equipo())`. Nota: `storage.protect_delete()` bloquea los DELETE directos en SQL; la Storage API habilita `storage.allow_delete_query`.
- [X] T032 [H1] Crear `packages/db/src/consultas/equipo-articulos.ts`:
  - `crearArticulo(c, datos)`: valida con `validarContenido` antes de llamar a la base;
  - `actualizarArticulo(c, id, version, cambios)`: `update ... eq('id', id).eq('version', version)`; si responde 0 filas, distingue entre `no_encontrado` y `conflicto_version`;
  - `eliminarArticulo(c, id)`;
  - `previsualizarSlug(c, texto, tipo)`;
  - un reintento único ante `slug_duplicado`.
  Reexportar en `packages/db/src/index.ts`. Ejecutar `pnpm db:reset && pnpm db:tipos`. Deben pasar T024, T025 y T026.
- [X] T033 [H1] Agregar a `supabase/tests/privilegios.test.sql` los objetos de H1: `articulos`, `previsualizar_slug` (sin acceso de anon) y las políticas de `storage.objects`.

**Checkpoint**: La Historia 1 está completa y es testeable por sí sola: `pnpm test:db` y `pnpm test` en verde para H1.

---

## Fase 4: Historia 2 - Publicar y que el visitante vea solo lo publicado (P1)

**Objetivo**: Máquina de estados, publicación, datos públicos de autores, redirecciones de artículos y notificación de cambios públicos.

**Prueba independiente**: Publicar un borrador con categoría y verlo como anon junto con su autor público. Archivarlo y que desaparezca. Cambiar el slug y que la redirección resuelva. Publicar sin categoría y que se rechace.

### Tests de la Historia 2 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T034 [P] [H2] Crear `supabase/tests/articulos_publicacion.test.sql` (H2-E1, H2-E3, H2-E5, RF-009, RF-010). Debe verificar:
  - **la matriz completa**: las 7 transiciones permitidas pasan y todas las demás combinaciones lanzan `estado_invalido`;
  - publicar sin categoría lanza `requisitos_publicacion` con `detail = 'categoria'`;
  - publicar con contenido vacío lanza `requisitos_publicacion` con `detail = 'contenido'`;
  - la primera publicación asigna `publicado_en ≈ now()`;
  - la republicación (archivado → borrador → publicado) conserva el `publicado_en` original;
  - un insert como `postgres` en estado `publicado` con un `publicado_en` dado lo conserva, y un insert como `postgres` en `archivado` o `programado` (con fecha futura) es válido: el seed puede cargar cualquier estado;
  - un publicado es visible para anon;
  - archivar lo oculta para anon y lo mantiene visible para el equipo;
  - publicado → borrador lo oculta;
  - los checks `estado <> 'publicado' or publicado_en is not null` y `estado <> 'programado' or programado_para is not null` se aplican.
- [X] T035 [P] [H2] Crear `supabase/tests/redirecciones.test.sql` (H2-E4, D11, D24). Debe verificar:
  - cambiar el slug de un artículo publicado crea `redirecciones(articulo, slug_viejo)`;
  - cambiar el slug de un borrador nunca publicado **no** la crea;
  - cambiar el `titulo` de un publicado **no** cambia el slug ni crea una redirección (caso borde de la spec);
  - A→B→C deja dos redirecciones que resuelven a C (sin cadenas);
  - volver al slug A borra la redirección A;
  - `resolver_redireccion('articulo','a')` devuelve el slug actual para anon;
  - si el artículo se despublicó, devuelve **null** para anon y el slug para el equipo;
  - borrar el artículo borra sus redirecciones;
  - anon no puede insertar en `redirecciones`.
- [X] T036 [P] [H2] Crear `supabase/tests/autores_publicos.test.sql` (H2-E2, D5, B1). Debe verificar:
  - la vista devuelve exactamente `id, nombre, biografia, avatar` (`columns_are`);
  - incluye solo autores con algún artículo `publicado` y `publicado_en <= now()`;
  - `insert`, `update` y `delete` sobre la vista **fallan** como `anon` y como `authenticated` (`throws_ok`);
  - anon sigue sin poder leer `perfiles`.
- [X] T037 [P] [H2] Crear `supabase/tests/notificaciones.test.sql` (RF-013, contracts/revalidacion.md). Dentro de la transacción, crear los secretos con `vault.create_secret('http://prueba.local','url_web_revalidacion')` y `vault.create_secret('secreto','secreto_revalidacion')`, y contar las filas nuevas de `net.http_request_queue`. Debe verificar:
  - **se encola** un mensaje al publicar, al editar el título de un publicado, al archivar, al cambiar el slug (con los slugs viejo y nuevo en el body) y al borrar un publicado (en H2 con `etiquetas: []`; T045 verifica las etiquetas reales);
  - **no se encola** nada al editar un borrador o un programado, ni con un update que solo cambia `version` o `actualizado_en`;
  - sin secretos en Vault, no se encola nada y la transacción no falla;
  - la petición **no** lleva `Authorization`: lleva `X-Blog-Marca-Tiempo` y `X-Blog-Firma = sha256=HMAC-SHA256(secreto, marca.cuerpo)`, y el test recalcula la firma;
  - el secreto no aparece en ninguna fila de `net.http_request_queue` (decisión HMAC, D14), y anon/authenticated no leen `vault.decrypted_secrets`.
- [X] T038 [P] [H2] Crear `packages/db/src/rutas-afectadas.test.ts`, con las rutas exactas de [contracts/revalidacion.md](contracts/revalidacion.md#rutas-que-calcula-rutasafectadas-blogdb):
  - para un artículo con dos slugs, una categoría y dos etiquetas: `/blog/{slug}` ×2, `/blog`, `/blog/pagina/1` a `5`, `/blog/categoria/{c}`, `/blog/etiqueta/{e}` ×2, `/`, `/sitemap.xml` y `/rss.xml`, sin duplicados;
  - los casos `categoria`, `etiqueta` y `autor`.
- [X] T039 [P] [H2] Crear `packages/db/src/consultas/articulos-publicos.test.ts`, de integración como anon:
  - `obtenerArticuloPublicado` devuelve el artículo con `categoria`, `etiquetas[]`, un `autor` que contiene solo `nombre/biografia/avatar` y un `seo` con respaldo (sin `titulo_seo`, se usa `titulo`; sin `descripcion_seo`, se usa `extracto`);
  - devuelve `null` para un borrador;
  - `resolverRedireccion` funciona;
  - las consultas hacen una sola petición (contar las llamadas a `fetch`).

### Implementación de la Historia 2

- [X] T040 [H2] Crear `supabase/migrations/20261018120400_estados_y_publicacion.sql`:
  - **Checks** en `articulos`:
    - `estado not in ('programado','publicado') or (categoria_id is not null and jsonb_typeof(contenido) = 'array' and jsonb_array_length(contenido) > 0)`
    - `estado <> 'programado' or programado_para is not null`
    - `estado <> 'publicado' or publicado_en is not null`
  - **`create or replace` de `privado.campos_sistema_articulo()`** para quitar el congelamiento temporal de `estado` y `programado_para` en el update (validación A-M2). A partir de acá los controla `a40`.
  - **Trigger** `a40_validar_estado` (before ins/upd):
    - **insert**: si `privado.es_cliente()`, el estado ya viene forzado a `borrador` por `a20`; si no (seed o sistema), cualquier estado es válido y solo se aplican los requisitos y los checks;
    - **update**: la matriz de [data-model.md](data-model.md#máquina-de-estados) para todos los roles;
    - los requisitos, con `detail` `categoria` o `contenido`;
    - `fecha_no_futura` solo **para clientes** (`privado.es_cliente()`), al entrar a `programado` o al cambiar `programado_para` estando programado. El sistema y el seed pueden insertar programados con fecha futura sin chequeo;
    - **Actualizar `supabase/tests/articulos_borrador.test.sql`**: la aserción "A-M2: hasta H2 el cliente no cambia el estado" deja de valer. Reemplazarla por una que verifique que publicar un borrador sin categoría lanza `requisitos_publicacion` (`throws_ok`), porque si no aborta el archivo.
    - si queda `estado = 'publicado'` con `new.publicado_en` nulo: `publicado_en := case when privado.es_cliente() then now() else coalesce(new.programado_para, now()) end`. Si ya tiene valor (republicación, ya preservado por `a20`, o valor que trae el seed), no se toca;
    - `programado_para := null` al salir de `programado`.
  - **Triggers** `z10_registrar_redireccion` (after upd: `new.slug is distinct from old.slug and old.publicado_en is not null`; `insert ... on conflict (tipo_entidad, slug_anterior) do update set entidad_id = excluded.entidad_id, creado_en = now()`; `delete from redirecciones where tipo_entidad = 'articulo' and slug_anterior = new.slug`) y `z20_borrar_redirecciones` (after delete). Ambos son definer.
  - **Política** `redirecciones_select`, reemplazada por `tipo_entidad <> 'articulo' or exists (select 1 from public.articulos a where a.id = entidad_id)`.
  - **RPC** `public.resolver_redireccion(tipo public.tipo_entidad, slug text)`, invoker y `stable`, que hace join contra la tabla de la entidad. `grant execute` a `anon, authenticated`.
  - **Vista** `public.autores_publicos`, exactamente como en [data-model.md](data-model.md#vista-autores_publicos), con `security_barrier`, `revoke all` y `grant select`.
- [X] T041 [H2] Crear `supabase/migrations/20261018120500_notificacion.sql` (research D14):
  - `privado.notificar_cambio_publico(cuerpo jsonb)`, definer y owner `postgres`: lee `url_web_revalidacion` y `secreto_revalidacion` de `vault.decrypted_secrets`; si falta alguno, `return`; si no: `marca := extract(epoch from now())::bigint::text`, `cuerpo_final := cuerpo || jsonb_build_object('ocurrido_en', now())`, `firma := 'sha256=' || encode(extensions.hmac(marca || '.' || cuerpo_final::text, secreto, 'sha256'), 'hex')` y `perform net.http_post(url || '/api/revalidar', cuerpo_final, headers => jsonb_build_object('Content-Type','application/json','X-Blog-Marca-Tiempo',marca,'X-Blog-Firma',firma))`. **No** enviar el secreto (D14). Verificar que la serialización que firma (`cuerpo_final::text`) es idéntica a los bytes que encola `pg_net`; T037 lo comprueba. Todo envuelto en `exception when others then raise warning` (una URL malformada hace fallar a `http_post`).
  - `slugs`, según el contrato: `[slug]` si no cambió y `[actual, anterior]` si cambió. `categorias`: la unión **sin repetidos** de la de antes y la de después.
  - En `articulos`:
    - `z90_notificar_cambio` (after ins/upd): solo si `old` o `new` es público; ignora los updates cuyo `to_jsonb(new) - '{busqueda,version,actualizado_en}'` es igual al de `old`; arma el body con `tipo`, `id`, `slugs` (el viejo y el nuevo), `categorias` (los slugs de antes y después) y `etiquetas: []` (la tabla `articulos_etiquetas` se crea en H3 y T048 completa este campo; **no** referenciarla acá, porque PL/pgSQL fallaría al ejecutar).
    - `n10_notificar_borrado` (before delete): solo si estaba publicado, con `etiquetas: []` hasta T048.
  - En `categorias` y `etiquetas`: `z90_notificar_cambio` (after ins/upd/del) con `tipo` y `slugs`.
  - `revoke execute` de todas estas funciones a `public`.
- [X] T042 [P] [H2] Crear `packages/db/src/rutas-afectadas.ts`, con `CambioPublico` y `rutasAfectadas()` como función pura y sin duplicados. Debe pasar T038.
- [X] T043 [H2] Crear `packages/db/src/consultas/articulos-publicos.ts`:
  - `obtenerArticuloPublicado(c, slug)`: un único `select` con `categoria:categorias(nombre,slug)`, `etiquetas:articulos_etiquetas(etiqueta:etiquetas(nombre,slug))` y `autor:autores_publicos!autor_id(nombre,biografia,avatar)`. PostgREST **sí** embebe la vista (verificado por escritor-tests). T039 exige una sola petición, así que **no** hay plan alternativo con una segunda consulta.
  - Una función `aSeo()` que aplica el respaldo de RF-006.
  - `resolverRedireccion(c, tipo, slug)`.
  Reexportar. `articulos_etiquetas` se crea en H3, así que en esta tarea `etiquetas` se devuelve como `[]` y el embebido real se agrega en T051. Ejecutar `pnpm db:reset && pnpm db:tipos`. Deben pasar T034 a T039.
- [X] T044 [H2] Agregar a `supabase/tests/privilegios.test.sql`: `autores_publicos` (solo `select`), `resolver_redireccion` y que `privado.notificar_cambio_publico` no sea ejecutable por `anon` ni `authenticated`.

**Checkpoint**: Las historias 1 y 2 funcionan por separado: se puede publicar y el visitante solo ve lo publicado.

---

## Fase 5: Historia 3 - Navegar por categorías y etiquetas (P1)

**Objetivo**: Etiquetado atómico, listados paginados por categoría y etiqueta, protección de las categorías en uso y redirecciones de taxonomías.

**Prueba independiente**: Con categorías y etiquetas asignadas a artículos en distintos estados, los listados devuelven solo los publicados, ordenados y paginados. Una categoría en uso no se puede borrar y el error informa el conteo.

### Tests de la Historia 3 (escribir PRIMERO, deben FALLAR) ⚠️

- [X] T045 [P] [H3] Crear `supabase/tests/taxonomias.test.sql` (H3-E3, H3-E4, D22, D23, RF-012). Debe verificar:
  - borrar una categoría con 2 artículos lanza `categoria_en_uso` con `detail = '2'`;
  - borrar una categoría sin artículos funciona;
  - borrar una etiqueta la quita de los artículos y los artículos se conservan;
  - `asignar_etiquetas(id, array[...], version)` reemplaza el conjunto y devuelve la versión nueva;
  - con una versión vieja lanza `conflicto_version` y no cambia nada;
  - anon no puede ejecutarla;
  - cambiar el slug de una categoría o etiqueta crea una redirección (siempre, son públicas) y `resolver_redireccion('categoria', viejo)` devuelve el nuevo;
  - anon ve las filas de `articulos_etiquetas` solo de artículos publicados;
  - el equipo las ve todas;
  - `asignar_etiquetas` sobre un artículo publicado encola **un** solo mensaje con las etiquetas nuevas (con los secretos de Vault creados en la transacción);
  - después de `asignar_etiquetas`, la versión devuelta es igual a la `version` de la fila (sin doble incremento) y `busqueda` incluye los nombres de las etiquetas nuevas;
  - un editor que hace `insert` o `delete` directo en `articulos_etiquetas` recibe `permission denied` (la única vía de escritura es el RPC);
  - un miembro desactivado que ejecuta `asignar_etiquetas` recibe `sin_permiso`;
  - borrar un artículo publicado notifica con sus etiquetas (las lee `n10_notificar_borrado` antes del cascade).
- [X] T046 [P] [H3] Crear `packages/db/src/consultas/listados.test.ts`, de integración como anon (H3-E1, H3-E2, H3-E5, RF-017). Debe verificar:
  - `listarPorCategoria` devuelve solo los publicados, ordenados por `publicado_en desc`, con `Pagina` correcta (`total`, `totalPaginas`, `porPagina = 12` por defecto);
  - `listarPorEtiqueta` incluye un artículo con la etiqueta "diseño";
  - una categoría sin publicados devuelve `items: []`;
  - un slug inexistente devuelve `null`;
  - `listarArticulosPublicados` pagina;
  - `listarParaSitemap` devuelve artículos publicados y solo las taxonomías con algún artículo publicado (observación de arquitecto-db).
- [X] T047 [P] [H3] Crear `packages/db/src/consultas/equipo-taxonomias.test.ts`:
  - `eliminarTaxonomia('categoria', id)` con artículos asignados lanza `ErrorDominio('categoria_en_uso')` con el conteo;
  - `asignarEtiquetas` envía `version` y devuelve la nueva.

### Implementación de la Historia 3

- [X] T048 [H3] Crear `supabase/migrations/20261018120600_etiquetado.sql`:
  - **Tabla** `public.articulos_etiquetas`, con estas columnas y reglas:
    - `articulo_id uuid references public.articulos(id) on delete cascade`
    - `etiqueta_id uuid references public.etiquetas(id) on delete cascade`
    - `primary key (articulo_id, etiqueta_id)`
    - índice `(etiqueta_id, articulo_id)`
  - **RLS**:
    - `ae_select_publico` (to anon): `exists (select 1 from public.articulos a where a.id = articulo_id and a.estado = 'publicado' and a.publicado_en <= now())`
    - `ae_select_equipo` (to authenticated): lo mismo `or E`
    - **sin** políticas de escritura: la única vía es `asignar_etiquetas`.
  - **Grants**: solo `select` a `anon, authenticated` (ningún `insert` ni `delete` para clientes).
  - **Cuidados de implementación** (los detectó escritor-tests):
    - **Nombres de parámetros:** en PL/pgSQL, `articulo_id` y `version` chocan con columnas (columna ambigua), así que hay que calificarlos (`asignar_etiquetas.version`). En `mensaje_articulo` (SQL), dentro de un subselect sobre `etiquetas`, `id` resuelve a `e.id` **sin dar error**: usar `mensaje_articulo.id`.
    - **SQL dinámico:** el cuerpo de `asignar_etiquetas` no puede contener la palabra `execute ` ni siquiera en comentarios, porque `privilegios.test.sql` lo busca en las funciones definer expuestas.
    - **Búsqueda:** `busqueda` y `a50` llegan en H5. En H3 el update de versión del paso 4 sigue siendo obligatorio (versión y notificación). Los 2 tests de búsqueda de T045 se saltean hasta que exista la columna.
  - **RPC** `public.asignar_etiquetas(articulo_id uuid, etiqueta_ids uuid[], version int) returns int`: `volatile`, **`security definer`**, `search_path = ''`. Pasos:
    1. `if not privado.es_equipo() then raise ... 'sin_permiso'`.
    2. `select version from public.articulos where id = $1 for update`. Si no existe, lanza `no_encontrado`; si `version <> $3`, lanza `conflicto_version`.
    3. `delete from public.articulos_etiquetas where articulo_id = $1` y `insert` de `unnest($2)` (sin repetidos).
    4. **Un único** `update public.articulos set version = $3 where id = $1`. `a30` lo incrementa y `a50` recalcula la búsqueda leyendo las etiquetas nuevas.
    5. Si el artículo está publicado, emitir **una** notificación con `privado.mensaje_articulo(..., etiqueta_ids_extra => <etiquetas anteriores>)`. Las anteriores se leen **antes** del `delete` del paso 3.
    6. Devolver `$3 + 1`.
    `revoke execute ... from public` y `grant execute` a `authenticated`.
  - **Categorías**: trigger `a05_impedir_borrado_en_uso` (before delete), que cuenta los artículos y lanza `categoria_en_uso` con `detail = conteo::text`.
  - **Categorías y etiquetas**: `z10_registrar_redireccion` (`after update ... for each row when (old.slug is distinct from new.slug)`; la condición va en el `WHEN`, no en la función: validación A3-B1) y `z30_borrar_redirecciones` (after delete), reutilizando las funciones genéricas de T040 parametrizadas por `tg_argv[0]` = tipo de entidad.
  - Completar `etiquetas` **solo en `privado.mensaje_articulo`** (el mensaje único de cambios y borrados; validación C3-M2). Debe leer `articulos_etiquetas` y unir las etiquetas actuales con un 4.º parámetro `etiqueta_ids_extra uuid[] default '{}'`, que usa `asignar_etiquetas` para las anteriores (validación A4-M2). Para cambiar la firma:
    1. `drop function privado.mensaje_articulo(uuid, jsonb, uuid[]);` y crearla con la firma nueva. **No** usar `create function` con un parámetro más, porque dejaría una sobrecarga y las llamadas de 3 argumentos de `z90` y `n10` se volverían ambiguas al ejecutar.
    2. Volver a crear (`create or replace`) `privado.notificar_cambio_articulo` y `privado.notificar_borrado_articulo` en la misma migración. PL/pgSQL no registra dependencias: el `drop` no falla, pero las rompería recién al ejecutarse.
    3. `n10` sigue llamando antes del cascade.
  - Nombres: en las taxonomías el borrado de redirecciones es `z30_borrar_redirecciones`, porque `z20` queda para `z20_recalcular_articulos` (H5). En artículos es `z20_borrar_redirecciones`. No hay triggers por fila en `articulos_etiquetas`. Actualizar también la tabla de privilegios y la de RLS en [data-model.md](data-model.md).
- [X] T049 [P] [H3] Crear `packages/db/src/consultas/listados.ts`, con `listarArticulosPublicados`, `listarPorCategoria`, `listarPorEtiqueta` y `listarParaSitemap`, según [contracts/db.md](contracts/db.md#consultas-públicas-visitante). Usa `count: 'exact'` y `range()`, y un tipo `Pagina<T>` compartido en `packages/db/src/paginacion.ts` (`pagina` empieza en 1 y `totalPaginas = ceil(total / porPagina)`). El orden es `publicado_en desc, id desc` (estable con fechas iguales). `ResumenArticulo` se agrega en `tipos-publicos.ts` y sus casts en `mapeo.ts`. Los listados por taxonomía pueden hacer **hasta 2 peticiones** (taxonomía y artículos) y el sitemap hasta 3: es una cantidad constante, sin N+1 (contrato). Debe pasar T046.
- [X] T050 [P] [H3] Crear `packages/db/src/consultas/equipo-taxonomias.ts`, con `crearTaxonomia`, `actualizarTaxonomia`, `eliminarTaxonomia` y `asignarEtiquetas` (vía `rpc('asignar_etiquetas')`). Debe pasar T047.
- [X] T051 [H3] Agregar el embebido de `etiquetas` en `obtenerArticuloPublicado` (`packages/db/src/consultas/articulos-publicos.ts`). **Actualizar `articulos-publicos.test.ts` (T039)** para que asigne etiquetas y verifique el embebido real, en lugar de `etiquetas: []` (hoy ninguna tarea lo pedía). Ejecutar `pnpm db:reset && pnpm db:tipos`. Deben pasar T045 a T047 y T039 completo.
- [X] T052 [H3] Agregar a `supabase/tests/privilegios.test.sql`: `articulos_etiquetas` (anon y authenticated solo `select`: sin insert ni delete) y `asignar_etiquetas` (solo `authenticated`, `security definer`).

**Checkpoint**: Las historias P1 están completas y el blog es navegable a nivel de datos.

---

## Fase 6: Historia 4 - Programar una publicación (P2)

**Objetivo**: Estado `programado` con publicación automática en menos de 60 s.

**Prueba independiente**: Programar un artículo, ejecutar `privado.publicar_programados()` con una fecha vencida y verificar que se publica con `publicado_en = programado_para`.

### Tests de la Historia 4 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T053 [P] [H4] Crear `supabase/tests/programacion.test.sql` (H4-E1 a H4-E4, RF-011, CE-003). Debe verificar:
  - programar para `now() + interval '1 day'` deja `estado = programado`, invisible para anon;
  - programar para una fecha pasada lanza `fecha_no_futura`;
  - cancelar (programado → borrador) limpia `programado_para`;
  - forzar `programado_para` al pasado como `postgres` y ejecutar `privado.publicar_programados()` publica, con `publicado_en = programado_para`, y **incrementa la versión**;
  - un programado futuro no se toca;
  - publicar manualmente un programado usa `now()` y descarta la programación;
  - existe el job `publicar-programados` con el schedule `* * * * *` y el job `limpiar-historial-cron` (`select ... from cron.job`);
  - `publicar_programados` no es ejecutable por `anon` ni `authenticated`.

### Implementación de la Historia 4

- [ ] T054 [H4] Crear `supabase/migrations/20261018120700_programacion.sql`:
  - índice `(programado_para) where estado = 'programado'`;
  - `privado.publicar_programados()`, definer: `update public.articulos set estado = 'publicado' where id in (select id from public.articulos where estado = 'programado' and programado_para <= now() for update skip locked)`;
  - `select cron.schedule('publicar-programados', '* * * * *', 'select privado.publicar_programados()')`;
  - `select cron.schedule('limpiar-historial-cron', '0 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$)`.
  Verificar que `a40_validar_estado` asigna `publicado_en = programado_para` cuando `not privado.es_cliente()`.
- [ ] T055 [H4] Agregar `cambiarEstado(c, id, version, destino, { programadoPara })` en `packages/db/src/consultas/equipo-articulos.ts`, con un test en `equipo-articulos.test.ts` que verifique que `fecha_no_futura` se traduce. Ejecutar `pnpm db:reset`. Debe pasar T053.

**Checkpoint**: La programación funciona sin intervención.

---

## Fase 7: Historia 5 - Buscar artículos en español (P2)

**Objetivo**: Búsqueda full-text tolerante a tildes y variantes, ponderada y limitada a lo publicado.

**Prueba independiente**: Con artículos de textos conocidos, las búsquedas con variantes devuelven lo esperado entre los 3 primeros resultados, nunca devuelven no publicados y responden en menos de 1 s.

### Tests de la Historia 5 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T056 [P] [H5] Crear `supabase/tests/busqueda.test.sql` (H5-E1 a H5-E4, RF-018 a RF-020, CE-004). Debe incluir:
  - **un conjunto de prueba explícito** de al menos 20 pares (consulta → artículo esperado), que incluye: sin tildes (`diseno` → "Diseño"), plural y singular, conjugaciones, mayúsculas, y los 3 casos difíciles conocidos (`publicaciones` frente a `publicación`, `educaciones` frente a `educación`, `correr` frente a `corrió`). Calcular el % de aciertos en el top 3 y verificar que sea **≥ 95 %**. Si no se llega, el test falla y se registra la desviación en `validacion.md` (research D12).
  - Que un término en el título rankee por encima del mismo término solo en el cuerpo.
  - Que un borrador con el término no aparezca, ni para anon **ni para un editor**, porque el filtro es explícito.
  - Que una consulta vacía o sin coincidencias devuelva 0 filas sin error.
  - Que `limite = 500` devuelva como máximo 50.
  - Que `total` venga en cada fila.
  - Que los bloques `codigo` no se indexen.
  - Que las URLs de `[texto](url)` no se indexen.
  - Que renombrar una etiqueta o categoría actualice `busqueda` de sus artículos **sin** incrementar `version` y **sin** encolar notificaciones por cada artículo.
- [ ] T057 [P] [H5] Crear `packages/db/src/consultas/busqueda.test.ts`, de integración: `buscarArticulos(c, 'diseno')` devuelve `Pagina` con los items y el total, y responde en menos de 1.000 ms sobre los datos de demo (CE-005).

### Implementación de la Historia 5

- [ ] T058 [H5] Crear `supabase/migrations/20261018120800_busqueda.sql` (research D12):
  - `create text search configuration public.es_sin_tildes (copy = pg_catalog.spanish); alter text search configuration public.es_sin_tildes alter mapping for hword, hword_part, word with extensions.unaccent, pg_catalog.spanish_stem;`
  - `privado.bloques_a_texto(jsonb)`, `immutable`: extrae el texto de `parrafo`, `titulo`, `cita` (texto y autor), `lista`, `imagen` (`alt` y leyenda), `galeria` (alts), `cta` (título y texto) y `video` (título); excluye `codigo`; reemplaza `\[([^\]]*)\]\([^)]*\)` por `\1`; trunca a 200.000 caracteres.
  - `privado.documento_busqueda(texto text, peso "char")`: `setweight(to_tsvector('public.es_sin_tildes', coalesce(texto,'')) || to_tsvector('pg_catalog.spanish', coalesce(texto,'')), peso)`.
  - `alter table public.articulos add column busqueda tsvector` y un índice GIN.
  - Trigger `a50_calcular_busqueda` (before ins/upd, siempre): A título; B extracto, el nombre de la categoría y los nombres de las etiquetas (consultados); C `bloques_a_texto(contenido)`.
  - **Borrar una etiqueta** también tiene que recalcular la búsqueda de sus artículos (observaciones de escritor-tests y de arquitecto-db en H3). Lo más simple: en el `before delete on etiquetas`, `with q as (delete from public.articulos_etiquetas where etiqueta_id = old.id returning articulo_id)` y llamar a `recalcular_busqueda` con esos ids. El cascade ya no encuentra filas y el recálculo corre a profundidad 2, así que conserva la versión.
  - **Los recálculos no tienen que mover `actualizado_en` ni `version`** (validación ronda 5): `fijar_actualizado_en` conserva `old.actualizado_en` cuando `pg_trigger_depth() > 1`. Si no, renombrar una etiqueta o desplegar H5 cambiaría el `lastmod` del sitemap y el `dateModified` de muchos artículos. La carga inicial de `busqueda` en la migración tiene que hacerse sin subir `version` ni `actualizado_en` (por ejemplo, desactivando `a30` y `a90` en la sentencia, o con un update a profundidad > 1), para no darle `conflicto_version` a un editor que tenga un artículo abierto durante el despliegue.
  - Verificar que las 2 aserciones de búsqueda de `taxonomias.test.sql`, que se saltean mientras no existe la columna, **dejan de saltearse** y pasan (validación C5-M5).
  - `privado.recalcular_busqueda(articulo_ids uuid[])`, definer: un `update` que dispara `a50`. Cuando lo invoca un trigger (`pg_trigger_depth() > 1`) conserva la versión; desde el seed la incrementa, lo cual es inocuo. Lo invocan solo los triggers `z20_recalcular_articulos` de `categorias` y `etiquetas` (al cambiar `nombre`) y el seed. `asignar_etiquetas` **no** lo usa, porque su update de versión ya recalcula (I3).
  - Verificar que `z90_notificar_cambio` ignore estos updates (solo cambian `busqueda`, `version` y `actualizado_en`).
  - RPC `public.buscar_articulos(consulta text, limite int default 12, desplazamiento int default 0)`, `stable`, invoker. Devuelve `table(id, titulo, slug, extracto, imagen_destacada, publicado_en, categoria_slug, rango real, total bigint)`, con `q := websearch_to_tsquery('public.es_sin_tildes', consulta) || websearch_to_tsquery('pg_catalog.spanish', consulta)`, el filtro `estado = 'publicado' and publicado_en <= now() and busqueda @@ q`, `order by ts_rank_cd(busqueda, q) desc, publicado_en desc`, `limit least(limite, 50) offset greatest(desplazamiento, 0)` y `count(*) over ()`. `grant execute` a `anon, authenticated`.
  - `update public.articulos set titulo = titulo` como `postgres`, para poblar la búsqueda de las filas existentes.
- [ ] T059 [H5] Crear `packages/db/src/consultas/busqueda.ts`, con `buscarArticulos(c, consulta, { pagina, porPagina })`, que mapea a `Pagina<ResumenArticulo>` reutilizando `packages/db/src/paginacion.ts`. Ejecutar `pnpm db:reset && pnpm db:tipos`. Deben pasar T056 y T057.
- [ ] T060 [H5] Agregar a `supabase/tests/privilegios.test.sql`: `buscar_articulos` (anon y authenticated) y que `privado.recalcular_busqueda` no sea ejecutable por clientes.

**Checkpoint**: La búsqueda en español funciona.

---

## Fase 8: Historia 6 - Gestionar el equipo y sus roles (P2)

**Objetivo**: Que solo el admin gestione roles y estados, sin quedarse nunca sin admin, y que los cambios de los autores se notifiquen.

**Prueba independiente**: Con un admin y un editor, verificar qué permite y qué deniega el sistema a cada uno sobre el equipo y el contenido.

### Tests de la Historia 6 (escribir PRIMERO, deben FALLAR) ⚠️

- [ ] T061 [P] [H6] Crear `supabase/tests/equipo.test.sql` (H6-E1 a H6-E7, RF-021 a RF-026). Debe verificar:
  - el admin cambia el rol de un editor a admin y lo desactiva;
  - un editor que intenta cambiar su propio `rol` o `activo`, o el de otro, recibe `sin_permiso`;
  - un editor no puede cambiar `id` ni `creado_en`;
  - degradar o desactivar al único admin activo lanza `ultimo_admin`;
  - con dos admins se puede degradar a uno;
  - un miembro desactivado pierde el acceso de equipo (`es_equipo()` = false; no lee borradores) y sus artículos publicados siguen visibles con su autoría en `autores_publicos`;
  - un editor edita, publica y archiva un artículo de **otro** autor y el `autor_id` no cambia (H6-E6);
  - un editor no puede borrar artículos y un admin sí (H6-E7);
  - no existe política de delete sobre `perfiles` (el delete afecta 0 filas o falla);
  - cambiar el `nombre` de un autor con publicados encola **un** mensaje `tipo = autor` con sus slugs (con secretos de Vault creados en la transacción);
  - cambiar el `nombre` de alguien sin publicados no encola nada.
- [ ] T062 [P] [H6] Crear `packages/db/src/consultas/equipo-perfiles.test.ts`: `cambiarRol` sobre el último admin lanza `ErrorDominio('ultimo_admin')`; `actualizarPerfilPropio` valida `avatar` con `esquemaImagen`.

### Implementación de la Historia 6

- [ ] T063 [H6] Crear `supabase/migrations/20261018120900_equipo.sql`:
  - política `perfiles_update_admin` (update to authenticated, using y check `(select privado.es_admin())`);
  - **`create or replace`** de `privado.proteger_perfil()`: ya existe desde la validación del MVP (A-B1, migración de perfiles), con el trigger `a20_proteger_perfil`, y hoy no deja que ningún cliente cambie rol ni activo. Se amplía para que sí pueda el admin: `if (new.rol, new.activo) is distinct from (old.rol, old.activo) and not privado.es_admin()` lanza `sin_permiso`. **No** crear otro trigger;
  - trigger `z10_garantizar_admin` (after update, definer): `perform pg_advisory_xact_lock(hashtext('perfiles.ultimo_admin'))`; si `not exists (select 1 from public.perfiles where rol = 'admin' and activo)`, lanza `ultimo_admin`;
  - trigger `z90_notificar_cambio_autor` (after update, `when ((old.nombre, old.biografia, old.avatar) is distinct from (new.nombre, new.biografia, new.avatar))`): si hay publicados, llama a `privado.notificar_cambio_publico` con `{tipo:'autor', id, slugs: (hasta 50 slugs publicados)}`.
- [ ] T064 [H6] Crear `packages/db/src/consultas/equipo-perfiles.ts`, con `actualizarPerfilPropio` (valida `avatar` con `esquemaImagen` de `@blog/bloques`), `cambiarRol` y `cambiarActivo`. Reexportar. Ejecutar `pnpm db:reset && pnpm db:tipos`. Deben pasar T061 y T062.

**Checkpoint**: Las 6 historias están completas.

---

## Fase 9: Validación y cierre

- [ ] T065 [P] Crear `supabase/tests/seed.test.sql` (RF-028, CE-007). Debe verificar:
  - 3 perfiles: 1 admin y 2 editores activos;
  - 4 categorías y 10 etiquetas;
  - ≥ 14 artículos: ≥ 9 publicados, 2 programados con fechas futuras, 2 borradores y 1 archivado;
  - los 10 tipos de bloque presentes en los publicados (`jsonb_path_query` sobre `contenido`);
  - toda imagen tiene `ancho` y `alto`.
- [ ] T066 Completar `supabase/seed.sql` con las categorías (Diseño, Desarrollo, Marketing, Negocios), 10 etiquetas y 14 artículos con textos realistas en español, que cubran los 10 tipos de bloque. Las imágenes son placeholders `https://picsum.photos/seed/<slug>/1600/900` con `ancho: 1600, alto: 900` y su alt. Las fechas de publicación son escalonadas en los últimos 90 días (insertadas como `postgres`, que no es cliente). Etiquetado con `insert into articulos_etiquetas` (como `postgres`), seguido de `select privado.recalcular_busqueda(array_agg(id)) from public.articulos;` para incluir las etiquetas en la búsqueda. Al final, agregar `vault.create_secret('http://172.17.0.1:4321','url_web_revalidacion')` y `vault.create_secret('<valor local de .env.example>','secreto_revalidacion')`, de forma idempotente. Debe pasar T065.
- [ ] T067 [P] Crear `packages/db/src/invariantes.test.ts`: `select privado.tipos_bloque()` como `postgres` (vía service role, con un RPC de solo test, o leyendo con `pg` directo desde `DB_URL`) es igual a `TIPOS_BLOQUE` (research D8).
- [ ] T068 [P] Ejecutar `pnpm db:tipos` final y revisar que `packages/db/src/tipos.ts` incluya las vistas y los RPC. Exportar los tipos de dominio (`ArticuloPublico`, `ResumenArticulo`, `Pagina`, `AutorPublico`, `Perfil`, `Categoria`, `Etiqueta`, `EstadoArticulo`) desde `packages/db/src/index.ts`.
- [ ] T069 Ejecutar todo: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm calidad && pnpm build`. Corregir lo que falle.
- [ ] T070 Recorrer [quickstart.md](quickstart.md) del paso 1 al 5 y confirmar cada "Esperado". Actualizar el quickstart si algo cambió.
- [ ] T071 Ejecutar `/validar` y resolver todos los hallazgos BLOQUEANTES de `arquitecto-db` y `consistencia-codigo` (`revisor-ux-ui` no aplica: no hay UI).
- [ ] T072 Actualizar `CLAUDE.md` con la sección "Modelo de datos": un enlace a `specs/001-modelo-de-contenido/data-model.md` y las reglas para nuevas migraciones (prefijos de triggers, `search_path = ''`, grants explícitos).

---

## Dependencias y orden de ejecución

### Entre fases

```
Preparación (F1) → Fundacional (F2) → H1 (F3) → H2 (F4) → H3 (F5) ─┬→ H4 (F6)
                                                                   ├→ H5 (F7)
                                                                   └→ H6 (F8) → Cierre (F9)
```

- **H1** depende de F2.
- **H2** depende de H1 (la tabla `articulos`).
- **H3** depende de H2: la notificación (T041) y la función genérica de redirecciones (T040).
- **H4, H5 y H6** dependen de H3 y son **independientes entre sí**: se pueden hacer en paralelo, con cuidado en dos puntos.
  - H5 (T058) **no** modifica `asignar_etiquetas`: su único update de versión ya recalcula vía `a50` (D22; con `recalcular_busqueda` volvería el doble incremento I3). Hay que mantener en el RPC el orden insert → update.
  - Las tres agregan objetos a `privilegios.test.sql`. Hacer esas tareas (T060, T033…) en secuencia.
- **Cierre** depende de todas las historias.
- Las migraciones tienen timestamps fijos que respetan este orden. Si una historia se adelanta, no cambia su timestamp.

### Dentro de cada historia

Tests (rojo) → migración → `pnpm db:reset && pnpm db:tipos` → módulos de `packages/*` → tests en verde → agregados a `privilegios.test.sql`.

### Oportunidades de paralelismo

- **F1**: T003 a T006 en paralelo, después de T001 y T002.
- **F2**: los tests T007 a T011 en paralelo. T017 y T018 en paralelo con las migraciones.
- **H1**: los tests T020 a T026 en paralelo. T027 y T031 en paralelo con T030.
- **H2**: los tests T034 a T039 en paralelo. T042 en paralelo con T040 y T041.
- **H3**: los tests T045 a T047 en paralelo. T049 y T050 en paralelo, después de T048.
- **H4, H5 y H6**: en paralelo entre sí (ver la nota de dependencias).

### Ejemplo: lanzar los tests de H1 en paralelo (agente escritor-tests)

```text
escritor-tests: T020 imagen.test.ts · T021 esquema.test.ts · T022 validar.test.ts · T023 utilidades.test.ts
escritor-tests: T024 articulos_borrador.test.sql · T025 storage.test.sql · T026 equipo-articulos.test.ts
```

## Estrategia

- **MVP**: F1, F2 y H1 dan un modelo de borradores con bloques validados. Ahí se valida con `/validar` antes de seguir.
- **Incremental**: H2 permite publicar (ya sirve para la spec del sitio público), H3 suma la navegación (con ella se cierran las P1) y H4, H5 y H6 suman valor sin romper lo anterior.
- **Spec del sitio público**: puede arrancar después de H3.

## Notas

- Commit por tarea o grupo lógico, en Conventional Commits en español, por ejemplo `feat(db): agrega máquina de estados de artículos`.
- No editar migraciones ya aplicadas en otra rama o en el remoto. Mientras esta spec no se mergee, se pueden ajustar y volver a correr `pnpm db:reset`.
- Antes de crear un archivo, buscar si ya existe algo reutilizable (§VIII). En especial: `paginacion.ts`, `esquemaImagen` y la función genérica de redirecciones.
