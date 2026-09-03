-- Modalità notifiche rinnovo.
-- Permette di disattivare gli avvisi e, per i contratti mensili,
-- scegliere tra scadenza mensile, anniversario annuale o entrambe.

alter table public.clienti
  add column if not exists modalita_notifica_rinnovo text,
  add column if not exists ultimo_anniversario_notificato date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clienti_modalita_notifica_rinnovo_check'
      and conrelid = 'public.clienti'::regclass
  ) then
    alter table public.clienti
      add constraint clienti_modalita_notifica_rinnovo_check
      check (
        modalita_notifica_rinnovo is null
        or modalita_notifica_rinnovo in (
          'nessuna',
          'mensile',
          'annuale',
          'entrambe'
        )
      );
  end if;
end $$;

-- Manteniamo il comportamento precedente sui clienti esistenti.
update public.clienti
set modalita_notifica_rinnovo = case
  when periodicita_contratto = 'mensile' then 'mensile'
  when periodicita_contratto = 'annuale' then 'annuale'
  else null
end
where modalita_notifica_rinnovo is null;
