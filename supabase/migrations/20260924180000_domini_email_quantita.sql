-- Landing Sellers
-- Permette più di un dominio/pacchetto email per cliente: da booleano a quantità
-- (stesso pattern già usato per pagine_extra/lingue_extra).

alter table public.clienti
  alter column dominio_it drop default,
  alter column dominio_it type integer using (case when dominio_it then 1 else 0 end),
  alter column dominio_it set default 0,
  alter column dominio_it set not null;

alter table public.clienti
  alter column dominio_com drop default,
  alter column dominio_com type integer using (case when dominio_com then 1 else 0 end),
  alter column dominio_com set default 0,
  alter column dominio_com set not null;

alter table public.clienti
  alter column email_5_caselle drop default,
  alter column email_5_caselle type integer using (case when email_5_caselle then 1 else 0 end),
  alter column email_5_caselle set default 0,
  alter column email_5_caselle set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='clienti_dominio_it_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_dominio_it_check check (dominio_it between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname='clienti_dominio_com_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_dominio_com_check check (dominio_com between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname='clienti_email_5_caselle_check' and conrelid='public.clienti'::regclass) then
    alter table public.clienti add constraint clienti_email_5_caselle_check check (email_5_caselle between 0 and 10);
  end if;
end $$;
