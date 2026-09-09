-- Landing Sellers
-- CRM economico: vendite, costi, partecipanti e pagamenti.
--
-- Il database salva i dati e il risultato dei calcoli.
-- Le regole fiscali/percentuali vengono gestite dall'app,
-- così non hardcodiamo logiche commerciali ancora in evoluzione.
--
-- Struttura:
-- cliente
--   -> vendita
--      -> costi vendita
--      -> partecipanti / quote
--      -> pagamenti / rate

create table if not exists public.vendite (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null
    references public.clienti(id) on delete cascade,

  -- Chi ha venduto commercialmente il servizio.
  venditore_id uuid not null
    references public.profili(id),

  -- Admin economico della vendita.
  -- L'app lo assegna automaticamente al profilo admin.
  admin_id uuid not null
    references public.profili(id),

  creato_da uuid not null
    references public.profili(id),

  servizio text not null,
  descrizione text,

  importo_vendita numeric(12,2) not null
    check (importo_vendita > 0),

  stato text not null default 'attiva'
    check (stato in ('attiva', 'annullata')),

  data_vendita date not null default current_date,

  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create index if not exists vendite_cliente_id_idx
  on public.vendite(cliente_id);

create index if not exists vendite_venditore_id_idx
  on public.vendite(venditore_id);

create index if not exists vendite_admin_id_idx
  on public.vendite(admin_id);

create index if not exists vendite_data_vendita_idx
  on public.vendite(data_vendita);


-- ============================================================
-- COSTI DELLA VENDITA
-- ============================================================

create table if not exists public.costi_vendita (
  id uuid primary key default gen_random_uuid(),

  vendita_id uuid not null
    references public.vendite(id) on delete cascade,

  descrizione text not null,

  importo numeric(12,2) not null
    check (importo >= 0),

  creato_il timestamptz not null default now()
);

create index if not exists costi_vendita_vendita_id_idx
  on public.costi_vendita(vendita_id);


-- ============================================================
-- RIPARTIZIONE ECONOMICA
-- ============================================================
--
-- I valori vengono salvati come "snapshot" del calcolo effettuato.
-- In questo modo, se in futuro cambiano percentuali o regole,
-- le vendite storiche mantengono i valori originali.

create table if not exists public.vendita_partecipanti (
  id uuid primary key default gen_random_uuid(),

  vendita_id uuid not null
    references public.vendite(id) on delete cascade,

  profilo_id uuid not null
    references public.profili(id),

  ruolo text,

  fa_fattura boolean not null default true,

  -- Quota iniziale prima delle correzioni fiscali.
  quota_base numeric(12,2) not null
    check (quota_base >= 0),

  -- Eventuale tassazione applicata a questa quota.
  percentuale_tasse numeric(5,2) not null default 0
    check (
      percentuale_tasse >= 0
      and percentuale_tasse <= 100
    ),

  importo_tasse numeric(12,2) not null default 0
    check (importo_tasse >= 0),

  -- Eventuale riduzione, ad esempio per collaboratore senza fattura.
  percentuale_riduzione numeric(5,2) not null default 0
    check (
      percentuale_riduzione >= 0
      and percentuale_riduzione <= 100
    ),

  importo_riduzione numeric(12,2) not null default 0
    check (importo_riduzione >= 0),

  -- Parte della riduzione eventualmente attribuita all'admin.
  importo_trasferito_admin numeric(12,2) not null default 0
    check (importo_trasferito_admin >= 0),

  quota_finale numeric(12,2) not null
    check (quota_finale >= 0),

  -- Tracciamo anche se la quota è stata effettivamente corrisposta.
  saldato boolean not null default false,
  data_saldo date,

  creato_il timestamptz not null default now(),

  unique (vendita_id, profilo_id)
);

create index if not exists vendita_partecipanti_vendita_id_idx
  on public.vendita_partecipanti(vendita_id);

create index if not exists vendita_partecipanti_profilo_id_idx
  on public.vendita_partecipanti(profilo_id);


-- ============================================================
-- PAGAMENTI / RATE DEL CLIENTE
-- ============================================================
--
-- Una vendita può avere:
-- - nessun pagamento -> non pagata
-- - alcuni pagamenti -> parziale
-- - totale pagamenti >= importo vendita -> pagata
--
-- Lo stato economico della vendita sarà quindi calcolabile
-- senza duplicare informazioni nella tabella vendite.

create table if not exists public.pagamenti (
  id uuid primary key default gen_random_uuid(),

  vendita_id uuid not null
    references public.vendite(id) on delete cascade,

  incassato_da uuid
    references public.profili(id),

  creato_da uuid not null
    references public.profili(id),

  importo numeric(12,2) not null
    check (importo > 0),

  stato text not null default 'incassato'
    check (stato in ('previsto', 'incassato', 'annullato')),

  data_scadenza date,
  data_pagamento date,

  metodo text,
  note text,

  creato_il timestamptz not null default now()
);

create index if not exists pagamenti_vendita_id_idx
  on public.pagamenti(vendita_id);

create index if not exists pagamenti_data_scadenza_idx
  on public.pagamenti(data_scadenza);

create index if not exists pagamenti_data_pagamento_idx
  on public.pagamenti(data_pagamento);


-- ============================================================
-- RLS
-- ============================================================

alter table public.vendite enable row level security;
alter table public.costi_vendita enable row level security;
alter table public.vendita_partecipanti enable row level security;
alter table public.pagamenti enable row level security;


-- VENDITE ----------------------------------------------------

drop policy if exists vendite_select on public.vendite;

create policy vendite_select on public.vendite
for select using (
  venditore_id = auth.uid()
  or creato_da = auth.uid()
  or public.is_admin()
);


drop policy if exists vendite_insert on public.vendite;

create policy vendite_insert on public.vendite
for insert with check (
  creato_da = auth.uid()
  and (
    venditore_id = auth.uid()
    or public.is_admin()
  )
);


drop policy if exists vendite_update on public.vendite;

create policy vendite_update on public.vendite
for update using (
  venditore_id = auth.uid()
  or creato_da = auth.uid()
  or public.is_admin()
)
with check (
  venditore_id = auth.uid()
  or creato_da = auth.uid()
  or public.is_admin()
);


drop policy if exists vendite_delete on public.vendite;

create policy vendite_delete on public.vendite
for delete using (
  creato_da = auth.uid()
  or public.is_admin()
);


-- COSTI ------------------------------------------------------

drop policy if exists costi_vendita_all on public.costi_vendita;

create policy costi_vendita_all on public.costi_vendita
for all
using (
  exists (
    select 1
    from public.vendite v
    where v.id = costi_vendita.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.vendite v
    where v.id = costi_vendita.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


-- PARTECIPANTI -----------------------------------------------

drop policy if exists vendita_partecipanti_select
  on public.vendita_partecipanti;

create policy vendita_partecipanti_select
on public.vendita_partecipanti
for select using (
  profilo_id = auth.uid()
  or exists (
    select 1
    from public.vendite v
    where v.id = vendita_partecipanti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists vendita_partecipanti_insert
  on public.vendita_partecipanti;

create policy vendita_partecipanti_insert
on public.vendita_partecipanti
for insert with check (
  exists (
    select 1
    from public.vendite v
    where v.id = vendita_partecipanti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists vendita_partecipanti_update
  on public.vendita_partecipanti;

create policy vendita_partecipanti_update
on public.vendita_partecipanti
for update using (
  exists (
    select 1
    from public.vendite v
    where v.id = vendita_partecipanti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists vendita_partecipanti_delete
  on public.vendita_partecipanti;

create policy vendita_partecipanti_delete
on public.vendita_partecipanti
for delete using (
  exists (
    select 1
    from public.vendite v
    where v.id = vendita_partecipanti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


-- PAGAMENTI --------------------------------------------------

drop policy if exists pagamenti_select on public.pagamenti;

create policy pagamenti_select on public.pagamenti
for select using (
  exists (
    select 1
    from public.vendite v
    where v.id = pagamenti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamenti_insert on public.pagamenti;

create policy pagamenti_insert on public.pagamenti
for insert with check (
  creato_da = auth.uid()
  and exists (
    select 1
    from public.vendite v
    where v.id = pagamenti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamenti_update on public.pagamenti;

create policy pagamenti_update on public.pagamenti
for update using (
  exists (
    select 1
    from public.vendite v
    where v.id = pagamenti.vendita_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamenti_delete on public.pagamenti;

create policy pagamenti_delete on public.pagamenti
for delete using (
  exists (
    select 1
    from public.vendite v
    where v.id = pagamenti.vendita_id
      and (
        v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


-- ============================================================
-- PERSONE UTILIZZABILI NELLA RIPARTIZIONE
-- ============================================================
--
-- La normale RLS di public.profili non consente ai venditori
-- di leggere tutti gli altri profili.
--
-- Espone soltanto i dati minimi necessari:
-- id, nome, username, ruolo.

create or replace function public.get_partecipanti_economici()
returns table (
  id uuid,
  nome text,
  username text,
  ruolo text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.nome,
    p.username,
    p.ruolo
  from public.profili p
  order by
    case when p.ruolo = 'admin' then 0 else 1 end,
    p.nome nulls last,
    p.username nulls last;
$$;

revoke all
on function public.get_partecipanti_economici()
from public, anon;

grant execute
on function public.get_partecipanti_economici()
to authenticated;
