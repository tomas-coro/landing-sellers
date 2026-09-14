-- Landing Sellers
-- Snapshot economico per singolo pagamento/rata.
--
-- NON modifica vendita_partecipanti:
-- quella tabella continua a rappresentare lo snapshot complessivo
-- della vendita.
--
-- Queste tabelle rappresentano invece la ripartizione economica
-- effettiva di ogni singolo pagamento incassato.

-- ============================================================
-- CALCOLO ECONOMICO DEL PAGAMENTO
-- ============================================================

create table if not exists public.pagamento_calcoli (
  id uuid primary key default gen_random_uuid(),

  pagamento_id uuid not null
    references public.pagamenti(id) on delete cascade,

  importo_pagamento numeric(12,2) not null
    check (importo_pagamento > 0),

  -- Costi imputati specificamente a questa rata.
  importo_costi numeric(12,2) not null default 0
    check (importo_costi >= 0),

  margine numeric(12,2) not null
    check (margine >= 0),

  -- Percentuale fiscale determinata dal motore economico.
  percentuale_tasse numeric(5,2) not null default 0
    check (
      percentuale_tasse >= 0
      and percentuale_tasse <= 100
    ),

  -- Quanta parte dell'incasso cliente è stata fatturata
  -- dal referente/admin.
  percentuale_fatturata_admin numeric(5,2) not null default 0
    check (
      percentuale_fatturata_admin >= 0
      and percentuale_fatturata_admin <= 100
    ),

  -- Imposte sostenute materialmente dal referente/admin.
  importo_tasse numeric(12,2) not null default 0
    check (importo_tasse >= 0),

  netto_distribuibile numeric(12,2) not null default 0
    check (netto_distribuibile >= 0),

  -- Snapshot leggibile dei costi applicati alla rata.
  costi_snapshot jsonb not null default '[]'::jsonb,

  creato_il timestamptz not null default now(),

  unique (pagamento_id)
);

create index if not exists pagamento_calcoli_pagamento_id_idx
  on public.pagamento_calcoli(pagamento_id);


-- ============================================================
-- PARTECIPANTI DEL SINGOLO PAGAMENTO
-- ============================================================

create table if not exists public.pagamento_partecipanti (
  id uuid primary key default gen_random_uuid(),

  pagamento_id uuid not null
    references public.pagamenti(id) on delete cascade,

  profilo_id uuid not null
    references public.profili(id),

  ruolo text,

  modalita_fatturazione text not null default 'nessuna'
    check (
      modalita_fatturazione in ('nessuna', 'mista', 'totale')
    ),

  importo_fatturato numeric(12,2) not null default 0
    check (importo_fatturato >= 0),

  quota_base numeric(12,2) not null default 0
    check (quota_base >= 0),

  quota_teorica numeric(12,2) not null default 0
    check (quota_teorica >= 0),

  percentuale_riduzione numeric(5,2) not null default 0
    check (
      percentuale_riduzione >= 0
      and percentuale_riduzione <= 100
    ),

  importo_riduzione numeric(12,2) not null default 0
    check (importo_riduzione >= 0),

  bonus_admin numeric(12,2) not null default 0
    check (bonus_admin >= 0),

  quota_calcolata numeric(12,2) not null default 0
    check (quota_calcolata >= 0),

  quota_effettiva numeric(12,2) not null default 0
    check (quota_effettiva >= 0),

  quota_override boolean not null default false,

  note_quota text,

  creato_il timestamptz not null default now(),

  unique (pagamento_id, profilo_id)
);

create index if not exists pagamento_partecipanti_pagamento_id_idx
  on public.pagamento_partecipanti(pagamento_id);

create index if not exists pagamento_partecipanti_profilo_id_idx
  on public.pagamento_partecipanti(profilo_id);


-- ============================================================
-- RLS
-- ============================================================

alter table public.pagamento_calcoli enable row level security;
alter table public.pagamento_partecipanti enable row level security;


-- CALCOLO PAGAMENTO ------------------------------------------

drop policy if exists pagamento_calcoli_select
  on public.pagamento_calcoli;

create policy pagamento_calcoli_select
on public.pagamento_calcoli
for select using (
  exists (
    select 1
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_calcoli.pagamento_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamento_calcoli_insert
  on public.pagamento_calcoli;

create policy pagamento_calcoli_insert
on public.pagamento_calcoli
for insert with check (
  exists (
    select 1
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_calcoli.pagamento_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamento_calcoli_update
  on public.pagamento_calcoli;

create policy pagamento_calcoli_update
on public.pagamento_calcoli
for update using (
  exists (
    select 1
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_calcoli.pagamento_id
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
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_calcoli.pagamento_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


-- PARTECIPANTI PAGAMENTO -------------------------------------

drop policy if exists pagamento_partecipanti_select
  on public.pagamento_partecipanti;

create policy pagamento_partecipanti_select
on public.pagamento_partecipanti
for select using (
  profilo_id = auth.uid()
  or exists (
    select 1
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_partecipanti.pagamento_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamento_partecipanti_insert
  on public.pagamento_partecipanti;

create policy pagamento_partecipanti_insert
on public.pagamento_partecipanti
for insert with check (
  exists (
    select 1
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_partecipanti.pagamento_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);


drop policy if exists pagamento_partecipanti_update
  on public.pagamento_partecipanti;

create policy pagamento_partecipanti_update
on public.pagamento_partecipanti
for update using (
  exists (
    select 1
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_partecipanti.pagamento_id
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
    from public.pagamenti p
    join public.vendite v on v.id = p.vendita_id
    where p.id = pagamento_partecipanti.pagamento_id
      and (
        v.venditore_id = auth.uid()
        or v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);

