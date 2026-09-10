-- Allinea ruoli e venditore di riferimento alla struttura commerciale reale.

alter table public.profili
  drop constraint if exists profili_ruolo_check;

alter table public.profili
  add constraint profili_ruolo_check
  check (ruolo in ('venditore', 'admin', 'developer'));

update public.profili
set ruolo = 'developer', ruolo_economico = 'produzione'
where id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid;

-- Se partecipa un terzo commerciale è lui il riferimento; altrimenti Alessandro.
update public.vendite v
set venditore_id = coalesce(
  (
    select vp.profilo_id
    from public.vendita_partecipanti vp
    join public.profili p on p.id = vp.profilo_id
    where vp.vendita_id = v.id
      and p.ruolo = 'venditore'
      and p.ruolo_economico is null
    order by vp.creato_il
    limit 1
  ),
  'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
);

-- Mantiene coerente anche l'assegnazione CRM dei clienti; Alessandro e Tomas
-- continuano entrambi a vederli tramite la policy del team.
update public.clienti c
set venditore_id = coalesce(
  (
    select v.venditore_id
    from public.vendite v
    where v.cliente_id = c.id
      and v.stato = 'attiva'
    order by v.data_vendita desc, v.creato_il desc
    limit 1
  ),
  'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
)
where c.cancellato_il is null;
