-- supabase/migration_2026_09_03_rinnovi_contratti.sql

create extension if not exists pg_cron with schema extensions;

alter table public.clienti
  add column if not exists data_attivazione date,
  add column if not exists periodicita_contratto text,
  add column if not exists giorni_preavviso_notifica integer not null default 7,
  add column if not exists ultimo_rinnovo_notificato date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clienti_periodicita_contratto_check'
      and conrelid = 'public.clienti'::regclass
  ) then
    alter table public.clienti
      add constraint clienti_periodicita_contratto_check
      check (periodicita_contratto is null or periodicita_contratto in ('mensile','annuale'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clienti_preavviso_rinnovo_check'
      and conrelid = 'public.clienti'::regclass
  ) then
    alter table public.clienti
      add constraint clienti_preavviso_rinnovo_check
      check (giorni_preavviso_notifica in (30,7,2,1));
  end if;
end $$;

-- I clienti già creati con il catalogo nuovo possono ricevere automaticamente
-- la periodicità. I prezzi storici/custom restano intenzionalmente null.
update public.clienti
set periodicita_contratto = case
  when nome_pacchetto = 'Start mensile' then 'mensile'
  when nome_pacchetto = 'Start annuale' then 'annuale'
  else periodicita_contratto
end
where periodicita_contratto is null;

-- Calcola il prossimo rinnovo rispetto a una data di riferimento mantenendo
-- come ancora il giorno originale di attivazione (es. 31 gennaio -> 28/29 febbraio -> 31 marzo).
create or replace function public.calcola_prossimo_rinnovo(
  p_data_attivazione date,
  p_periodicita text,
  p_riferimento date default current_date
)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_n integer := 1;
  v_candidate date;
  v_year integer;
  v_month integer;
  v_last_day integer;
  v_day integer;
begin
  if p_data_attivazione is null or p_periodicita not in ('mensile','annuale') then
    return null;
  end if;

  loop
    if p_periodicita = 'mensile' then
      v_year := extract(year from p_data_attivazione)::integer
        + ((extract(month from p_data_attivazione)::integer - 1 + v_n) / 12);
      v_month := ((extract(month from p_data_attivazione)::integer - 1 + v_n) % 12) + 1;
    else
      v_year := extract(year from p_data_attivazione)::integer + v_n;
      v_month := extract(month from p_data_attivazione)::integer;
    end if;

    v_last_day := extract(
      day from (
        make_date(v_year, v_month, 1)
        + interval '1 month'
        - interval '1 day'
      )
    )::integer;

    v_day := least(extract(day from p_data_attivazione)::integer, v_last_day);
    v_candidate := make_date(v_year, v_month, v_day);

    if v_candidate >= p_riferimento then
      return v_candidate;
    end if;

    v_n := v_n + 1;

    if v_n > 2400 then
      raise exception 'impossibile calcolare il prossimo rinnovo';
    end if;
  end loop;
end;
$$;

create or replace function public.sincronizza_rinnovi()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.clienti
  set data_rinnovo = public.calcola_prossimo_rinnovo(
    data_attivazione,
    periodicita_contratto,
    current_date
  )
  where cancellato_il is null
    and data_attivazione is not null
    and periodicita_contratto in ('mensile','annuale')
    and data_rinnovo is distinct from public.calcola_prossimo_rinnovo(
      data_attivazione,
      periodicita_contratto,
      current_date
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.sincronizza_rinnovi() from public, anon, authenticated;

create or replace function public.aggiorna_rinnovo_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data_attivazione is not null
     and new.periodicita_contratto in ('mensile','annuale') then
    new.data_rinnovo := public.calcola_prossimo_rinnovo(
      new.data_attivazione,
      new.periodicita_contratto,
      current_date
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aggiorna_rinnovo_cliente on public.clienti;
create trigger trg_aggiorna_rinnovo_cliente
before insert or update of data_attivazione, periodicita_contratto
on public.clienti
for each row
execute function public.aggiorna_rinnovo_cliente();

-- Aggiornamento automatico quotidiano del prossimo rinnovo.
-- Il job non invia ancora notifiche: quello verrà collegato nella Fase F.
select cron.schedule(
  'landing-sellers-sync-rinnovi',
  '15 2 * * *',
  $$select public.sincronizza_rinnovi();$$
);
