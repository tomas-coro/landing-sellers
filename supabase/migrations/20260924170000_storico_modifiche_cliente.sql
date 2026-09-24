-- Estende lo storico cliente con prezzo e scadenza di rinnovo.

alter table public.attivita_clienti
  drop constraint if exists attivita_clienti_tipo_check;

alter table public.attivita_clienti
  add constraint attivita_clienti_tipo_check
  check (tipo in (
    'stato', 'stato_produzione', 'prossimo_contatto',
    'prossima_azione', 'brief', 'contatto_completato',
    'prezzo', 'scadenza'
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

  if new.importo_abbonamento is distinct from old.importo_abbonamento then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'prezzo', old.importo_abbonamento::text, new.importo_abbonamento::text);
  end if;

  if new.data_rinnovo is distinct from old.data_rinnovo then
    insert into public.attivita_clienti (cliente_id, attore_id, tipo, valore_precedente, valore_nuovo)
    values (new.id, auth.uid(), 'scadenza', old.data_rinnovo::text, new.data_rinnovo::text);
  end if;

  return new;
end;
$$;
