-- Slug de autores: valor 'autor' en tipo_entidad.
-- Spec 002 · research D10 · data-model "Migración 1".
-- Va sola: un valor de enum nuevo no se puede usar en la misma transacción en que se
-- crea ("unsafe use of new value"). En el SQL Editor de la nube se ejecuta en una
-- corrida separada de la migración siguiente.
alter type public.tipo_entidad add value if not exists 'autor';
