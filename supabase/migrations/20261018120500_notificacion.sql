-- Notificación de cambios públicos a la web (pg_net + Vault, firma HMAC).
-- Spec 001 H2 · research D14 · contracts/revalidacion.md.
-- net.http_request_queue es legible por PUBLIC y no se puede revocar, así que el
-- secreto nunca viaja: se envían la marca de tiempo y la firma HMAC-SHA256.

create function privado.notificar_cambio_publico(cuerpo jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secreto text;
  marca text;
  cuerpo_final jsonb;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'url_web_revalidacion';
  select decrypted_secret into secreto from vault.decrypted_secrets where name = 'secreto_revalidacion';
  if url is null or secreto is null then
    return;
  end if;

  marca := extract(epoch from now())::bigint::text;
  cuerpo_final := cuerpo || jsonb_build_object('ocurrido_en', now());
  perform net.http_post(
    url || '/api/revalidar',
    cuerpo_final,
    headers => jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Blog-Marca-Tiempo', marca,
      'X-Blog-Firma', 'sha256=' || encode(extensions.hmac(marca || '.' || cuerpo_final::text, secreto, 'sha256'), 'hex')
    )
  );
-- Nunca hace fallar la transacción de origen (una URL malformada lanza error).
exception when others then
  raise warning 'notificar_cambio_publico: %', sqlerrm;
end
$$;

-- [actual] o [actual, anterior] si cambió (contrato: slugs).
create function privado.slugs_afectados(actual text, anterior text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when actual is null then jsonb_build_array(anterior)
    when anterior is null or anterior = actual then jsonb_build_array(actual)
    else jsonb_build_array(actual, anterior)
  end
$$;

-- ---------------------------------------------------------------------------
-- Artículos
-- ---------------------------------------------------------------------------

-- Mensaje único para cambios y borrados (validación C3-M2): H3 agrega acá las
-- etiquetas una sola vez.
create function privado.mensaje_articulo(id uuid, slugs jsonb, categoria_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'tipo', 'articulo',
    'id', id,
    'slugs', slugs,
    'categorias', (
      select coalesce(jsonb_agg(distinct c.slug), '[]'::jsonb)
      from public.categorias c
      where c.id = any (categoria_ids)
    ),
    -- articulos_etiquetas llega en H3 (T048 completa este campo).
    'etiquetas', '[]'::jsonb
  )
$$;

create function privado.notificar_cambio_articulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes_publico boolean := tg_op = 'UPDATE' and privado.es_publico(old.estado, old.publicado_en);
  ahora_publico boolean := privado.es_publico(new.estado, new.publicado_en);
begin
  if not (antes_publico or ahora_publico) then
    return null;
  end if;
  -- Los cambios derivados (búsqueda, versión, fecha de actualización) no notifican.
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - '{busqueda,version,actualizado_en}'::text[])
       = (to_jsonb(old) - '{busqueda,version,actualizado_en}'::text[]) then
    return null;
  end if;

  perform privado.notificar_cambio_publico(privado.mensaje_articulo(
    new.id,
    privado.slugs_afectados(new.slug, case when tg_op = 'UPDATE' then old.slug end),
    array[new.categoria_id, case when tg_op = 'UPDATE' then old.categoria_id end]
  ));
  return null;
end
$$;

-- Before delete: así el mensaje se arma antes del cascade (en H3, con etiquetas).
create function privado.notificar_borrado_articulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if privado.es_publico(old.estado, old.publicado_en) then
    perform privado.notificar_cambio_publico(
      privado.mensaje_articulo(old.id, privado.slugs_afectados(null, old.slug), array[old.categoria_id])
    );
  end if;
  return old;
end
$$;

create trigger z90_notificar_cambio
  after insert or update on public.articulos
  for each row execute function privado.notificar_cambio_articulo();
create trigger n10_notificar_borrado
  before delete on public.articulos
  for each row execute function privado.notificar_borrado_articulo();

-- ---------------------------------------------------------------------------
-- Categorías y etiquetas (siempre públicas). tg_argv[0] es el tipo.
-- ---------------------------------------------------------------------------
create function privado.notificar_cambio_taxonomia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - '{actualizado_en}'::text[]) = (to_jsonb(old) - '{actualizado_en}'::text[]) then
    return null;
  end if;
  perform privado.notificar_cambio_publico(jsonb_build_object(
    'tipo', tg_argv[0],
    'id', case when tg_op = 'DELETE' then old.id else new.id end,
    'slugs', privado.slugs_afectados(
      case when tg_op <> 'DELETE' then new.slug end,
      case when tg_op <> 'INSERT' then old.slug end
    )
  ));
  return null;
end
$$;

create trigger z90_notificar_cambio
  after insert or update or delete on public.categorias
  for each row execute function privado.notificar_cambio_taxonomia('categoria');
create trigger z90_notificar_cambio
  after insert or update or delete on public.etiquetas
  for each row execute function privado.notificar_cambio_taxonomia('etiqueta');
