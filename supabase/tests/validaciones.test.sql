-- Regresión de las funciones de validación de la fundación: un check que
-- evalúa a NULL se considera cumplido, así que deben devolver false (no NULL).
begin;
\ir helpers/pruebas.psql
select plan(10);

select is(privado.imagen_valida('{"ruta":"a.jpg","ancho":1,"alto":1}'), false,
  'imagen_valida es false (no NULL) si falta alt y no es decorativa');
select is(privado.imagen_valida('{"ancho":1,"alto":1,"alt":"x"}'), false,
  'imagen_valida es false si falta ruta');
select is(privado.imagen_valida('{"ruta":"a.jpg","alto":1,"alt":"x"}'), false,
  'imagen_valida es false si falta ancho');
select is(privado.imagen_valida('{"ruta":"a.jpg","ancho":1,"alto":1,"decorativa":true}'), true,
  'imagen_valida acepta una imagen decorativa sin alt');
select is(privado.contenido_valido('[{"tipo":"parrafo"}]'), false,
  'contenido_valido es false si un bloque no tiene id');
select is(privado.contenido_valido('[{"id":"x"}]'), false,
  'contenido_valido es false si un bloque no tiene tipo');
select is(privado.contenido_valido('[1]'), false,
  'contenido_valido es false si un bloque no es un objeto');
select is(privado.contenido_valido('{}'), false,
  'contenido_valido es false si el contenido no es un arreglo');
select is(privado.contenido_valido('[{"id":"x","tipo":"parrafo"}]'), true,
  'contenido_valido acepta un bloque con id y tipo conocido');

select pruebas.crear_usuario('avatar@prueba.local', '{"provider":"email","rol":"editor"}', '{"nombre":"Avatar Prueba"}');
select throws_ok(
  $$update public.perfiles set avatar = '{"ruta":"a.jpg","ancho":1,"alto":1}'
    where id = (select id from auth.users where email = 'avatar@prueba.local')$$,
  '23514', null,
  'perfiles.avatar rechaza una imagen sin alt (RF-004)'
);

select * from finish();
rollback;
