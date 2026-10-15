-- Sezione "Rete vendita": due funzioni di sola lettura (security definer) che
-- espongono l'albero dei venditori e gli incassi di chi sta sotto, perche' la RLS
-- di profili e pagamento_partecipanti mostra a ognuno solo le proprie righe.
-- Non modificano venditori_team_corrente (il client dipende dalla sua forma).

begin;

-- Albero visibile al chiamante: chi ha accesso globale (admin/developer/referente)
-- vede tutta la rete, gli altri solo se stessi e chi sta sotto. Tomas (developer)
-- non e' mai un nodo: la radice e' il venditore senza responsabile.
-- livello = profondita' assoluta nella rete (1 = radice), non dipende da chi guarda.
create or replace function public.rete_vendita_albero()
returns table (id uuid, nome text, responsabile_id uuid, livello integer)
language sql
security definer
set search_path = public
stable
as $$
  with recursive utente as (
    select
      p.id,
      coalesce(p.ruolo in ('admin', 'developer') or p.ruolo_economico = 'referente', false) as globale
    from public.profili p
    where p.id = auth.uid()
  ),
  assoluto as (
    select p.id, p.nome, p.responsabile_id, 1 as livello, array[p.id] as percorso
    from public.profili p
    where p.ruolo = 'venditore' and p.responsabile_id is null

    union all

    select p.id, p.nome, p.responsabile_id, a.livello + 1, a.percorso || p.id
    from public.profili p
    join assoluto a on p.responsabile_id = a.id
    where p.ruolo = 'venditore' and not p.id = any(a.percorso)
  ),
  radici as (
    select a.id from assoluto a cross join utente u
    where u.globale and a.livello = 1
    union
    select a.id from assoluto a cross join utente u
    where not u.globale and a.id = u.id
  ),
  visibili as (
    select a.id, a.nome, a.responsabile_id, a.livello, a.percorso
    from assoluto a
    where exists (select 1 from radici r where r.id = any(a.percorso))
  )
  select
    v.id,
    v.nome,
    -- il padre compare solo se e' a sua volta visibile: la radice della vista non ha padre
    case when exists (select 1 from visibili x where x.id = v.responsabile_id)
      then v.responsabile_id end,
    v.livello
  from visibili v
  order by v.livello, v.nome;
$$;

-- Incassi (quota effettiva) dei venditori visibili nell'albero, per anno solare.
-- Stessa fonte di "Il tuo incassato": pagamento_partecipanti dei pagamenti incassati.
create or replace function public.rete_vendita_incassi(p_anno integer)
returns table (profilo_id uuid, vendita_id uuid, data_pagamento date, quota_effettiva numeric)
language sql
security definer
set search_path = public
stable
as $$
  select
    pp.profilo_id,
    pg.vendita_id,
    pg.data_pagamento::date,
    coalesce(pp.quota_effettiva, 0)
  from public.pagamento_partecipanti pp
  join public.pagamenti pg on pg.id = pp.pagamento_id
  where pg.stato = 'incassato'
    and extract(year from pg.data_pagamento)::integer = p_anno
    and pp.profilo_id in (select t.id from public.rete_vendita_albero() t);
$$;

revoke all on function public.rete_vendita_albero() from public, anon;
revoke all on function public.rete_vendita_incassi(integer) from public, anon;
grant execute on function public.rete_vendita_albero() to authenticated;
grant execute on function public.rete_vendita_incassi(integer) to authenticated;

commit;
