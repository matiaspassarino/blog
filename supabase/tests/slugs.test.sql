-- T010: slugs (RF-005, research D10, D23).
-- privado.slugificar, trigger a10_asignar_slug en categorias y etiquetas,
-- unicidad de nombres sin distinguir mayúsculas y check de formato del slug.
begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- privado.slugificar(text)
-- ---------------------------------------------------------------------------
select is(privado.slugificar('Año de Diseño!'), 'ano-de-diseno',
  'slugificar quita tildes y eñes, pasa a minúsculas y reemplaza símbolos');
select is(privado.slugificar('hola   --  mundo'), 'hola-mundo',
  'slugificar colapsa espacios y guiones consecutivos en un solo guion');
select is(privado.slugificar('  --¿Hola Mundo?--  '), 'hola-mundo',
  'slugificar recorta los guiones de los bordes');
select is(privado.slugificar('SEO & Marketing 2026'), 'seo-marketing-2026',
  'slugificar conserva los dígitos');
select is(privado.slugificar('Pingüino Ñandú'), 'pinguino-nandu',
  'slugificar normaliza diéresis y eñes');

-- ---------------------------------------------------------------------------
-- Generación desde el nombre (trigger a10_asignar_slug)
-- ---------------------------------------------------------------------------
insert into public.categorias (nombre) values ('Diseño Web');
select is((select slug from public.categorias where nombre = 'Diseño Web'), 'diseno-web',
  'una categoría sin slug lo genera a partir del nombre');

insert into public.categorias (nombre, slug) values ('Slug Vacío', '');
select is((select slug from public.categorias where nombre = 'Slug Vacío'), 'slug-vacio',
  'una categoría con slug vacío lo genera a partir del nombre');

insert into public.etiquetas (nombre) values ('Diseño Web');
select is((select slug from public.etiquetas where nombre = 'Diseño Web'), 'diseno-web',
  'una etiqueta sin slug lo genera a partir del nombre (sin chocar con categorías)');

-- ---------------------------------------------------------------------------
-- Nombres únicos sin distinguir mayúsculas: unique (lower(nombre))
-- ---------------------------------------------------------------------------
insert into public.categorias (nombre) values ('SEO');
select throws_ok($$insert into public.categorias (nombre) values ('seo')$$, '23505', null,
  'una categoría con el mismo nombre en otra capitalización es rechazada');
insert into public.etiquetas (nombre) values ('SEO');
select throws_ok($$insert into public.etiquetas (nombre) values ('Seo')$$, '23505', null,
  'una etiqueta con el mismo nombre en otra capitalización es rechazada');

-- ---------------------------------------------------------------------------
-- Slug informado: se normaliza
-- ---------------------------------------------------------------------------
insert into public.categorias (nombre, slug) values ('Informada', '  Mi Slug Ñandú!  ');
select is((select slug from public.categorias where nombre = 'Informada'), 'mi-slug-nandu',
  'un slug informado se normaliza');
insert into public.etiquetas (nombre, slug) values ('Informada', 'Otra--Cosa');
select is((select slug from public.etiquetas where nombre = 'Informada'), 'otra-cosa',
  'un slug informado en una etiqueta se normaliza');

-- ---------------------------------------------------------------------------
-- Slug duplicado: sufijos -2, -3…
-- ---------------------------------------------------------------------------
insert into public.categorias (nombre) values ('Diseño-Web');
select is((select slug from public.categorias where nombre = 'Diseño-Web'), 'diseno-web-2',
  'un slug duplicado recibe el sufijo -2');
insert into public.categorias (nombre) values ('Diseño_Web');
select is((select slug from public.categorias where nombre = 'Diseño_Web'), 'diseno-web-3',
  'un segundo duplicado recibe el sufijo -3');
insert into public.categorias (nombre, slug) values ('Explícita', 'diseno-web');
select is((select slug from public.categorias where nombre = 'Explícita'), 'diseno-web-4',
  'un slug informado que ya existe también recibe sufijo');
insert into public.etiquetas (nombre) values ('Diseño-Web');
select is((select slug from public.etiquetas where nombre = 'Diseño-Web'), 'diseno-web-2',
  'en etiquetas, un slug duplicado recibe el sufijo -2');

-- ---------------------------------------------------------------------------
-- Check de formato con el trigger deshabilitado (como postgres)
-- ---------------------------------------------------------------------------
alter table public.categorias disable trigger a10_asignar_slug;
alter table public.etiquetas disable trigger a10_asignar_slug;

select throws_ok($$insert into public.categorias (nombre, slug) values ('Mal 1', 'Con Mayusculas')$$, '23514', null,
  'el check rechaza un slug con mayúsculas y espacios');
select throws_ok($$insert into public.categorias (nombre, slug) values ('Mal 2', '-borde-')$$, '23514', null,
  'el check rechaza un slug con guiones en los bordes');
select throws_ok($$insert into public.categorias (nombre, slug) values ('Mal 3', 'doble--guion')$$, '23514', null,
  'el check rechaza un slug con guiones consecutivos');
select throws_ok($$insert into public.categorias (nombre, slug) values ('Mal 4', 'diseño')$$, '23514', null,
  'el check rechaza un slug con caracteres no ASCII');
select throws_ok($$insert into public.categorias (nombre, slug) values ('Mal 5', '')$$, '23514', null,
  'el check rechaza un slug vacío');
select throws_ok($$insert into public.etiquetas (nombre, slug) values ('Mal 6', 'con_guion_bajo')$$, '23514', null,
  'el check de etiquetas rechaza un slug con guion bajo');
select lives_ok($$insert into public.categorias (nombre, slug) values ('Bien', 'slug-valido-2026')$$,
  'el check acepta un slug válido');
select lives_ok($$insert into public.etiquetas (nombre, slug) values ('Bien', 'a1')$$,
  'el check de etiquetas acepta un slug válido');

alter table public.categorias enable trigger a10_asignar_slug;
alter table public.etiquetas enable trigger a10_asignar_slug;

-- ---------------------------------------------------------------------------
-- Fuente única del sufijo (validación C-B3): privado.slug_disponible
-- ---------------------------------------------------------------------------
select is(privado.slug_disponible('categoria', 'Diseño Web'), 'diseno-web-5',
  'slug_disponible devuelve el primer sufijo libre (igual que el trigger)');
select is(privado.slug_disponible('categoria', 'Diseño Web',
    (select id from public.categorias where slug = 'diseno-web')), 'diseno-web',
  'slug_disponible excluye la fila propia');
select is(privado.slug_disponible('etiqueta', '¡!'), 'sin-titulo',
  'slug_disponible usa sin-titulo si el texto no deja caracteres');
insert into public.categorias (nombre) values ('Diseño  Web!');
select is((select slug from public.categorias where nombre = 'Diseño  Web!'), 'diseno-web-5',
  'el trigger asigna el mismo slug que había previsto slug_disponible');
select is_empty($$
  select 1 from pg_proc
  where proname = 'asignar_slug' and pronamespace = 'privado'::regnamespace
    and prosrc ilike '%execute %'
$$, 'asignar_slug ya no usa SQL dinámico');

select throws_ok($$select privado.slug_disponible(null, 'Hola')$$,
  '22004', 'tipo_requerido', 'A-M6: slug_disponible rechaza un tipo nulo (no queda en bucle)');
select * from finish();
rollback;
