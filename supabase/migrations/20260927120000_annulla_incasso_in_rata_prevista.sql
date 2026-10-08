-- Annulla un incasso senza perdere la scadenza: torna a essere una rata
-- prevista, pronta per Agenda/Home e per una successiva registrazione.
create or replace function public.annulla_incasso_economico(
  p_pagamento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pagamento_id uuid;
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  select p.id
  into v_pagamento_id
  from public.pagamenti p
  join public.vendite v on v.id = p.vendita_id
  where p.id = p_pagamento_id
    and p.stato = 'incassato'
    and (
      v.venditore_id = v_user
      or v.creato_da = v_user
      or public.is_admin()
    )
  for update of p;

  if v_pagamento_id is null then
    raise exception 'Incasso non disponibile';
  end if;

  delete from public.pagamento_partecipanti
  where pagamento_id = v_pagamento_id;

  delete from public.pagamento_calcoli
  where pagamento_id = v_pagamento_id;

  update public.pagamenti
  set stato = 'previsto',
      data_scadenza = coalesce(data_scadenza, data_pagamento, current_date),
      data_pagamento = null,
      metodo = null,
      incassato_da = null
  where id = v_pagamento_id;

  return v_pagamento_id;
end;
$$;

revoke all on function public.annulla_incasso_economico(uuid)
from public, anon;

grant execute on function public.annulla_incasso_economico(uuid)
to authenticated;
