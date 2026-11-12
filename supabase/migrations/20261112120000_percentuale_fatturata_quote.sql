create or replace function public.percentuali_fatturate_pagamenti(p_pagamento_ids uuid[])
returns table (pagamento_id uuid, percentuale_fatturata numeric)
language sql
stable
security definer
set search_path = public
as $$
  select pc.pagamento_id, pc.percentuale_fatturata_admin
  from public.pagamento_calcoli pc
  join public.pagamenti p on p.id = pc.pagamento_id
  join public.vendite v on v.id = p.vendita_id
  where pc.pagamento_id = any(p_pagamento_ids)
    and auth.uid() is not null
    and (
      public.is_admin()
      or v.venditore_id = auth.uid()
      or v.creato_da = auth.uid()
      or p.incassato_da = auth.uid()
      or exists (
        select 1
        from public.pagamento_partecipanti pp
        where pp.pagamento_id = p.id
          and pp.profilo_id = auth.uid()
      )
    );
$$;

revoke all on function public.percentuali_fatturate_pagamenti(uuid[]) from public, anon;
grant execute on function public.percentuali_fatturate_pagamenti(uuid[]) to authenticated;
