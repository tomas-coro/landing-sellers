-- Allinea la visibilita' economica (vendite/pagamenti/partecipanti) a quella
-- gia' concessa su clienti: chi ha ruolo_economico 'referente' o 'produzione'
-- deve vedere l'economia di TUTTI i clienti, non solo delle proprie vendite.
--
-- Bug reale trovato: clienti_select (migration_2026_09_09_visibilita_team_e_
-- venditore.sql) gia' concede questa visibilita' estesa, ma vendite_select,
-- pagamenti_select e vendita_partecipanti_select (migration_2026_09_07_
-- gestione_pagamenti.sql) non sono mai state aggiornate di conseguenza.
-- Risultato: un referente vede il cliente ma tutti i suoi dati economici
-- (contratto, incassato, valore) risultano vuoti se il cliente non e'
-- assegnato a lui come venditore_id.

drop policy if exists vendite_select on public.vendite;

create policy vendite_select on public.vendite
for select using (
  venditore_id = auth.uid()
  or creato_da = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
);

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
  or exists (
    select 1
    from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
);

drop policy if exists vendita_partecipanti_select on public.vendita_partecipanti;

create policy vendita_partecipanti_select on public.vendita_partecipanti
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
  or exists (
    select 1
    from public.profili p
    where p.id = auth.uid()
      and p.ruolo_economico in ('referente', 'produzione')
  )
);
