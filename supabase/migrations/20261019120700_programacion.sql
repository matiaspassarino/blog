-- Programación de publicaciones: el cron publica los artículos programados vencidos.
-- Spec 001 · H4 · RF-011, CE-003 · research D6.
-- a40_validar_estado ya asigna publicado_en = programado_para cuando el update no
-- viene de un cliente (el cron corre como postgres), y a30_controlar_version
-- incrementa la versión porque el update es de primer nivel.

create index articulos_programado_para_idx on public.articulos (programado_para) where estado = 'programado';

-- skip locked: si un editor tiene el artículo bloqueado, se publica en la próxima pasada.
create function privado.publicar_programados()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.articulos
  set estado = 'publicado'
  where id in (
    select id
    from public.articulos
    where estado = 'programado' and programado_para <= now()
    for update skip locked
  )
$$;

revoke execute on function privado.publicar_programados() from public, anon, authenticated;

select cron.schedule('publicar-programados', '* * * * *', 'select privado.publicar_programados()');

-- El historial de pg_cron crece con cada pasada por minuto: se guarda una semana.
select cron.schedule(
  'limpiar-historial-cron',
  '0 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
