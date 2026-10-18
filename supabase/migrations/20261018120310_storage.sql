-- Bucket de medios: lectura pública, escritura solo del equipo activo.
-- Spec 001 H1 · research D15 · data-model "Políticas RLS" (storage.objects).
-- Los DELETE directos por SQL los bloquea storage.protect_delete(); la Storage
-- API los habilita con storage.allow_delete_query.

insert into storage.buckets (id, name, public)
values ('medios', 'medios', true)
on conflict (id) do nothing;

create policy medios_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'medios');

create policy medios_insert_equipo on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medios' and (select privado.es_equipo()));

create policy medios_update_equipo on storage.objects
  for update to authenticated
  using (bucket_id = 'medios' and (select privado.es_equipo()))
  with check (bucket_id = 'medios' and (select privado.es_equipo()));

create policy medios_delete_equipo on storage.objects
  for delete to authenticated
  using (bucket_id = 'medios' and (select privado.es_equipo()));
