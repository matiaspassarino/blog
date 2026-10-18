-- Test de humo: confirma que pgTAP funciona en el entorno local.
begin;
select plan(1);
select has_schema('public', 'existe el esquema public');
select * from finish();
rollback;
