-- Chi incassa deve vedere le quote che deve girare agli altri.
-- Caso reale: Alessandro incassa su una vendita di Nicola. Tomas e Nicola
-- vedono la loro quota (profilo_id = loro), ma Alessandro non vedeva le righe
-- di pagamento_partecipanti degli altri, quindi "Da trasferire" restava vuoto.
-- Solo lettura: nessun nuovo permesso di scrittura.

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
        or p.incassato_da = auth.uid()
        or public.is_admin()
      )
  )
  -- Stessa regola di pagamenti_select / vendita_partecipanti_select.
  or exists (
    select 1
    from public.profili pr
    where pr.id = auth.uid()
      and pr.ruolo_economico in ('referente', 'produzione')
  )
);
