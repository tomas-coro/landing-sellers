-- Landing Sellers
-- Timeline CRM cliente.
-- Registra solo eventi che non hanno già uno storico proprio:
-- cambio stato e modifica prossimo contatto.

create table if not exists public.attivita_clienti (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid not null
    references public.clienti(id) on delete cascade,

  attore_id uuid
    references public.profili(id),

  tipo text not null
    check (tipo in ('stato', 'prossimo_contatto')),

  valore_precedente text,
  valore_nuovo text,

  creata_il timestamptz not null default now()
);

create index if not exists attivita_clienti_cliente_idx
  on public.attivita_clienti(cliente_id);

create index if not exists attivita_clienti_data_idx
  on public.attivita_clienti(creata_il desc);

alter table public.attivita_clienti enable row level security;


-- ============================================================
-- VISIBILITÀ
-- ============================================================
-- Mantiene la stessa visibilità cliente introdotta dalle
-- migration più recenti.

drop policy if exists attivita_clienti_select
  on public.attivita_clienti;

create policy attivita_clienti_select
on public.attivita_clienti
for select
using (
  exists (
    select 1
    from public.clienti c
    where c.id = attivita_clienti.cliente_id
      and (
        c.venditore_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in ('referente', 'produzione')
        )
        or exists (
          select 1
          from public.vendite v
          where v.cliente_id = c.id
            and v.venditore_id = auth.uid()
        )
      )
  )
);


-- ============================================================
-- REGISTRAZIONE AUTOMATICA
-- ============================================================

create or replace function public.registra_attivita_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  if new.stato is distinct from old.stato then
    insert into public.attivita_clienti (
      cliente_id,
      attore_id,
      tipo,
      valore_precedente,
      valore_nuovo
    )
    values (
      new.id,
      auth.uid(),
      'stato',
      old.stato,
      new.stato
    );
  end if;


  if new.prossimo_contatto is distinct from old.prossimo_contatto
     and coalesce(
       current_setting(
         'landing_sellers.contatto_completato',
         true
       ),
       ''
     ) <> '1'
  then
    insert into public.attivita_clienti (
      cliente_id,
      attore_id,
      tipo,
      valore_precedente,
      valore_nuovo
    )
    values (
      new.id,
      auth.uid(),
      'prossimo_contatto',
      old.prossimo_contatto::text,
      new.prossimo_contatto::text
    );
  end if;

  return new;
end;
$$;


drop trigger if exists trg_registra_attivita_cliente
  on public.clienti;

create trigger trg_registra_attivita_cliente
after update on public.clienti
for each row
execute function public.registra_attivita_cliente();
