-- Separa esito commerciale e avanzamento di produzione.

begin;

alter table public.clienti
  add column if not exists stato_produzione text,
  add column if not exists esito_motivazione text,
  add column if not exists prossima_azione text,
  add column if not exists brief_cliente text;

alter table public.clienti
  drop constraint if exists clienti_stato_check;

-- La riclassificazione iniziale non è un'azione dell'utente e non deve
-- sporcare la timeline di ogni cliente.
alter table public.clienti disable trigger trg_registra_attivita_cliente;

update public.clienti
set
  stato_produzione = case stato
    when 'in_lavorazione' then 'in_lavorazione'
    when 'pubblicato' then 'pubblicato'
    else stato_produzione
  end,
  stato = case
    when stato in ('in_lavorazione', 'pubblicato') then 'vinto'
    else stato
  end;

alter table public.clienti enable trigger trg_registra_attivita_cliente;

alter table public.clienti
  drop constraint if exists clienti_stato_produzione_check,
  add constraint clienti_stato_check
  check (stato in ('contattato', 'brief_mandato', 'vinto', 'perso')),
  add constraint clienti_stato_produzione_check
  check (stato_produzione is null or stato_produzione in ('da_avviare', 'in_lavorazione', 'pubblicato'));

create or replace function public.valorizza_pubblicato_il()
returns trigger
language plpgsql
as $$
begin
  if new.stato_produzione = 'pubblicato'
     and old.stato_produzione is distinct from 'pubblicato'
     and new.pubblicato_il is null then
    new.pubblicato_il := now();
  end if;
  return new;
end;
$$;

alter table public.attivita_clienti
  drop constraint if exists attivita_clienti_tipo_check;

alter table public.attivita_clienti
  add constraint attivita_clienti_tipo_check
  check (tipo in (
    'stato', 'stato_produzione', 'prossimo_contatto',
    'prossima_azione', 'brief', 'contatto_completato'
  ));

create or replace function public.registra_attivita_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato is distinct from old.stato then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'stato', old.stato, new.stato);
  end if;

  if new.stato_produzione is distinct from old.stato_produzione then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'stato_produzione', old.stato_produzione, new.stato_produzione);
  end if;

  if new.prossimo_contatto is distinct from old.prossimo_contatto
     and coalesce(current_setting('landing_sellers.contatto_completato', true), '') <> '1' then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'prossimo_contatto', old.prossimo_contatto::text, new.prossimo_contatto::text);
  end if;

  if new.prossima_azione is distinct from old.prossima_azione then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'prossima_azione', old.prossima_azione, new.prossima_azione);
  end if;

  if new.brief_cliente is distinct from old.brief_cliente then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'brief', null, new.brief_cliente);
  end if;

  return new;
end;
$$;

create or replace function public.imposta_stato_cliente(p_cliente_id uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  if p_stato is null or p_stato not in ('contattato', 'brief_mandato', 'vinto', 'perso') then
    raise exception 'Stato non valido';
  end if;
  if not exists (
    select 1 from public.clienti c
    where c.id = p_cliente_id and (
      c.venditore_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.profili p where p.id = auth.uid() and p.ruolo_economico in ('referente', 'produzione'))
      or exists (select 1 from public.vendite v where v.cliente_id = c.id and v.venditore_id = auth.uid())
    )
  ) then raise exception 'Cliente non accessibile'; end if;

  update public.clienti
  set stato = p_stato,
      stato_produzione = case
        when p_stato = 'vinto' then coalesce(stato_produzione, 'da_avviare')
        else null
      end
  where id = p_cliente_id;
end;
$$;

create or replace function public.imposta_stato_produzione(p_cliente_id uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  if p_stato is null or p_stato not in ('da_avviare', 'in_lavorazione', 'pubblicato') then
    raise exception 'Stato produzione non valido';
  end if;
  if not exists (
    select 1 from public.clienti c
    where c.id = p_cliente_id and c.stato = 'vinto' and (
      c.venditore_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.profili p where p.id = auth.uid() and p.ruolo_economico in ('referente', 'produzione'))
      or exists (select 1 from public.vendite v where v.cliente_id = c.id and v.venditore_id = auth.uid())
    )
  ) then raise exception 'Cliente non accessibile o non vinto'; end if;

  update public.clienti set stato_produzione = p_stato where id = p_cliente_id;
end;
$$;

revoke all on function public.imposta_stato_produzione(uuid, text) from public, anon;
grant execute on function public.imposta_stato_produzione(uuid, text) to authenticated;

commit;
