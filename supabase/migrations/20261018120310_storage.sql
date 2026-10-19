-- Bucket de medios: archivos públicos por URL, listado y escritura solo del
-- equipo activo. Solo imágenes de hasta 5 MB (validación A-M3/A-M4).
-- Spec 001 H1 · research D15 · data-model "Políticas RLS" (storage.objects).
-- Los DELETE directos por SQL los bloquea storage.protect_delete(); la Storage
-- API los habilita con storage.allow_delete_query.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medios', 'medios', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Un bucket público sirve sus archivos por URL sin pasar por esta política: el
-- select solo habilita listar, y listar revelaría imágenes de borradores.
create policy medios_select on storage.objects
  for select to authenticated
  using (bucket_id = 'medios' and (select privado.es_equipo()));

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
