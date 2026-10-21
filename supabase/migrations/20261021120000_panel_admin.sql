-- Panel de administración: bucket sin GIF, índice de la lista y funciones de lectura del panel.
-- Spec 003 · research D9, D11, D14 · data-model "Migración". Sin tablas nuevas ni cambios de RLS.
-- Revisada por arquitecto-db (data-model, "Revisión de arquitecto-db"). Las dos funciones definer
-- (listar_equipo, rutas_en_uso) no contienen la palabra de ejecución dinámica ni llamadas a net.http
-- en su cuerpo, ni siquiera en comentarios: privilegios.test.sql lo busca en el texto.

-- ---------------------------------------------------------------------------
-- 1. Bucket medios sin GIF (RF-007): solo JPEG, PNG, WebP y AVIF, hasta 5 MB.
-- ---------------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'medios';

-- ---------------------------------------------------------------------------
-- 2. Índice del orden de la lista del panel (constitución §V.8).
-- ---------------------------------------------------------------------------
create index articulos_actualizado_idx on public.articulos (actualizado_en desc, id);

-- ---------------------------------------------------------------------------
-- 3. privado.sin_tildes: minúsculas y sin tildes. Inmutable como privado.slugificar, para poder
--    usarla en filtros e índices. La necesita listar_articulos_panel, que es invoker.
-- ---------------------------------------------------------------------------
create function privado.sin_tildes(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')))
$$;

revoke execute on function privado.sin_tildes(text) from public, anon, authenticated;
grant execute on function privado.sin_tildes(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lista del panel (Historia 4, RF-016). SQL puro e invoker: respeta RLS y no tiene el choque de
--    nombres entre columnas de salida y de tablas que sí tendría un cuerpo plpgsql.
--    El texto se escapa (barra, porcentaje y guion bajo, en ese orden) para que no actúe como comodín.
--    El filtro por título recorre la tabla: excepción registrada a §V.8 en plan.md.
-- ---------------------------------------------------------------------------
create function public.listar_articulos_panel(
  p_estado public.estado_articulo default null,
  p_categoria_id uuid default null,
  p_autor_id uuid default null,
  p_texto text default null,
  p_limite integer default 20,
  p_desplazamiento integer default 0
)
returns table (
  id uuid,
  titulo text,
  slug text,
  estado public.estado_articulo,
  categoria_id uuid,
  categoria_nombre text,
  autor_id uuid,
  autor_nombre text,
  programado_para timestamptz,
  publicado_en timestamptz,
  actualizado_en timestamptz,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  select
    a.id, a.titulo, a.slug, a.estado,
    a.categoria_id, c.nombre,
    a.autor_id, p.nombre,
    a.programado_para, a.publicado_en, a.actualizado_en,
    count(*) over ()
  from public.articulos a
  left join public.categorias c on c.id = a.categoria_id
  left join public.perfiles p on p.id = a.autor_id
  where (p_estado is null or a.estado = p_estado)
    and (p_categoria_id is null or a.categoria_id = p_categoria_id)
    and (p_autor_id is null or a.autor_id = p_autor_id)
    and (
      nullif(btrim(p_texto), '') is null
      or privado.sin_tildes(a.titulo) like
        '%' || replace(replace(replace(privado.sin_tildes(btrim(p_texto)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        escape '\'
    )
  order by a.actualizado_en desc, a.id
  limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_desplazamiento, 0), 0)
$$;

revoke execute on function public.listar_articulos_panel(public.estado_articulo, uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.listar_articulos_panel(public.estado_articulo, uuid, uuid, text, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Equipo con correo y estado de acceso (Historia 6, RF-020). Solo el admin. El correo sale de
--    auth.users y es el único dato de esa tabla que se expone. "invitado" es un miembro activo que
--    todavía no confirmó su correo (no definió su contraseña).
-- ---------------------------------------------------------------------------
create function public.listar_equipo()
returns table (
  id uuid,
  nombre text,
  correo text,
  rol public.rol_miembro,
  activo boolean,
  acceso text,
  creado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not privado.es_admin() then
    raise exception using errcode = 'P0001', message = 'sin_permiso';
  end if;

  return query
  select
    p.id, p.nombre, u.email::text, p.rol, p.activo,
    case
      when not p.activo then 'desactivado'
      when u.email_confirmed_at is null then 'invitado'
      else 'activo'
    end,
    p.creado_en
  from public.perfiles p
  join auth.users u on u.id = p.id
  order by p.nombre, p.id;
end
$$;

revoke execute on function public.listar_equipo() from public, anon, authenticated;
grant execute on function public.listar_equipo() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Qué rutas de imagen siguen en uso (D11). Las rutas son relativas al bucket, como Imagen.ruta.
--    Se busca la forma escapada de jsonb (comillas incluidas), así un nombre con comillas o barra
--    invertida se encuentra y "a.jpg" no coincide con "a.jpg.bak". Definer porque el borrado debe
--    considerar todo el contenido; el chequeo de equipo evita que lo use un anónimo.
-- ---------------------------------------------------------------------------
create function public.rutas_en_uso(p_rutas text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not privado.es_equipo() then
    raise exception using errcode = 'P0001', message = 'sin_permiso';
  end if;

  if p_rutas is null or cardinality(p_rutas) = 0 then
    return '{}'::text[];
  end if;

  return coalesce(
    (
      select array_agg(r.ruta order by r.ruta)
      from (select distinct u.ruta from unnest(p_rutas) as u(ruta) where u.ruta is not null) r
      where exists (
          select 1 from public.articulos a
          where position(to_jsonb(r.ruta)::text in a.contenido::text) > 0
             or position(to_jsonb(r.ruta)::text in coalesce(a.imagen_destacada::text, '')) > 0
        )
        or exists (
          select 1 from public.perfiles p
          where position(to_jsonb(r.ruta)::text in coalesce(p.avatar::text, '')) > 0
        )
    ),
    '{}'::text[]
  );
end
$$;

revoke execute on function public.rutas_en_uso(text[]) from public, anon, authenticated;
grant execute on function public.rutas_en_uso(text[]) to authenticated;
