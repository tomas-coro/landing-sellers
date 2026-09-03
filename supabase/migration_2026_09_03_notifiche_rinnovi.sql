-- supabase/migration_2026_09_03_notifiche_rinnovi.sql

update public.clienti
set giorni_preavviso_notifica = 7
where giorni_preavviso_notifica is null;

alter table public.clienti
  alter column giorni_preavviso_notifica set default 7,
  alter column giorni_preavviso_notifica set not null;

create index if not exists clienti_rinnovi_notifiche_idx
  on public.clienti (data_rinnovo, giorni_preavviso_notifica)
  where cancellato_il is null
    and data_rinnovo is not null;

comment on column public.clienti.ultimo_rinnovo_notificato is
  'Data di rinnovo per cui la Web Push è stata inviata con successo. Usata per idempotenza.';
