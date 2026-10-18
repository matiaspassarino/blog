-- Estados y publicación: máquina de estados, redirecciones de artículos y autores públicos.
-- Spec 001 H2 · research D5, D6, D11, D24 · data-model "Máquina de estados", "autores_publicos".

-- ---------------------------------------------------------------------------
-- Checks de estado (RF-010)
-- ---------------------------------------------------------------------------
alter table public.articulos
  add constraint articulos_requisitos_publicacion check (
    estado not in ('programado', 'publicado')
    or (categoria_id is not null and jsonb_typeof(contenido) = 'array' and jsonb_array_length(contenido) > 0)
  ),
  add constraint articulos_programado_con_fecha check (estado <> 'programado' or programado_para is not null),
  add constraint articulos_publicado_con_fecha check (estado <> 'publicado' or publicado_en is not null);

-- Predicado de "visible para el público" para el código definer (notificaciones).
-- Las políticas RLS y la vista lo repiten inline: ahí las funciones se verifican
-- con el rol del cliente.
create function privado.es_publico(estado public.estado_articulo, publicado_en timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select estado = 'publicado' and publicado_en <= now()
$$;

-- ---------------------------------------------------------------------------
-- Campos del sistema: desde H2 el estado lo controla a40, así que se quita el
-- congelamiento temporal de estado y programado_para (validación A-M2).
-- ---------------------------------------------------------------------------
create or replace function privado.campos_sistema_articulo()
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
    new.programado_para := null;
    new.creado_en := now();
    new.actualizado_en := now();
  else
    new.autor_id := old.autor_id;
    new.creado_en := old.creado_en;
    new.publicado_en := old.publicado_en;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Máquina de estados (RF-009 a RF-011, research D6)
-- ---------------------------------------------------------------------------
create function privado.validar_estado_articulo()
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
    if jsonb_typeof(new.contenido) is distinct from 'array' or jsonb_array_length(new.contenido) = 0 then
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

create trigger a40_validar_estado
  before insert or update on public.articulos
  for each row execute function privado.validar_estado_articulo();

-- ---------------------------------------------------------------------------
-- Redirecciones por cambio de slug (RF-012, research D11). Genérica: tg_argv[0]
-- es el tipo de entidad; los artículos solo registran si alguna vez fueron
-- públicos. Las taxonomías la usan desde H3.
-- ---------------------------------------------------------------------------
create function privado.registrar_redireccion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tipo public.tipo_entidad := tg_argv[0]::public.tipo_entidad;
begin
  if new.slug is distinct from old.slug
     and (tipo <> 'articulo' or old.publicado_en is not null) then
    insert into public.redirecciones (tipo_entidad, slug_anterior, entidad_id)
    values (tipo, old.slug, new.id)
    on conflict (tipo_entidad, slug_anterior)
      do update set entidad_id = excluded.entidad_id, creado_en = now();
    -- Volver a un slug anterior: deja de ser redirección (sin cadenas).
    delete from public.redirecciones where tipo_entidad = tipo and slug_anterior = new.slug;
  end if;
  return null;
end
$$;

create function privado.borrar_redirecciones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.redirecciones
  where tipo_entidad = tg_argv[0]::public.tipo_entidad and entidad_id = old.id;
  return null;
end
$$;

create trigger z10_registrar_redireccion
  after update on public.articulos
  for each row execute function privado.registrar_redireccion('articulo');
create trigger z20_borrar_redirecciones
  after delete on public.articulos
  for each row execute function privado.borrar_redirecciones('articulo');

-- Las redirecciones de artículos solo se ven si el artículo es visible para
-- quien consulta (D24): el exists hereda la RLS de articulos.
drop policy redirecciones_select on public.redirecciones;
create policy redirecciones_select on public.redirecciones
  for select to anon, authenticated
  using (tipo_entidad <> 'articulo' or exists (select 1 from public.articulos a where a.id = entidad_id));

-- Invoker: los subselects pasan por la RLS de cada entidad.
create function public.resolver_redireccion(tipo public.tipo_entidad, slug text)
returns text
language sql
stable
set search_path = ''
as $$
  select case r.tipo_entidad
    when 'articulo' then (select a.slug from public.articulos a where a.id = r.entidad_id)
    when 'categoria' then (select c.slug from public.categorias c where c.id = r.entidad_id)
    when 'etiqueta' then (select e.slug from public.etiquetas e where e.id = r.entidad_id)
  end
  from public.redirecciones r
  where r.tipo_entidad = resolver_redireccion.tipo and r.slug_anterior = resolver_redireccion.slug
$$;

revoke execute on function public.resolver_redireccion(public.tipo_entidad, text) from public, anon, authenticated;
grant execute on function public.resolver_redireccion(public.tipo_entidad, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Autores públicos (RF-026, research D5). No es security_invoker: expone solo
-- columnas públicas sin dar a anon acceso a perfiles. revoke all evita que la
-- vista auto-actualizable permita escribir perfiles (B1).
-- ---------------------------------------------------------------------------
create view public.autores_publicos with (security_invoker = false, security_barrier = true) as
select p.id, p.nombre, p.biografia, p.avatar
from public.perfiles p
where exists (
  select 1 from public.articulos a
  -- Predicado inline: las funciones de una vista se verifican con el rol de quien
  -- consulta, y es_publico no es ejecutable por clientes.
  where a.autor_id = p.id and a.estado = 'publicado' and a.publicado_en <= now()
);

revoke all on public.autores_publicos from public, anon, authenticated;
grant select on public.autores_publicos to anon, authenticated;
