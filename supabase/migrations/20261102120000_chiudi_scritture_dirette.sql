-- Chiude le scritture dirette che aggirano le regole "solo admin" delle funzioni.
-- Audit sicurezza del 02/11/2026 (piste c-A e c-G). Il frontend non scrive mai
-- direttamente su queste tabelle: passa dalle funzioni SECURITY DEFINER, che
-- girano come proprietario e non sono toccate da questi REVOKE.
-- Eccezioni volute: DELETE su pagamenti (solo rate previste, js/app-economia.js)
-- e INSERT/UPDATE su clienti (scheda cliente).

-- 1. Tabelle economiche: nessuna scrittura diretta da utenti e anon.
revoke insert, update, delete, truncate, trigger, references
  on public.vendite,
     public.vendita_partecipanti,
     public.costi_vendita,
     public.pagamento_calcoli,
     public.pagamento_partecipanti
  from authenticated, anon;

-- 2. Pagamenti: si puo' solo cancellare, e solo una rata ancora "prevista".
revoke insert, update, truncate, trigger, references
  on public.pagamenti
  from authenticated, anon;
revoke delete on public.pagamenti from anon;

drop policy if exists pagamenti_delete on public.pagamenti;
create policy pagamenti_delete on public.pagamenti
for delete using (
  pagamenti.stato = 'previsto'
  and exists (
    select 1
    from public.vendite v
    where v.id = pagamenti.vendita_id
      and (
        v.creato_da = auth.uid()
        or public.is_admin()
      )
  )
);

-- 3. Clienti: nessuna cancellazione diretta (il cestino passa dalle funzioni).
revoke delete, truncate, trigger, references
  on public.clienti
  from authenticated, anon;
revoke insert, update on public.clienti from anon;

-- 4. La cancellazione di un cliente non porta piu' via vendite e incassi:
--    la chiave esterna passa da CASCADE a RESTRICT. Il nome della chiave si
--    cerca per colonna, cosi' funziona anche se non ha il nome standard.
do $$
declare
  nome_fk text;
begin
  select c.conname into nome_fk
  from pg_constraint c
  where c.contype = 'f'
    and c.conrelid = 'public.vendite'::regclass
    and c.confrelid = 'public.clienti'::regclass;

  if nome_fk is null then
    raise exception 'FK vendite -> clienti non trovata';
  end if;

  execute format('alter table public.vendite drop constraint %I', nome_fk);
  alter table public.vendite
    add constraint vendite_cliente_id_fkey
    foreign key (cliente_id) references public.clienti(id) on delete restrict;
end
$$;

-- 5. La pulizia automatica del cestino salta i clienti che hanno vendite:
--    senza questo, con RESTRICT, la cancellazione giornaliera darebbe errore.
--    Effetto voluto: un cliente con vendite resta nel cestino finche' un admin
--    non decide cosa farne.
create or replace function public.pulisci_cestino_clienti()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.clienti c
  where c.cancellato_il is not null
    and c.cancellato_il < now() - interval '30 days'
    and not exists (select 1 from public.vendite v where v.cliente_id = c.id);
$$;

-- Come prima: nessun accesso diretto alla pulizia da utenti e anon.
revoke execute on function public.pulisci_cestino_clienti() from public, anon, authenticated;

-- Verifica (da lanciare dopo, sola lettura):
--   select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('authenticated','anon')
--     and table_name in ('vendite','pagamenti','costi_vendita','clienti',
--       'vendita_partecipanti','pagamento_partecipanti','pagamento_calcoli')
--   group by 1, 2 order by 1, 2;
--   select conrelid::regclass, confdeltype from pg_constraint
--   where contype = 'f' and confrelid = 'public.clienti'::regclass;
