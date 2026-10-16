-- Conferma lato gestore della quota di rete (10%): il gestore destinatario
-- conferma di aver ricevuto la quota, o annulla una conferma data per errore.
-- Stesso schema di conferma_quota_pagamento / annulla_conferma_quota_pagamento,
-- ma su pagamento_quote_rete con a_profilo_id = auth.uid().

create or replace function public.conferma_quota_rete(p_pagamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_quote_rete q
  set ricevuta_il = now()
  from public.pagamenti p
  where q.pagamento_id = p.id
    and q.pagamento_id = p_pagamento_id
    and q.a_profilo_id = auth.uid()
    and q.ricevuta_il is null
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning q.id into v_id;

  if v_id is null then
    raise exception 'Quota di rete da confermare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.conferma_quota_rete(uuid)
from public, anon;

grant execute on function public.conferma_quota_rete(uuid)
to authenticated;

create or replace function public.annulla_conferma_quota_rete(p_pagamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.pagamento_quote_rete q
  set ricevuta_il = null
  from public.pagamenti p
  where q.pagamento_id = p.id
    and q.pagamento_id = p_pagamento_id
    and q.a_profilo_id = auth.uid()
    and q.ricevuta_il is not null
    and p.stato = 'incassato'
    and p.incassato_da is distinct from auth.uid()
  returning q.id into v_id;

  if v_id is null then
    raise exception 'Conferma da annullare non disponibile';
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.annulla_conferma_quota_rete(uuid)
from public, anon;

grant execute on function public.annulla_conferma_quota_rete(uuid)
to authenticated;
