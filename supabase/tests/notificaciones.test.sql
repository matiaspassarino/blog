-- T037: notificación de cambios públicos (RF-013, research D14, contracts/revalidacion.md).
-- privado.notificar_cambio_publico, triggers z90_notificar_cambio (articulos,
-- categorias, etiquetas) y n10_notificar_borrado (articulos).
-- Los secretos de Vault se crean dentro de la transacción (se deshacen con el
-- rollback) y se cuentan las filas nuevas de net.http_request_queue: las filas
-- sin confirmar no las ve el worker de pg_net, así que no se envía nada.
-- En H2 `etiquetas` viaja vacío (T041); T045 verifica las etiquetas reales.
-- No depende del seed: usuarios @prueba.local y slugs propios (prefijo h2-not-).
begin;
\ir helpers/pruebas.psql
select plan(37);

-- Sin secretos de revalidación al empezar, aunque el entorno los tenga configurados.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('h2-not-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Hache Dos Not Editor"}');
select pruebas.crear_usuario('h2-not-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Hache Dos Not Admin"}');

delete from public.articulos where slug like 'h2-not-%';
delete from public.categorias where slug like 'h2-not-%' or lower(nombre) in (lower('H2 Not Categoría'), lower('H2 Not Nueva'), lower('H2 Not Categoría B'));
delete from public.etiquetas where slug like 'h2-not-%' or lower(nombre) = lower('H2 Not Etiqueta');
insert into public.categorias (nombre, slug) values ('H2 Not Categoría', 'h2-not-categoria');

-- Artículos de partida, cargados por el sistema (sin secretos: no notifican).
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
select x.id::uuid, 'H2 notificación ' || x.sufijo, 'h2-not-' || x.sufijo,
       '[{"id": "b2300000-0000-4000-8000-000000000001", "tipo": "parrafo", "texto": "Texto."}]',
       (select id from public.categorias where slug = 'h2-not-categoria'),
       (select id from auth.users where email = 'h2-not-editor@prueba.local'),
       x.estado::public.estado_articulo, x.publicado_en, x.programado_para
from (values
  ('a2300000-0000-4000-8000-000000000001', 'sin-secretos', 'borrador', null::timestamptz, null::timestamptz),
  ('a2300000-0000-4000-8000-000000000002', 'url-invalida', 'borrador', null, null),
  ('a2300000-0000-4000-8000-000000000003', 'para-publicar', 'borrador', null, null),
  ('a2300000-0000-4000-8000-000000000004', 'publicado', 'publicado', now() - interval '1 day', null),
  ('a2300000-0000-4000-8000-000000000005', 'para-despublicar', 'publicado', now() - interval '1 day', null),
  ('a2300000-0000-4000-8000-000000000006', 'para-borrar', 'publicado', now() - interval '1 day', null),
  ('a2300000-0000-4000-8000-000000000007', 'borrador', 'borrador', null, null),
  ('a2300000-0000-4000-8000-000000000008', 'programado', 'programado', null, now() + interval '1 day')
) as x(id, sufijo, estado, publicado_en, programado_para);

-- Marca de la cola: solo cuentan las filas posteriores a la última marca.
create temporary table marca_cola (id bigint) on commit drop;
insert into marca_cola values (0);

create function pruebas.marcar_cola() returns void
language sql as $$
  update marca_cola set id = coalesce((select max(q.id) from net.http_request_queue q), 0)
$$;
create function pruebas.cola_nueva()
returns table (metodo text, url text, autorizacion text, tipo_contenido text, cuerpo jsonb,
               marca text, firma text, cuerpo_texto text)
language sql as $$
  select q.method::text, q.url, q.headers ->> 'Authorization', q.headers ->> 'Content-Type',
         convert_from(q.body, 'UTF8')::jsonb,
         q.headers ->> 'X-Blog-Marca-Tiempo', q.headers ->> 'X-Blog-Firma', convert_from(q.body, 'UTF8')
  from net.http_request_queue q
  where q.id > (select m.id from marca_cola m) and q.url like 'http://prueba.local%'
  order by q.id
$$;

-- Cambio de estado o de columnas como el rol en curso, con la versión actual.
create function pruebas.editar(articulo uuid, cambios jsonb) returns void
language plpgsql as $$
begin
  update public.articulos
     set estado = coalesce((cambios ->> 'estado')::public.estado_articulo, estado),
         titulo = coalesce(cambios ->> 'titulo', titulo),
         slug = coalesce(cambios ->> 'slug', slug),
         categoria_id = coalesce((cambios ->> 'categoria_id')::uuid, categoria_id),
         version = (select a.version from public.articulos a where a.id = articulo)
   where id = articulo;
end
$$;
grant execute on function pruebas.editar(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Sin secretos en Vault no se encola nada y la transacción no falla
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select lives_ok($$select pruebas.editar('a2300000-0000-4000-8000-000000000001', '{"estado": "publicado"}')$$,
  'D14: sin secretos en Vault, publicar no falla');
select pruebas.como_postgres();
select is((select estado::text from public.articulos where id = 'a2300000-0000-4000-8000-000000000001'),
  'publicado', 'D14: sin secretos, el artículo igual se publica');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'D14: sin secretos en Vault no se encola ningún mensaje');

-- Si el envío falla (URL inválida en Vault), la transacción de origen tampoco falla.
select vault.create_secret('no es una url', 'url_web_revalidacion');
select vault.create_secret('secreto-de-prueba-hmac', 'secreto_revalidacion');
select pruebas.marcar_cola();
set local client_min_messages = error; -- el warning del envío fallido es esperado
select pruebas.como('h2-not-editor@prueba.local');
select lives_ok($$select pruebas.editar('a2300000-0000-4000-8000-000000000002', '{"estado": "publicado"}')$$,
  'D14: si net.http_post falla, la publicación no falla (exception when others)');
select pruebas.como_postgres();
set local client_min_messages = notice;
select is((select estado::text from public.articulos where id = 'a2300000-0000-4000-8000-000000000002'),
  'publicado', 'D14: con un envío fallido, el artículo igual se publica');

-- Secretos válidos para el resto del test.
delete from vault.secrets where name = 'url_web_revalidacion';
select vault.create_secret('http://prueba.local', 'url_web_revalidacion');

-- ---------------------------------------------------------------------------
-- Se encola: publicar
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000003', '{"estado": "publicado"}');
select pruebas.como_postgres();
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: publicar un artículo encola exactamente un mensaje');
select results_eq(
  $$select metodo, url, autorizacion is null, tipo_contenido, marca ~ '^[0-9]+$' from pruebas.cola_nueva()$$,
  $$values ('POST'::text, 'http://prueba.local/api/revalidar'::text, true, 'application/json'::text, true)$$,
  'contrato: POST a {url}/api/revalidar, JSON, con X-Blog-Marca-Tiempo y sin Authorization (el secreto no viaja)'
);
select is(
  (select firma = 'sha256=' || encode(extensions.hmac(marca || '.' || cuerpo_texto, 'secreto-de-prueba-hmac', 'sha256'), 'hex')
     from pruebas.cola_nueva()),
  true,
  'contrato: X-Blog-Firma = sha256=HMAC-SHA256(secreto, marca.cuerpo)'
);
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo ->> 'id', cuerpo -> 'slugs', cuerpo -> 'categorias', cuerpo -> 'etiquetas'
    from pruebas.cola_nueva()$$,
  $$values ('articulo'::text, 'a2300000-0000-4000-8000-000000000003'::text, '["h2-not-para-publicar"]'::jsonb,
            '["h2-not-categoria"]'::jsonb, '[]'::jsonb)$$,
  'contrato: el body lleva tipo, id, slugs, categorias y etiquetas (vacías en H2, T045 verifica las reales)'
);
select ok(
  (select (cuerpo ->> 'ocurrido_en')::timestamptz is not null from pruebas.cola_nueva()),
  'contrato: el body lleva ocurrido_en'
);

-- ---------------------------------------------------------------------------
-- Se encola: editar el título de un publicado
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000004', '{"titulo": "H2 notificación título nuevo"}');
select pruebas.como_postgres();
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: editar el título de un publicado encola un mensaje');
select is((select cuerpo -> 'slugs' from pruebas.cola_nueva()), '["h2-not-publicado"]'::jsonb,
  'contrato: si el slug no cambió, slugs lleva solo el actual');

-- ---------------------------------------------------------------------------
-- Se encola: cambiar el slug de un publicado (viejo y nuevo en el body)
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000004', '{"slug": "h2-not-publicado-nuevo"}');
select pruebas.como_postgres();
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: cambiar el slug de un publicado encola un mensaje');
select is(
  (select array_agg(s order by s) from pruebas.cola_nueva(), jsonb_array_elements_text(cuerpo -> 'slugs') s),
  array['h2-not-publicado', 'h2-not-publicado-nuevo'],
  'contrato: al cambiar el slug, slugs lleva el viejo y el nuevo'
);

-- ---------------------------------------------------------------------------
-- Validación ronda 3 (A3-M2): cambiar la categoría de un publicado lleva la
-- vieja y la nueva, sin repetidos
-- ---------------------------------------------------------------------------
insert into public.categorias (nombre, slug) values ('H2 Not Categoría B', 'h2-not-categoria-b');
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000004',
  jsonb_build_object('categoria_id', (select id from public.categorias where slug = 'h2-not-categoria-b')));
select pruebas.como_postgres();
select is(
  (select array_agg(c order by c) from pruebas.cola_nueva(), jsonb_array_elements_text(cuerpo -> 'categorias') c),
  array['h2-not-categoria', 'h2-not-categoria-b'],
  'contrato: al cambiar la categoría de un publicado, categorias lleva la vieja y la nueva'
);

-- ---------------------------------------------------------------------------
-- No se encola: updates que solo cambian version o actualizado_en
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000004', '{}');
select pruebas.como_postgres();
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'contrato: un update de un publicado que solo cambia version (y actualizado_en) no encola');
-- 5: publicar no aplica (ya publicado); título, slug y categoría suben la versión; luego este update.
select is((select version from public.articulos where id = 'a2300000-0000-4000-8000-000000000004'), 5,
  'control: ese update sí ocurrió (la versión subió)');

select pruebas.marcar_cola();
update public.articulos set actualizado_en = now() - interval '1 hour',
       version = (select version from public.articulos where id = 'a2300000-0000-4000-8000-000000000004')
 where id = 'a2300000-0000-4000-8000-000000000004';
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'contrato: un update del sistema que solo toca actualizado_en no encola');

-- ---------------------------------------------------------------------------
-- No se encola: cambios en borradores y programados
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000007', '{"titulo": "H2 borrador editado"}');
select pruebas.editar('a2300000-0000-4000-8000-000000000007', '{"slug": "h2-not-borrador-nuevo"}');
select pruebas.como_postgres();
select is((select titulo from public.articulos where id = 'a2300000-0000-4000-8000-000000000007'),
  'H2 borrador editado', 'control: el borrador se editó');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'RF-013: editar un borrador (título o slug) no encola');

select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000008', '{"titulo": "H2 programado editado"}');
select pruebas.como_postgres();
select is((select titulo from public.articulos where id = 'a2300000-0000-4000-8000-000000000008'),
  'H2 programado editado', 'control: el programado se editó');
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'RF-013: editar un programado no encola');

-- ---------------------------------------------------------------------------
-- Se encola: archivar y despublicar
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000004', '{"estado": "archivado"}');
select pruebas.como_postgres();
select is((select estado::text from public.articulos where id = 'a2300000-0000-4000-8000-000000000004'),
  'archivado', 'control: el artículo se archivó');
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: archivar un publicado encola un mensaje');

select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000005', '{"estado": "borrador"}');
select pruebas.como_postgres();
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: despublicar (publicado → borrador) encola un mensaje');

-- Un archivado ya no es público: editarlo no encola.
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
select pruebas.editar('a2300000-0000-4000-8000-000000000004', '{"titulo": "H2 archivado editado"}');
select pruebas.como_postgres();
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'RF-013: editar un archivado no encola');

-- ---------------------------------------------------------------------------
-- Se encola: borrar un publicado (n10_notificar_borrado, before delete)
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-admin@prueba.local');
delete from public.articulos where id = 'a2300000-0000-4000-8000-000000000006';
select pruebas.como_postgres();
select is_empty($$select 1 from public.articulos where id = 'a2300000-0000-4000-8000-000000000006'$$,
  'control: el admin borró el artículo publicado');
select is((select count(*)::int from pruebas.cola_nueva()), 1,
  'RF-013: borrar un publicado encola un mensaje');
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo ->> 'id', cuerpo -> 'slugs', cuerpo -> 'categorias', cuerpo -> 'etiquetas'
    from pruebas.cola_nueva()$$,
  $$values ('articulo'::text, 'a2300000-0000-4000-8000-000000000006'::text, '["h2-not-para-borrar"]'::jsonb,
            '["h2-not-categoria"]'::jsonb, '[]'::jsonb)$$,
  'contrato: el body del borrado lleva el slug, la categoría y etiquetas: [] (T045 verifica las reales)'
);

select pruebas.marcar_cola();
delete from public.articulos where id = 'a2300000-0000-4000-8000-000000000007';
select is_empty($$select 1 from pruebas.cola_nueva()$$,
  'RF-013: borrar un borrador no encola');

-- ---------------------------------------------------------------------------
-- Se encola: crear, editar o borrar una categoría o etiqueta (contrato)
-- ---------------------------------------------------------------------------
select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
insert into public.categorias (nombre, slug) values ('H2 Not Nueva', 'h2-not-nueva');
select pruebas.como_postgres();
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo -> 'slugs' from pruebas.cola_nueva()$$,
  $$values ('categoria'::text, '["h2-not-nueva"]'::jsonb)$$,
  'contrato: crear una categoría encola un mensaje tipo categoria con su slug'
);

select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
update public.categorias set slug = 'h2-not-nueva-2' where slug = 'h2-not-nueva';
select pruebas.como_postgres();
select results_eq(
  $$select cuerpo ->> 'tipo', (select array_agg(s order by s) from jsonb_array_elements_text(cuerpo -> 'slugs') s)
    from pruebas.cola_nueva()$$,
  $$values ('categoria'::text, array['h2-not-nueva', 'h2-not-nueva-2'])$$,
  'contrato: cambiar el slug de una categoría encola un mensaje con el viejo y el nuevo'
);

select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
delete from public.categorias where slug = 'h2-not-nueva-2';
select pruebas.como_postgres();
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo -> 'slugs' from pruebas.cola_nueva()$$,
  $$values ('categoria'::text, '["h2-not-nueva-2"]'::jsonb)$$,
  'contrato: borrar una categoría encola un mensaje tipo categoria'
);

select pruebas.marcar_cola();
select pruebas.como('h2-not-editor@prueba.local');
insert into public.etiquetas (nombre, slug) values ('H2 Not Etiqueta', 'h2-not-etiqueta');
select pruebas.como_postgres();
select results_eq(
  $$select cuerpo ->> 'tipo', cuerpo -> 'slugs' from pruebas.cola_nueva()$$,
  $$values ('etiqueta'::text, '["h2-not-etiqueta"]'::jsonb)$$,
  'contrato: crear una etiqueta encola un mensaje tipo etiqueta con su slug'
);

-- ---------------------------------------------------------------------------
-- Solo postgres lee la cola y los secretos descifrados (data-model "Secretos")
-- ---------------------------------------------------------------------------
select pruebas.como_anon();
select throws_ok($$select 1 from vault.decrypted_secrets$$, '42501', null,
  'anon no puede leer vault.decrypted_secrets');
select pruebas.como('h2-not-editor@prueba.local');
select throws_ok($$select 1 from vault.decrypted_secrets$$, '42501', null,
  'authenticated no puede leer vault.decrypted_secrets');

-- net.http_request_queue concede ALL a PUBLIC (la crea supabase_admin y
-- postgres no puede revocarlo). Mitigación D14: el secreto nunca entra a la cola,
-- solo la firma HMAC; net no está expuesto por la API.
select pruebas.como_postgres();
select is_empty(
  $$select 1 from net.http_request_queue
    where (headers::text || coalesce(convert_from(body, 'UTF8'), '')) like '%secreto-de-prueba-hmac%'$$,
  'D14: el secreto de revalidación no aparece en ninguna fila de la cola de pg_net'
);

select pruebas.como_postgres();
select * from finish();
rollback;
