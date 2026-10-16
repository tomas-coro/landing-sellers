-- Annulla una vendita registrata ma non ancora incassata, cosi' il cliente
-- puo' averne una nuova (es. rateizzazione scelta dopo la registrazione).
-- La vendita non viene cancellata: passa a 'annullata' e resta nello storico.
-- Se esiste anche un solo incasso registrato, l'annullamento e' bloccato:
-- quegli incassi hanno gia' generato quote e vanno annullati a mano prima.
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

  -- Blocca la riga: due annullamenti simultanei non si sovrappongono.
  select v.id
  into v_vendita_id
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
    raise exception 'Vendita non disponibile o non hai i permessi per annullarla';
  end if;

  if exists (
    select 1
    from public.pagamenti p
    where p.vendita_id = v_vendita_id
      and p.stato = 'incassato'
  ) then
    raise exception 'Questa vendita ha incassi registrati: annulla prima gli incassi';
  end if;

  -- Le rate previste non vanno piu' incassate.
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
