-- Quota di rete: il responsabile diretto (non radice) riceve il 10% della
-- quota effettiva di chi sta sotto. Il venditore non vede mai queste righe.

create table if not exists public.pagamento_quote_rete (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null
    references public.pagamenti(id) on delete cascade,
  da_profilo_id uuid not null references public.profili(id),
  a_profilo_id uuid not null references public.profili(id),
  importo numeric(12,2) not null check (importo > 0),
  ricevuta_il timestamptz,
  creato_il timestamptz not null default now(),
  unique (pagamento_id, da_profilo_id)
);

create index if not exists pagamento_quote_rete_a_idx
  on public.pagamento_quote_rete(a_profilo_id);

alter table public.pagamento_quote_rete enable row level security;

-- Difesa in profondita': scrive solo la funzione security definer.
revoke insert, update, delete on public.pagamento_quote_rete
  from public, anon, authenticated;

-- Legge solo chi riceve. Admin e developer (Alessandro, Tomas) leggono tutto.
-- Stessa definizione di public.is_admin() (ruolo in admin, developer).
drop policy if exists quote_rete_select on public.pagamento_quote_rete;
create policy quote_rete_select on public.pagamento_quote_rete
  for select to authenticated
  using (
    a_profilo_id = auth.uid()
    or exists (
      select 1 from public.profili p
      where p.id = auth.uid() and p.ruolo in ('admin', 'developer')
    )
  );

create or replace function public._applica_quote_rete(p_pagamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Guard: chi cancella i partecipanti deve cancellare anche le righe di rete.
  if exists (
    select 1 from public.pagamento_quote_rete where pagamento_id = p_pagamento_id
  ) then
    raise exception 'Quote di rete gia applicate a questo pagamento';
  end if;

  with candidati as (
    select
      pp.profilo_id as da_id,
      v.responsabile_id as a_id,
      round(pp.quota_effettiva * 0.10, 2) as importo
    from public.pagamento_partecipanti pp
    join public.profili v on v.id = pp.profilo_id
    join public.profili g on g.id = v.responsabile_id
    join public.pagamenti pg on pg.id = pp.pagamento_id
    where pp.pagamento_id = p_pagamento_id
      -- Nessun ricalcolo dello storico: regola valida dal 16/10/2026.
      and coalesce(pg.data_pagamento, pg.creato_il::date) >= date '2026-10-16'
      and pp.quota_effettiva > 0
      and g.responsabile_id is not null
      and not exists (
        select 1 from public.pagamento_partecipanti x
        where x.pagamento_id = p_pagamento_id
          and x.profilo_id = v.responsabile_id
      )
  ),
  inseriti as (
    insert into public.pagamento_quote_rete
      (pagamento_id, da_profilo_id, a_profilo_id, importo)
    select p_pagamento_id, da_id, a_id, importo
    from candidati
    where importo > 0
    returning da_profilo_id, importo
  )
  update public.pagamento_partecipanti pp
  set quota_effettiva = pp.quota_effettiva - i.importo
  from inseriti i
  where pp.pagamento_id = p_pagamento_id
    and pp.profilo_id = i.da_profilo_id;
end;
$$;

revoke all on function public._applica_quote_rete(uuid)
  from public, anon, authenticated;
