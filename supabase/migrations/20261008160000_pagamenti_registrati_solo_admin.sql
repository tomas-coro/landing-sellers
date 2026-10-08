-- Solo l'admin può correggere o annullare un incasso già registrato.
-- Le implementazioni esistenti restano intatte dietro wrapper autorizzativi.

alter function public.modifica_pagamento_economico(
  uuid, numeric, date, text, text, jsonb, jsonb
) rename to modifica_pagamento_economico_admin_impl;

revoke all on function public.modifica_pagamento_economico_admin_impl(
  uuid, numeric, date, text, text, jsonb, jsonb
) from public, anon, authenticated;

create function public.modifica_pagamento_economico(
  p_pagamento_id uuid,
  p_importo numeric,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_calcolo jsonb default '{}'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if not public.is_admin() then
    raise exception 'Solo l’amministratore può modificare un incasso registrato';
  end if;

  return public.modifica_pagamento_economico_admin_impl(
    p_pagamento_id,
    p_importo,
    p_data_pagamento,
    p_metodo,
    p_note,
    p_calcolo,
    p_partecipanti
  );
end;
$$;

revoke all on function public.modifica_pagamento_economico(
  uuid, numeric, date, text, text, jsonb, jsonb
) from public, anon;

grant execute on function public.modifica_pagamento_economico(
  uuid, numeric, date, text, text, jsonb, jsonb
) to authenticated;

alter function public.annulla_incasso_economico(uuid)
rename to annulla_incasso_economico_admin_impl;

revoke all on function public.annulla_incasso_economico_admin_impl(uuid)
from public, anon, authenticated;

create function public.annulla_incasso_economico(
  p_pagamento_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if not public.is_admin() then
    raise exception 'Solo l’amministratore può annullare un incasso registrato';
  end if;

  return public.annulla_incasso_economico_admin_impl(p_pagamento_id);
end;
$$;

revoke all on function public.annulla_incasso_economico(uuid)
from public, anon;

grant execute on function public.annulla_incasso_economico(uuid)
to authenticated;
