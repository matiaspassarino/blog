-- T010: base de datos del panel de administración (spec 003; data-model "Pruebas pgTAP").
-- Migración 20261021120000_panel_admin.sql: bucket medios sin GIF, índice articulos_actualizado_idx,
-- privado.sin_tildes, public.listar_articulos_panel, public.listar_equipo y public.rutas_en_uso.
-- Cubre RF-007, RF-016, RF-017, RF-020 y D11.
--
-- No depende del seed: borra todos los artículos dentro de la transacción (se deshace con el
-- rollback) y crea sus propios usuarios @prueba.local con prefijo pn-: un admin, un editor, un
-- miembro desactivado y un invitado (email_confirmed_at nulo).
--
-- Mientras la migración no exista, todas las aserciones usan SQL en cadena o consultas al
-- catálogo: cada una falla por separado en lugar de abortar el archivo.
begin;
\ir helpers/pruebas.psql
select plan(72);

-- Sin secretos de revalidación: el armado de datos no debe notificar.
delete from vault.secrets where name in ('url_web_revalidacion', 'secreto_revalidacion');

select pruebas.crear_usuario('pn-admin@prueba.local', '{"provider":"email","rol":"admin"}', '{"nombre":"Pn Admin"}');
select pruebas.crear_usuario('pn-editor@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Pn Editor"}');
select pruebas.crear_usuario('pn-desactivado@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Pn Desactivado"}');
select pruebas.crear_usuario('pn-invitado@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Pn Invitado"}');

-- Un invitado todavía no confirmó su correo; un desactivado tiene el perfil inactivo.
update auth.users set email_confirmed_at = null where email = 'pn-invitado@prueba.local';
update public.perfiles set activo = false
  where id = (select id from auth.users where email = 'pn-desactivado@prueba.local');

-- Id de un usuario de prueba.
create function pruebas.id_de(email_usuario text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where u.email = email_usuario
$$;
grant execute on function pruebas.id_de(text) to anon, authenticated;

-- Elementos del documento con id propio (spec 005, T096): párrafo, imagen y galería, con los campos de la
-- imagen como attrs planos (attrs.imagen.ruta y attrs.imagenes[*].ruta).
create function pruebas.parrafo_pn(texto text) returns jsonb
language sql volatile as $$
  select jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', gen_random_uuid()::text),
    'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', texto)))
$$;
create function pruebas.bloque_imagen_pn(ruta text) returns jsonb
language sql volatile as $$
  select jsonb_build_object('type', 'imagen', 'attrs', jsonb_build_object('id', gen_random_uuid()::text,
    'imagen', jsonb_build_object('ruta', ruta, 'ancho', 800, 'alto', 600, 'alt', 'Imagen de prueba')))
$$;
create function pruebas.galeria_pn(rutas text[]) returns jsonb
language sql volatile as $$
  select jsonb_build_object('type', 'galeria', 'attrs', jsonb_build_object('id', gen_random_uuid()::text, 'columnas', 3,
    'imagenes', (select jsonb_agg(jsonb_build_object('ruta', r, 'ancho', 800, 'alto', 600, 'alt', 'Foto') order by i)
                 from unnest(rutas) with ordinality as x(r, i))))
$$;
-- El documento con estos elementos.
create function pruebas.doc_pn(elementos jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('type', 'doc', 'content', elementos)
$$;

-- Aísla los datos: fuera los artículos del seed y de otros tests (rollback al final).
delete from public.articulos;
delete from public.categorias where slug like 'pn-%';
insert into public.categorias (id, nombre, slug) values
  ('c7000000-0000-4000-8000-000000000001', 'Pn Categoría A', 'pn-categoria-a'),
  ('c7000000-0000-4000-8000-000000000002', 'Pn Categoría B', 'pn-categoria-b');

-- Artículos de partida, cargados por el sistema. Todos los títulos base terminan en "pnb".
insert into public.articulos (id, titulo, slug, contenido, categoria_id, autor_id, estado, publicado_en, programado_para)
select x.id::uuid, x.titulo, 'pn-' || x.sufijo,
       pruebas.doc_pn(jsonb_build_array(pruebas.parrafo_pn('Cuerpo neutro.'))),
       x.categoria_id::uuid,
       pruebas.id_de(x.autor),
       x.estado::public.estado_articulo, x.publicado_en, x.programado_para
from (values
  ('a7000000-0000-4000-8000-000000000001', 'b1', 'Diseño de logotipos pnb', 'c7000000-0000-4000-8000-000000000001',
   'pn-editor@prueba.local', 'borrador', null::timestamptz, null::timestamptz),
  ('a7000000-0000-4000-8000-000000000002', 'b2', 'Guía de fotografía pnb', 'c7000000-0000-4000-8000-000000000002',
   'pn-admin@prueba.local', 'publicado', now() - interval '3 days', null),
  ('a7000000-0000-4000-8000-000000000003', 'b3', 'Taller programado pnb', 'c7000000-0000-4000-8000-000000000001',
   'pn-editor@prueba.local', 'programado', null, now() + interval '5 days'),
  ('a7000000-0000-4000-8000-000000000004', 'b4', 'Archivo histórico pnb', 'c7000000-0000-4000-8000-000000000002',
   'pn-admin@prueba.local', 'archivado', now() - interval '60 days', null),
  ('a7000000-0000-4000-8000-000000000005', 'b5', '100% natural pnb', null,
   'pn-editor@prueba.local', 'borrador', null, null),
  ('a7000000-0000-4000-8000-000000000006', 'b6', 'Guion_bajo pnb', null,
   'pn-desactivado@prueba.local', 'borrador', null, null),
  ('a7000000-0000-4000-8000-000000000007', 'b7', 'Guion bajo espacio pnb', null,
   'pn-admin@prueba.local', 'borrador', null, null),
  ('a7000000-0000-4000-8000-000000000008', 'b8', 'Ruta \ barra pnb', null,
   'pn-editor@prueba.local', 'borrador', null, null),
  ('a7000000-0000-4000-8000-000000000009', 'b9', '1005 natural pnb', null,
   'pn-admin@prueba.local', 'borrador', null, null)
) as x(id, sufijo, titulo, categoria_id, autor, estado, publicado_en, programado_para);

-- Lote de 105 borradores para el límite máximo (100), la paginación y el total.
insert into public.articulos (titulo, slug, contenido, autor_id, estado)
select 'Lote ' || n, 'pn-lote-' || n,
       pruebas.doc_pn(jsonb_build_array(pruebas.parrafo_pn('Cuerpo neutro.'))),
       pruebas.id_de('pn-admin@prueba.local'), 'borrador'
from generate_series(1, 105) as n;

-- Orden por actualizado_en: se fijan fechas distintas sin que el trigger las pise.
insert into public.articulos (id, titulo, slug, contenido, autor_id, estado) values
  ('a7000000-0000-4000-8000-0000000000a1', 'Orden A pno', 'pn-orden-a', pruebas.doc_pn(jsonb_build_array(pruebas.parrafo_pn('x'))), pruebas.id_de('pn-admin@prueba.local'), 'borrador'),
  ('a7000000-0000-4000-8000-0000000000a2', 'Orden B pno', 'pn-orden-b', pruebas.doc_pn(jsonb_build_array(pruebas.parrafo_pn('x'))), pruebas.id_de('pn-admin@prueba.local'), 'borrador'),
  ('a7000000-0000-4000-8000-0000000000a3', 'Orden C pno', 'pn-orden-c', pruebas.doc_pn(jsonb_build_array(pruebas.parrafo_pn('x'))), pruebas.id_de('pn-admin@prueba.local'), 'borrador');
alter table public.articulos disable trigger a90_actualizado_en;
update public.articulos set actualizado_en = now() - interval '2 days' where slug = 'pn-orden-a';
update public.articulos set actualizado_en = now() - interval '3 days' where slug = 'pn-orden-b';
update public.articulos set actualizado_en = now() - interval '1 day' where slug = 'pn-orden-c';
alter table public.articulos enable trigger a90_actualizado_en;

-- Datos para rutas_en_uso: contenido (incluidos nombres con comillas, barra invertida y prefijos),
-- imagen destacada y avatar.
insert into public.articulos (id, titulo, slug, contenido, imagen_destacada, autor_id, estado) values
  ('a7000000-0000-4000-8000-0000000000b1', 'Uso de rutas', 'pn-uso-rutas',
   pruebas.doc_pn(jsonb_build_array(
     pruebas.bloque_imagen_pn('articulos/2026/10/pn-contenido.webp'),
     pruebas.bloque_imagen_pn('articulos/pn-a.jpg.bak'),
     pruebas.bloque_imagen_pn('articulos/pn-"comilla".webp'),
     pruebas.bloque_imagen_pn('articulos/pn\barra.webp'),
     pruebas.galeria_pn(array['articulos/pn-galeria-1.webp', 'articulos/pn-galeria-2.webp']))),
   '{"ruta": "articulos/2026/10/pn-portada.webp", "ancho": 1200, "alto": 630, "alt": "Portada"}'::jsonb,
   pruebas.id_de('pn-admin@prueba.local'), 'borrador');
update public.perfiles
  set avatar = '{"ruta": "avatares/pn-avatar.webp", "ancho": 96, "alto": 96, "alt": "Foto"}'::jsonb
  where id = pruebas.id_de('pn-editor@prueba.local');

-- ===========================================================================
-- Bucket medios sin GIF (RF-007)
-- ===========================================================================
select results_eq(
  $$select file_size_limit, allowed_mime_types from storage.buckets where id = 'medios'$$,
  $$values (5242880::bigint, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[])$$,
  'RF-007: el bucket medios acepta solo JPEG, PNG, WebP y AVIF, hasta 5 MB'
);

-- ===========================================================================
-- Índice del orden de la lista
-- ===========================================================================
select has_index('public', 'articulos', 'articulos_actualizado_idx',
  'existe el índice articulos_actualizado_idx para ordenar la lista del panel');

-- ===========================================================================
-- privado.sin_tildes
-- ===========================================================================
select ok(coalesce((select provolatile = 'i' from pg_proc where oid = to_regprocedure('privado.sin_tildes(text)')), false),
  'privado.sin_tildes es inmutable');
select ok(coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = to_regprocedure('privado.sin_tildes(text)')), false),
  'privado.sin_tildes tiene search_path vacío');
select results_eq($$select privado.sin_tildes('Diseño')$$, $$values ('diseno'::text)$$,
  'sin_tildes convierte Diseño en diseno');
select results_eq($$select privado.sin_tildes('CANCIÓN Árbol Ñandú')$$, $$values ('cancion arbol nandu'::text)$$,
  'sin_tildes pasa a minúsculas y quita tildes y diéresis');
select results_eq($$select privado.sin_tildes(null)$$, $$values (''::text)$$,
  'sin_tildes devuelve cadena vacía para null');
select function_privs_are('privado', 'sin_tildes', array['text'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar privado.sin_tildes');
select function_privs_are('privado', 'sin_tildes', array['text'], 'anon', array[]::text[],
  'anon no puede ejecutar privado.sin_tildes');

-- ===========================================================================
-- listar_articulos_panel
-- ===========================================================================
select is(
  (select array_agg(a.nombre order by a.orden)
     from pg_proc p,
          unnest(p.proargnames, p.proargmodes::text[]) with ordinality as a(nombre, modo, orden)
    where p.oid = to_regprocedure('public.listar_articulos_panel(public.estado_articulo, uuid, uuid, text, integer, integer)')
      and a.modo = 't'),
  array['id', 'titulo', 'slug', 'estado', 'categoria_id', 'categoria_nombre', 'autor_id', 'autor_nombre',
        'programado_para', 'publicado_en', 'actualizado_en', 'total']::text[],
  'listar_articulos_panel devuelve las columnas del contrato'
);

-- Anónimo: sin execute.
select pruebas.como_anon();
select throws_ok($$select * from public.listar_articulos_panel()$$, '42501', null,
  'un anónimo no puede ejecutar listar_articulos_panel');

-- Miembro desactivado: se comporta como anónimo, sin borradores.
select pruebas.como('pn-desactivado@prueba.local');
select results_eq(
  $$select count(*)::int from public.listar_articulos_panel(p_estado => 'borrador')$$,
  $$values (0)$$,
  'un miembro desactivado no ve borradores en la lista'
);
select results_eq(
  $$select array_agg(distinct estado::text) from public.listar_articulos_panel(p_texto => 'pnb', p_limite => 100)$$,
  $$values (array['publicado']::text[])$$,
  'un miembro desactivado solo ve lo publicado'
);

-- Editor: ve todos los estados.
select pruebas.como('pn-editor@prueba.local');
select results_eq(
  $$select array_agg(distinct estado::text order by estado::text) from public.listar_articulos_panel(p_texto => 'pnb', p_limite => 100)$$,
  $$values (array['archivado', 'borrador', 'programado', 'publicado']::text[])$$,
  'H4: el editor ve borradores, programados, publicados y archivados'
);
select results_eq(
  $$select count(*)::int from public.listar_articulos_panel(p_texto => 'pnb', p_limite => 100)$$,
  $$values (9)$$,
  'sin filtros de estado el editor ve los nueve artículos base'
);

-- Filtros por estado, categoría y autor.
select results_eq(
  $$select count(*)::int from public.listar_articulos_panel(p_estado => 'borrador', p_texto => 'pnb', p_limite => 100)$$,
  $$values (6)$$,
  'filtro por estado borrador'
);
select results_eq(
  $$select slug from public.listar_articulos_panel(p_categoria_id => 'c7000000-0000-4000-8000-000000000001') order by slug$$,
  $$values ('pn-b1'::text), ('pn-b3')$$,
  'filtro por categoría'
);
select results_eq(
  $$select slug from public.listar_articulos_panel(p_autor_id => pruebas.id_de('pn-editor@prueba.local'), p_estado => 'borrador') order by slug$$,
  $$values ('pn-b1'::text), ('pn-b5'), ('pn-b8')$$,
  'filtro por autor combinado con estado'
);
select results_eq(
  $$select slug from public.listar_articulos_panel(
      p_estado => 'borrador',
      p_categoria_id => 'c7000000-0000-4000-8000-000000000001',
      p_autor_id => pruebas.id_de('pn-editor@prueba.local'))$$,
  $$values ('pn-b1'::text)$$,
  'estado, categoría y autor combinados'
);
select is_empty(
  $$select 1 from public.listar_articulos_panel(
      p_estado => 'archivado', p_categoria_id => 'c7000000-0000-4000-8000-000000000001')$$,
  'una combinación sin coincidencias devuelve una lista vacía'
);
select results_eq(
  $$select slug from public.listar_articulos_panel(p_estado => 'publicado', p_categoria_id => 'c7000000-0000-4000-8000-000000000002')$$,
  $$values ('pn-b2'::text)$$,
  'estado y categoría combinados'
);

-- Texto: sin tildes ni mayúsculas.
select results_eq($$select slug from public.listar_articulos_panel(p_texto => 'DISENO')$$, $$values ('pn-b1'::text)$$,
  'H4: el texto "DISENO" encuentra "Diseño de logotipos"');
select results_eq($$select slug from public.listar_articulos_panel(p_texto => 'diseño')$$, $$values ('pn-b1'::text)$$,
  'H4: el texto con tilde también encuentra el título');
select results_eq($$select slug from public.listar_articulos_panel(p_texto => 'GUÍA')$$, $$values ('pn-b2'::text)$$,
  'H4: el texto en mayúsculas y con tilde encuentra "Guía de fotografía"');

-- Comodines de LIKE tratados como texto literal.
select results_eq($$select slug from public.listar_articulos_panel(p_texto => '%')$$, $$values ('pn-b5'::text)$$,
  'el texto "%" solo encuentra títulos que contienen un porcentaje');
select results_eq($$select slug from public.listar_articulos_panel(p_texto => '100%')$$, $$values ('pn-b5'::text)$$,
  'el texto "100%" no encuentra "1005 natural"');
select results_eq($$select slug from public.listar_articulos_panel(p_texto => '_')$$, $$values ('pn-b6'::text)$$,
  'el texto "_" solo encuentra títulos con guion bajo');
select results_eq($$select slug from public.listar_articulos_panel(p_texto => 'n_b')$$, $$values ('pn-b6'::text)$$,
  'el texto "n_b" no encuentra "Guion bajo espacio"');
select results_eq($$select slug from public.listar_articulos_panel(p_texto => '\')$$, $$values ('pn-b8'::text)$$,
  'el texto "\" no falla y solo encuentra títulos con barra invertida');

-- Datos de cada fila.
select results_eq(
  $$select categoria_nombre, autor_nombre, estado::text from public.listar_articulos_panel(p_texto => '100% natural')$$,
  $$values (null::text, 'Pn Editor'::text, 'borrador'::text)$$,
  'un borrador sin categoría devuelve categoria_nombre nulo y el nombre del autor'
);
select results_eq(
  $$select categoria_nombre, autor_nombre from public.listar_articulos_panel(p_texto => 'logotipos')$$,
  $$values ('Pn Categoría A'::text, 'Pn Editor'::text)$$,
  'la fila trae el nombre de la categoría y del autor'
);
select results_eq(
  $$select autor_nombre from public.listar_articulos_panel(p_texto => 'guion_bajo')$$,
  $$values ('Pn Desactivado'::text)$$,
  'el autor desactivado se muestra igual'
);

-- Límite, desplazamiento y total.
select results_eq(
  $$select count(*)::int, min(total)::int, max(total)::int from public.listar_articulos_panel(p_texto => 'lote', p_limite => 10, p_desplazamiento => 20)$$,
  $$values (10, 105, 105)$$,
  'total cuenta todas las filas aunque la página traiga 10'
);
select results_eq(
  $$select count(*)::int from public.listar_articulos_panel(p_texto => 'lote', p_limite => 1000)$$,
  $$values (100)$$,
  'el límite se recorta a 100'
);
select results_eq(
  $$select count(*)::int from public.listar_articulos_panel(p_texto => 'lote', p_limite => 0)$$,
  $$values (1)$$,
  'un límite de 0 se recorta a 1'
);
select results_eq(
  $$select count(*)::int from public.listar_articulos_panel(p_texto => 'lote', p_limite => -5)$$,
  $$values (1)$$,
  'un límite negativo se recorta a 1'
);
select results_eq(
  $$select id from public.listar_articulos_panel(p_texto => 'lote', p_limite => 3, p_desplazamiento => -10)$$,
  $$select id from public.listar_articulos_panel(p_texto => 'lote', p_limite => 3, p_desplazamiento => 0)$$,
  'un desplazamiento negativo se trata como 0'
);
select results_eq(
  $$select count(*)::int, min(total)::int from public.listar_articulos_panel(p_texto => 'lote', p_limite => 100, p_desplazamiento => 100)$$,
  $$values (5, 105)$$,
  'la última página trae lo que queda y el total completo'
);
select is_empty(
  $$select 1 from public.listar_articulos_panel(p_texto => 'lote', p_limite => 20, p_desplazamiento => 400)$$,
  'un desplazamiento mayor que el total devuelve 0 filas sin error'
);
select results_eq(
  $$select titulo from public.listar_articulos_panel(p_texto => 'pno')$$,
  $$values ('Orden C pno'::text), ('Orden A pno'), ('Orden B pno')$$,
  'la lista se ordena por actualizado_en descendente'
);

-- ===========================================================================
-- listar_equipo
-- ===========================================================================
select is(
  (select array_agg(a.nombre order by a.orden)
     from pg_proc p,
          unnest(p.proargnames, p.proargmodes::text[]) with ordinality as a(nombre, modo, orden)
    where p.oid = to_regprocedure('public.listar_equipo()') and a.modo = 't'),
  array['id', 'nombre', 'correo', 'rol', 'activo', 'acceso', 'creado_en']::text[],
  'listar_equipo no devuelve ninguna columna extra de auth.users'
);

select pruebas.como_anon();
select throws_ok($$select * from public.listar_equipo()$$, '42501', null,
  'un anónimo no puede ejecutar listar_equipo');

select pruebas.como('pn-editor@prueba.local');
select throws_ok($$select * from public.listar_equipo()$$, 'P0001', 'sin_permiso',
  'H6: un editor recibe sin_permiso al listar el equipo');

select pruebas.como('pn-desactivado@prueba.local');
select throws_ok($$select * from public.listar_equipo()$$, 'P0001', 'sin_permiso',
  'H6: un miembro desactivado recibe sin_permiso al listar el equipo');

select pruebas.como('pn-admin@prueba.local');
select results_eq(
  $$select correo, nombre, rol::text, activo, acceso from public.listar_equipo() where correo like 'pn-%'$$,
  $$values
    ('pn-admin@prueba.local'::text, 'Pn Admin'::text, 'admin'::text, true, 'activo'::text),
    ('pn-desactivado@prueba.local', 'Pn Desactivado', 'editor', false, 'desactivado'),
    ('pn-editor@prueba.local', 'Pn Editor', 'editor', true, 'activo'),
    ('pn-invitado@prueba.local', 'Pn Invitado', 'editor', true, 'invitado')$$,
  'H6: el admin recibe correo y acceso correctos para activo, desactivado e invitado, ordenados por nombre'
);
select results_eq(
  $$select count(*)::int from public.listar_equipo()
     where id = pruebas.id_de('pn-editor@prueba.local') and creado_en is not null$$,
  $$values (1)$$,
  'listar_equipo trae el id y la fecha de alta de cada miembro'
);

-- ===========================================================================
-- rutas_en_uso (rutas relativas al bucket)
-- ===========================================================================
select pruebas.como_anon();
select throws_ok($$select public.rutas_en_uso(array['articulos/x.webp'])$$, '42501', null,
  'un anónimo no puede ejecutar rutas_en_uso');

select pruebas.como('pn-desactivado@prueba.local');
select throws_ok($$select public.rutas_en_uso(array['articulos/x.webp'])$$, 'P0001', 'sin_permiso',
  'un miembro desactivado recibe sin_permiso en rutas_en_uso');

select pruebas.como('pn-editor@prueba.local');
select results_eq(
  $$select public.rutas_en_uso(array['articulos/2026/10/pn-contenido.webp'])$$,
  $$values (array['articulos/2026/10/pn-contenido.webp']::text[])$$,
  'D11 (spec 005): detecta una ruta usada en un elemento imagen del documento (attrs.imagen.ruta)'
);
select results_eq(
  $$select r from unnest(public.rutas_en_uso(array['articulos/pn-galeria-2.webp', 'articulos/pn-galeria-1.webp'])) as r order by r$$,
  $$values ('articulos/pn-galeria-1.webp'::text), ('articulos/pn-galeria-2.webp')$$,
  'D11 (spec 005): detecta las rutas de una galería del documento (attrs.imagenes[*].ruta)'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/2026/10/pn-portada.webp'])$$,
  $$values (array['articulos/2026/10/pn-portada.webp']::text[])$$,
  'D11: detecta una ruta usada como imagen destacada'
);
select results_eq(
  $$select public.rutas_en_uso(array['avatares/pn-avatar.webp'])$$,
  $$values (array['avatares/pn-avatar.webp']::text[])$$,
  'D11: detecta una ruta usada como avatar'
);
select results_eq(
  $$select r from unnest(public.rutas_en_uso(array[
      'articulos/pn-sin-uso.webp', 'avatares/pn-avatar.webp', 'articulos/2026/10/pn-contenido.webp'])) as r order by r$$,
  $$values ('articulos/2026/10/pn-contenido.webp'::text), ('avatares/pn-avatar.webp')$$,
  'D11: de varias rutas devuelve solo las que están en uso'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/pn-sin-uso.webp'])$$,
  $$values ('{}'::text[])$$,
  'D11: una ruta sin uso devuelve un arreglo vacío'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/pn-a.jpg'])$$,
  $$values ('{}'::text[])$$,
  'D11: "a.jpg" no coincide con "a.jpg.bak" (sin falso positivo por prefijo)'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/pn-a.jpg.bak'])$$,
  $$values (array['articulos/pn-a.jpg.bak']::text[])$$,
  'D11: la ruta completa "a.jpg.bak" sí se detecta'
);
select results_eq(
  $$select public.rutas_en_uso(array['%'])$$,
  $$values ('{}'::text[])$$,
  'D11: el texto "%" no actúa como comodín'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/2026/10/pn-contenid_.webp'])$$,
  $$values ('{}'::text[])$$,
  'D11: el guion bajo no actúa como comodín'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/pn-"comilla".webp'])$$,
  $$values (array['articulos/pn-"comilla".webp']::text[])$$,
  'D11: una ruta con comillas se detecta (sin falso negativo)'
);
select results_eq(
  $$select public.rutas_en_uso(array['articulos/pn\barra.webp'])$$,
  $$values (array['articulos/pn\barra.webp']::text[])$$,
  'D11: una ruta con barra invertida se detecta (sin falso negativo)'
);
select results_eq(
  $$select public.rutas_en_uso(null::text[])$$,
  $$values ('{}'::text[])$$,
  'D11: null devuelve un arreglo vacío'
);
select results_eq(
  $$select public.rutas_en_uso(array[]::text[])$$,
  $$values ('{}'::text[])$$,
  'D11: un arreglo vacío devuelve un arreglo vacío'
);

-- ===========================================================================
-- Privilegios y atributos de las funciones
-- ===========================================================================
select pruebas.como_postgres();
select function_privs_are('public', 'listar_articulos_panel',
  array['estado_articulo', 'uuid', 'uuid', 'text', 'integer', 'integer'], 'anon', array[]::text[],
  'anon no puede ejecutar listar_articulos_panel');
select function_privs_are('public', 'listar_articulos_panel',
  array['estado_articulo', 'uuid', 'uuid', 'text', 'integer', 'integer'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar listar_articulos_panel');
select function_privs_are('public', 'listar_equipo', array[]::text[], 'anon', array[]::text[],
  'anon no puede ejecutar listar_equipo');
select function_privs_are('public', 'listar_equipo', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar listar_equipo');
select function_privs_are('public', 'rutas_en_uso', array['text[]'], 'anon', array[]::text[],
  'anon no puede ejecutar rutas_en_uso');
select function_privs_are('public', 'rutas_en_uso', array['text[]'], 'authenticated', array['EXECUTE'],
  'authenticated puede ejecutar rutas_en_uso');
select results_eq(
  $$select p.proname::text collate "default",
           exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE')
      from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'privado'::regnamespace)
       and p.proname in ('listar_articulos_panel', 'listar_equipo', 'rutas_en_uso', 'sin_tildes')
     order by p.proname$$,
  $$values ('listar_articulos_panel'::text, false), ('listar_equipo', false), ('rutas_en_uso', false), ('sin_tildes', false)$$,
  'PUBLIC no tiene execute en las cuatro funciones'
);
select results_eq(
  $$select p.proname::text collate "default", p.prosecdef from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('listar_articulos_panel', 'listar_equipo', 'rutas_en_uso')
     order by p.proname$$,
  $$values ('listar_articulos_panel'::text, false), ('listar_equipo', true), ('rutas_en_uso', true)$$,
  'listar_articulos_panel es invoker; listar_equipo y rutas_en_uso son definer'
);
select results_eq(
  $$select p.proname::text collate "default", coalesce(p.proconfig @> array['search_path=""'], false) from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('listar_articulos_panel', 'listar_equipo', 'rutas_en_uso')
     order by p.proname$$,
  $$values ('listar_articulos_panel'::text, true), ('listar_equipo', true), ('rutas_en_uso', true)$$,
  'las tres funciones públicas tienen search_path vacío'
);
select results_eq(
  $$select count(*)::int, (count(*) filter (where prosrc ilike '%execute %' or prosrc ilike '%net.http_%'))::int
      from pg_proc where pronamespace = 'public'::regnamespace and proname in ('listar_equipo', 'rutas_en_uso')$$,
  $$values (2, 0)$$,
  'los cuerpos definer no contienen "execute " ni "net.http_"'
);

select * from finish();
rollback;
