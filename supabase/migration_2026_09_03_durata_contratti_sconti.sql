-- Durata contratto e durata sconto
-- Compatibile con clienti esistenti e prezzi legacy.

alter table public.clienti
  add column if not exists durata_contratto_anni integer,
  add column if not exists sconto_durata_anni integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clienti_durata_contratto_anni_check'
      and conrelid = 'public.clienti'::regclass
  ) then
    alter table public.clienti
      add constraint clienti_durata_contratto_anni_check
      check (
        durata_contratto_anni is null
        or durata_contratto_anni between 1 and 4
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'clienti_sconto_durata_anni_check'
      and conrelid = 'public.clienti'::regclass
  ) then
    alter table public.clienti
      add constraint clienti_sconto_durata_anni_check
      check (
        sconto_durata_anni is null
        or sconto_durata_anni between 1 and 4
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'clienti_sconto_durata_non_superiore_contratto_check'
      and conrelid = 'public.clienti'::regclass
  ) then
    alter table public.clienti
      add constraint clienti_sconto_durata_non_superiore_contratto_check
      check (
        sconto_durata_anni is null
        or durata_contratto_anni is null
        or sconto_durata_anni <= durata_contratto_anni
      );
  end if;
end $$;
