-- Permette al destinatario di annullare una conferma di ricezione data per
-- errore (tap accidentale sulla riga "Quote da confermare"), senza dover
-- intervenire a mano sul database.

create or replace function public.annulla_conferma_quota_pagamento(
  p_pagamento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_partecipanti pp
  set ricevuta_il = null
  from public.pagamenti p
  where pp.pagamento_id = p.id
    and pp.pagamento_id = p_pagamento_id
    and pp.profilo_id = auth.uid()
    and pp.quota_effettiva > 0
    and pp.ricevuta_il is not null
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning pp.id into v_quota_id;

  if v_quota_id is null then
    raise exception 'Conferma da annullare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.annulla_conferma_quota_pagamento(uuid)
from public, anon;

grant execute on function public.annulla_conferma_quota_pagamento(uuid)
to authenticated;
