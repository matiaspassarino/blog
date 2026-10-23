-- El documento como contenido: articulos.contenido pasa de la lista de bloques al documento JSON del editor.
-- Spec 005 · H5 · RF-022 a RF-025, RF-030 · data-model "Migración 20261023120000_contenido_documento.sql" · research
-- D22, D24, D25 y D31. Primero los create y create or replace; los drop al final (los cuerpos SQL y PL/pgSQL no
-- registran dependencias). No convierte los artículos: eso lo hace la conversión del corte (RF-030).

-- ---------------------------------------------------------------------------
-- 1. Tipos de primer nivel. Debe coincidir con TIPOS_ELEMENTO de @blog/bloques (invariantes.test.ts); `table`
--    llega al esquema de TypeScript en la Fase 13, pero la base ya la admite.
-- ---------------------------------------------------------------------------
create function privado.tipos_elemento()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule', 'table',
    'imagen', 'galeria', 'cta', 'video'
  ]
$$;

-- ---------------------------------------------------------------------------
-- 2. Forma mínima del documento (§VI.4): el detalle lo valida el servidor con esquemaDocumento.
--    coalesce: un check que evalúa a NULL se considera cumplido. El `case` evita recorrer lo que no es un arreglo
--    (el formato anterior o algo que no es un objeto da false sin error).
-- ---------------------------------------------------------------------------
create or replace function privado.contenido_valido(contenido jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(contenido) = 'object'
      and contenido ->> 'type' = 'doc'
      and jsonb_typeof(contenido -> 'content') = 'array'
      and jsonb_array_length(
        case when jsonb_typeof(contenido -> 'content') = 'array' then contenido -> 'content' else '[]' end
      ) <= 200
      and not exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(contenido -> 'content') = 'array' then contenido -> 'content' else '[]' end
        ) as e(elemento)
        where jsonb_typeof(e.elemento) is distinct from 'object'
           or jsonb_typeof(e.elemento -> 'attrs' -> 'id') is distinct from 'string'
           or not coalesce((e.elemento ->> 'type') = any (privado.tipos_elemento()), false)
      ),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Requisito de contenido para publicar: algún elemento que no sea un párrafo sin texto ni una tabla sin texto
--    en ninguna celda. Nunca NULL; false sin error con el formato anterior.
-- ---------------------------------------------------------------------------
create function privado.documento_tiene_contenido(contenido jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_typeof(contenido -> 'content') = 'array' then contenido -> 'content' else '[]' end
      ) as e(elemento)
      where jsonb_typeof(e.elemento) = 'object'
        and (
          coalesce(e.elemento ->> 'type' not in ('paragraph', 'table'), false)
          or jsonb_path_exists(
            e.elemento, 'strict $.** ? (@.type == "text" && @.text.type() == "string" && @.text != "")'
          )
        )
    ),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Texto indexable en orden de lectura: los textos de cada párrafo o título (también los de listas, citas y
--    celdas) unidos sin espacio, con el salto de línea como espacio, y los campos de texto de cada elemento (autor,
--    alt, leyenda, título y texto de la llamada a la acción, título del video, descripción de la tabla). Sin el
--    código ni las URL. Truncado para no superar el límite de 1 MB del tsvector; un arreglo da ''.
-- ---------------------------------------------------------------------------
create function privado.documento_a_texto(contenido jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(coalesce(string_agg(t.texto, ' ' order by e.n, t.m nulls last), ''), 200000)
  from jsonb_array_elements(
      case when jsonb_typeof(contenido -> 'content') = 'array' then contenido -> 'content' else '[]' end
    ) with ordinality as e(elemento, n),
    lateral (
      select p.m, (
          select string_agg(
            case when i.nodo ->> 'type' = 'hardBreak' then ' ' else i.nodo ->> 'text' end, '' order by i.k
          )
          from jsonb_array_elements(
            case when jsonb_typeof(p.nodo -> 'content') = 'array' then p.nodo -> 'content' else '[]' end
          ) with ordinality as i(nodo, k)
        ) as texto
      from jsonb_path_query(e.elemento, 'strict $.** ? (@.type == "paragraph" || @.type == "heading")')
        with ordinality as p(nodo, m)
      where e.elemento ->> 'type' is distinct from 'codeBlock'
      union all
      select null, nullif(concat_ws(' ',
        e.elemento -> 'attrs' ->> 'autor',
        e.elemento -> 'attrs' -> 'imagen' ->> 'alt',
        e.elemento -> 'attrs' ->> 'leyenda',
        (select string_agg(imagen ->> 'alt', ' ')
           from jsonb_array_elements(
             case when jsonb_typeof(e.elemento -> 'attrs' -> 'imagenes') = 'array'
               then e.elemento -> 'attrs' -> 'imagenes' else '[]' end
           ) as imagen),
        e.elemento -> 'attrs' ->> 'titulo',
        e.elemento -> 'attrs' ->> 'texto',
        e.elemento -> 'attrs' ->> 'descripcion'), '')
    ) as t(m, texto)
$$;

-- ---------------------------------------------------------------------------
-- 5. a50_calcular_busqueda con el texto del documento.
-- ---------------------------------------------------------------------------
create or replace function privado.calcular_busqueda()
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
    || privado.documento_busqueda(privado.documento_a_texto(new.contenido), 'C');
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. a40_validar_estado: el cuerpo de estados_y_publicacion.sql con el requisito de contenido del documento.
-- ---------------------------------------------------------------------------
create or replace function privado.validar_estado_articulo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Insert: el cliente ya viene forzado a borrador (a20); el sistema y el seed
  -- pueden cargar cualquier estado. Update: la matriz aplica a todos los roles.
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado
     and (old.estado, new.estado) not in (
       ('borrador'::public.estado_articulo, 'programado'::public.estado_articulo),
       ('borrador', 'publicado'),
       ('programado', 'borrador'),
       ('programado', 'publicado'),
       ('publicado', 'archivado'),
       ('publicado', 'borrador'),
       ('archivado', 'borrador')
     ) then
    raise exception using errcode = 'P0001', message = 'estado_invalido',
      detail = format('%s -> %s', old.estado, new.estado);
  end if;

  if new.estado in ('programado', 'publicado') then
    if new.categoria_id is null then
      raise exception using errcode = 'P0001', message = 'requisitos_publicacion', detail = 'categoria';
    end if;
    if not privado.documento_tiene_contenido(new.contenido) then
      raise exception using errcode = 'P0001', message = 'requisitos_publicacion', detail = 'contenido';
    end if;
  end if;

  -- La fecha futura solo se exige al cliente, al programar o al reprogramar.
  if new.estado = 'programado' and privado.es_cliente()
     and (tg_op = 'INSERT' or old.estado <> 'programado' or new.programado_para is distinct from old.programado_para)
     and (new.programado_para is null or new.programado_para <= now()) then
    raise exception using errcode = 'P0001', message = 'fecha_no_futura';
  end if;

  -- publicado_en se asigna solo en la primera publicación: nunca pisa un valor
  -- existente (republicación o seed). El cron publica a la hora prevista.
  if new.estado = 'publicado' and new.publicado_en is null then
    new.publicado_en := case
      when privado.es_cliente() then now()
      else coalesce(new.programado_para, now())
    end;
  end if;

  if new.estado <> 'programado' then
    new.programado_para := null;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 7 y 8. Los checks de la tabla, recreados con el mismo nombre (el mapeo de errores.ts no cambia) y `not valid`:
--    un check immutable recién agregado no queda marcado como válido con filas que no lo cumplen.
-- ---------------------------------------------------------------------------
alter table public.articulos
  drop constraint articulos_contenido_check,
  drop constraint articulos_requisitos_publicacion;
alter table public.articulos
  add constraint articulos_contenido_check check (privado.contenido_valido(contenido)) not valid,
  add constraint articulos_requisitos_publicacion check (
    estado not in ('programado', 'publicado')
    or (categoria_id is not null and privado.documento_tiene_contenido(contenido))
  ) not valid;

-- ---------------------------------------------------------------------------
-- 9. Validación condicional: sin artículos en el formato anterior (local, con la tabla vacía) se validan acá; en la
--    nube los valida la conversión, que corre en la misma ejecución (RF-030).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.articulos where jsonb_typeof(contenido) = 'array') then
    alter table public.articulos validate constraint articulos_contenido_check;
    alter table public.articulos validate constraint articulos_requisitos_publicacion;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 10. Default: el documento vacío.
-- ---------------------------------------------------------------------------
alter table public.articulos alter column contenido set default '{"type":"doc","content":[]}';

-- ---------------------------------------------------------------------------
-- Privilegios (research D20 de la 001): el check y a40 se evalúan con el rol de quien guarda. contenido_valido
-- conserva los suyos (create or replace). documento_a_texto solo la llama calcular_busqueda (security definer).
-- ---------------------------------------------------------------------------
revoke all on function privado.tipos_elemento() from public, anon, authenticated;
revoke all on function privado.documento_tiene_contenido(jsonb) from public, anon, authenticated;
revoke all on function privado.documento_a_texto(jsonb) from public, anon, authenticated;
grant execute on function privado.tipos_elemento(), privado.documento_tiene_contenido(jsonb)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Lo del formato anterior, con todo lo anterior ya reemplazado.
-- ---------------------------------------------------------------------------
drop function privado.tipos_bloque();
drop function privado.bloques_a_texto(jsonb);
