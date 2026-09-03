-- supabase/migration_2026_09_03_configuratore_commerciale.sql

alter table public.clienti
  add column if not exists sconto_tipo text,
  add column if not exists sconto_valore numeric not null default 0,
  add column if not exists pagine_extra integer not null default 0,
  add column if not exists lingue_extra integer not null default 0,
  add column if not exists cliente_ha_dominio boolean,
  add column if not exists dominio_it boolean not null default false,
  add column if not exists dominio_com boolean not null default false,
  add column if not exists email_5_caselle boolean not null default false,
  add column if not exists pacchetto_sicurezza boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='clienti_sconto_tipo_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_sconto_tipo_check check (sconto_tipo is null or sconto_tipo in ('percentuale','fisso'));
  end if;
  if not exists (select 1 from pg_constraint where conname='clienti_sconto_valore_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_sconto_valore_check check (sconto_valore >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='clienti_pagine_extra_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_pagine_extra_check check (pagine_extra between 0 and 15);
  end if;
  if not exists (select 1 from pg_constraint where conname='clienti_lingue_extra_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_lingue_extra_check check (lingue_extra between 0 and 5);
  end if;
end $$;
