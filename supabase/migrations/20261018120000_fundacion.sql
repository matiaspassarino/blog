-- Fundación: privilegios, extensiones, esquema privado, tipos y utilidades.
-- Spec 001 · research D8, D10, D14, D20 · data-model "Privilegios (D20)".

-- ---------------------------------------------------------------------------
-- 1. Privilegios por defecto (D20): nada se concede implícitamente a los clientes
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
-- Los default privileges por esquema no quitan el EXECUTE implícito de PUBLIC:
-- hace falta la versión global.
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 2. Extensiones
-- pg_net: los grants de net.* los otorga supabase_admin y postgres no puede
-- revocarlos. Riesgo aceptado y mitigado (D14): net no se expone por la API y
-- ninguna función invocable por clientes llama a net.http_* (privilegios.test.sql).
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 3. Esquema privado (no expuesto por la API)
-- ---------------------------------------------------------------------------
create schema privado;
revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tipos
-- ---------------------------------------------------------------------------
create type public.rol_miembro as enum ('admin', 'editor');
create type public.estado_articulo as enum ('borrador', 'programado', 'publicado', 'archivado');
create type public.tipo_entidad as enum ('articulo', 'categoria', 'etiqueta');

-- ---------------------------------------------------------------------------
-- 5. Utilidades
-- ---------------------------------------------------------------------------

-- Petición de la API (anon o authenticated). SECURITY DEFINER no cambia el GUC
-- role, así que sigue siendo correcto dentro de funciones definer. El seed y el
-- cron corren como postgres y no son clientes.
create function privado.es_cliente()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), '') in ('anon', 'authenticated')
$$;

-- Fuente única de la normalización de slugs (D10).
create function privado.slugificar(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, ''))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
$$;

-- Debe coincidir con TIPOS_BLOQUE de @blog/bloques (invariantes.test.ts).
create function privado.tipos_bloque()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['parrafo', 'titulo', 'imagen', 'cita', 'lista', 'galeria', 'cta', 'separador', 'codigo', 'video']
$$;

-- Check liviano: las reglas completas viven en esquemaImagen (@blog/bloques).
-- coalesce: un check que evalúa a NULL se considera cumplido, así que una clave
-- ausente tiene que dar false.
create function privado.imagen_valida(imagen jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(imagen) = 'object'
      and jsonb_typeof(imagen -> 'ruta') = 'string'
      and btrim(imagen ->> 'ruta') <> ''
      and jsonb_typeof(imagen -> 'ancho') = 'number' and (imagen ->> 'ancho')::numeric > 0
      and jsonb_typeof(imagen -> 'alto') = 'number' and (imagen ->> 'alto')::numeric > 0
      and (
        (jsonb_typeof(imagen -> 'alt') = 'string' and btrim(imagen ->> 'alt') <> '')
        or (imagen -> 'decorativa') = 'true'::jsonb
      ),
    false
  )
$$;

-- Defensa en la base (D8): arreglo de ≤ 200 objetos con id y tipo conocido.
create function privado.contenido_valido(contenido jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(contenido) = 'array'
      and jsonb_array_length(contenido) <= 200
      and not exists (
        select 1
        from jsonb_array_elements(contenido) as b(bloque)
        where jsonb_typeof(b.bloque) is distinct from 'object'
           or jsonb_typeof(b.bloque -> 'id') is distinct from 'string'
           or jsonb_typeof(b.bloque -> 'tipo') is distinct from 'string'
           or not coalesce((b.bloque ->> 'tipo') = any (privado.tipos_bloque()), false)
      ),
    false
  )
$$;

create function privado.fijar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

-- Fuente única del slug libre (D10, validación C-B3): normaliza el texto y le
-- agrega el primer sufijo -2, -3… que no esté ocupado en la tabla de la entidad.
-- `excluir` es la fila propia (al actualizar). Case estático, sin SQL dinámico.
-- Las tablas se resuelven al ejecutar, así que puede declararse antes que ellas.
create function privado.slug_disponible(tipo public.tipo_entidad, texto text, excluir uuid default null)
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
    end;
    exit when not ocupado;
    sufijo := sufijo + 1;
    candidato := base || '-' || sufijo;
  end loop;
  return candidato;
end
$$;

-- Trigger genérico de slug. tg_argv[0] es la columna de origen (titulo o nombre).
-- Definer: corre como el rol del cliente, que no tiene execute sobre las
-- funciones de privado.
create function privado.asignar_slug()
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
  end;
  if tipo is null then
    raise exception 'asignar_slug: tabla no soportada %', tg_table_name;
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
-- 6. Privilegios de funciones
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function
  privado.es_cliente(),
  privado.tipos_bloque(),
  privado.contenido_valido(jsonb),
  privado.imagen_valida(jsonb)
  to anon, authenticated;
