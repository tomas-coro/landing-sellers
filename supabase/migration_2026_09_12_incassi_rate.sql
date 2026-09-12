-- Incassi separati dalle vendite e rate previste.

create or replace function public.registra_pagamento_vendita(
  p_vendita_id uuid,
  p_importo numeric,
  p_stato text,
  p_data_scadenza date default null,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_pagamento_previsto_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pagamento_id uuid;
  v_totale numeric(12,2);
  v_incassato numeric(12,2);
begin
  if v_user is null then raise exception 'Utente non autenticato'; end if;
  if p_stato not in ('previsto', 'incassato') then raise exception 'Stato pagamento non valido'; end if;
  if coalesce(p_importo, 0) <= 0 then raise exception 'Importo pagamento non valido'; end if;
  if p_stato = 'previsto' and p_data_scadenza is null then raise exception 'Scadenza rata mancante'; end if;

  select v.importo_vendita into v_totale
  from public.vendite v
  where v.id = p_vendita_id
    and v.stato = 'attiva'
    and (
      v.venditore_id = v_user
      or v.creato_da = v_user
      or public.is_admin()
    )
  for update;

  if v_totale is null then raise exception 'Vendita attiva non disponibile'; end if;

  select coalesce(sum(p.importo), 0) into v_incassato
  from public.pagamenti p
  where p.vendita_id = p_vendita_id
    and p.stato in ('previsto', 'incassato')
    and p.id is distinct from p_pagamento_previsto_id;

  if v_incassato + p_importo > v_totale then
    raise exception 'Importo superiore al residuo';
  end if;

  if p_pagamento_previsto_id is not null then
    update public.pagamenti
    set importo = p_importo,
        stato = p_stato,
        incassato_da = case when p_stato = 'incassato' then v_user else null end,
        data_scadenza = coalesce(p_data_scadenza, data_scadenza),
        data_pagamento = case when p_stato = 'incassato' then coalesce(p_data_pagamento, current_date) else null end,
        metodo = nullif(trim(p_metodo), ''),
        note = nullif(trim(p_note), '')
    where id = p_pagamento_previsto_id
      and vendita_id = p_vendita_id
      and stato = 'previsto'
    returning id into v_pagamento_id;

    if v_pagamento_id is null then raise exception 'Rata prevista non disponibile'; end if;
  else
    insert into public.pagamenti (
      vendita_id, incassato_da, creato_da, importo, stato,
      data_scadenza, data_pagamento, metodo, note
    ) values (
      p_vendita_id,
      case when p_stato = 'incassato' then v_user else null end,
      v_user,
      p_importo,
      p_stato,
      p_data_scadenza,
      case when p_stato = 'incassato' then coalesce(p_data_pagamento, current_date) else null end,
      nullif(trim(p_metodo), ''),
      nullif(trim(p_note), '')
    ) returning id into v_pagamento_id;
  end if;

  return v_pagamento_id;
end;
$$;

revoke all on function public.registra_pagamento_vendita(uuid, numeric, text, date, date, text, text, uuid)
from public, anon;

grant execute on function public.registra_pagamento_vendita(uuid, numeric, text, date, date, text, text, uuid)
to authenticated;
