-- T007: verifica que los helpers de test (esquema `pruebas`) se cargan.
-- Los helpers viven en helpers/pruebas.psql y cada archivo que los necesita
-- los incluye con `\ir` dentro de su propia transacción (no persisten).
begin;
\ir helpers/pruebas.psql
select plan(1);
select pass('helpers cargados');
select * from finish();
rollback;
