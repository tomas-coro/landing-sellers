-- Landing Sellers
-- Il venditore MODIFICA una vendita ma non puo' annullarla: l'annullamento
-- e' riservato all'admin (public.is_admin()).
--  1. annulla_vendita: solo admin.
--  2. sostituisci_vendita: modifica = la vendita senza incassi viene annullata
--     e riregistrata con i nuovi dati nella stessa transazione. La vecchia resta
--     nello storico come 'annullata'. Il resto (quote, rate, snapshot) lo rifa'
--     registra_vendita_con_trasferimenti, cioe' lo stesso motore della
--     registrazione originale.
--  3. sposta_cliente_nel_cestino: un non-admin non puo' eliminare un cliente
--     con vendita attiva (sarebbe un annullamento indiretto).

create or replace function public.annulla_vendita(
  p_vendita_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_vendita_id uuid;
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  if not public.is_admin() then
    raise exception 'Solo l''admin puo'' annullare una vendita: puoi modificarla oppure chiedere all''admin';
  end if;

  select v.id
  into v_vendita_id
  from public.vendite v
  where v.id = p_vendita_id
    and v.stato = 'attiva'
  for update of v;

  if v_vendita_id is null then
    raise exception 'Vendita non disponibile';
  end if;

  if exists (
    select 1
    from public.pagamenti p
    where p.vendita_id = v_vendita_id
      and p.stato = 'incassato'
  ) then
    raise exception 'Questa vendita ha incassi registrati: annulla prima gli incassi';
  end if;

  update public.pagamenti
  set stato = 'annullato'
  where vendita_id = v_vendita_id
    and stato = 'previsto';

  update public.vendite
  set stato = 'annullata',
      aggiornato_il = now()
  where id = v_vendita_id;

  return v_vendita_id;
end;
$$;

revoke all on function public.annulla_vendita(uuid) from public, anon;
grant execute on function public.annulla_vendita(uuid) to authenticated;


create or replace function public.sostituisci_vendita(
  p_vendita_id uuid,
  p_vendita jsonb,
  p_configurazione jsonb,
  p_costi jsonb,
  p_partecipanti jsonb,
  p_pagamento jsonb,
  p_rate_previste jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_vendita_id uuid;
  v_cliente_id uuid;
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  -- Blocca la riga: due modifiche simultanee non si sovrappongono.
  select v.id, v.cliente_id
  into v_vendita_id, v_cliente_id
  from public.vendite v
  where v.id = p_vendita_id
    and v.stato = 'attiva'
    and (
      v.venditore_id = v_user
      or v.creato_da = v_user
      or public.is_admin()
    )
  for update of v;

  if v_vendita_id is null then
    raise exception 'Vendita non disponibile o non hai i permessi per modificarla';
  end if;

  if (p_vendita ->> 'cliente_id')::uuid is distinct from v_cliente_id then
    raise exception 'La modifica deve restare sullo stesso cliente';
  end if;

  if exists (
    select 1
    from public.pagamenti p
    where p.vendita_id = v_vendita_id
      and p.stato = 'incassato'
  ) then
    raise exception 'Questa vendita ha incassi registrati: non si puo'' piu'' modificare';
  end if;

  update public.pagamenti
  set stato = 'annullato'
  where vendita_id = v_vendita_id
    and stato = 'previsto';

  update public.vendite
  set stato = 'annullata',
      aggiornato_il = now()
  where id = v_vendita_id;

  -- Stessa transazione: se la nuova registrazione fallisce, la vecchia
  -- vendita torna attiva da sola (rollback).
  return public.registra_vendita_con_trasferimenti(
    p_vendita,
    p_configurazione,
    p_costi,
    p_partecipanti,
    p_pagamento,
    p_rate_previste
  );
end;
$$;

revoke all on function public.sostituisci_vendita(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.sostituisci_vendita(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;


create or replace function public.sposta_cliente_nel_cestino(
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if not exists (
    select 1
    from public.clienti c
    where c.id = p_cliente_id
      and (
        c.venditore_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in ('referente', 'produzione')
        )
        or exists (
          select 1
          from public.vendite v
          where v.cliente_id = c.id
            and v.venditore_id = auth.uid()
        )
      )
  ) then
    raise exception 'Cliente non accessibile';
  end if;

  perform 1
  from public.vendite v
  where v.cliente_id = p_cliente_id
    and v.stato = 'attiva'
  for update of v;

  if not public.is_admin() and exists (
    select 1
    from public.vendite v
    where v.cliente_id = p_cliente_id
      and v.stato = 'attiva'
  ) then
    raise exception 'Questo cliente ha una vendita attiva: chiedi all''admin di eliminarlo';
  end if;

  if exists (
    select 1
    from public.vendite v
    join public.pagamenti pg on pg.vendita_id = v.id
    where v.cliente_id = p_cliente_id
      and v.stato = 'attiva'
      and pg.stato = 'incassato'
  ) then
    raise exception 'Questo cliente ha incassi registrati: annulla prima gli incassi, poi eliminalo';
  end if;

  update public.pagamenti
  set stato = 'annullato'
  where stato = 'previsto'
    and vendita_id in (
      select v.id
      from public.vendite v
      where v.cliente_id = p_cliente_id
        and v.stato = 'attiva'
    );

  update public.vendite
  set stato = 'annullata',
      aggiornato_il = now()
  where cliente_id = p_cliente_id
    and stato = 'attiva';

  update public.clienti
  set cancellato_il = now()
  where id = p_cliente_id
    and cancellato_il is null;
end;
$$;

revoke all
on function public.sposta_cliente_nel_cestino(uuid)
from public, anon;

grant execute
on function public.sposta_cliente_nel_cestino(uuid)
to authenticated;
