-- Creazione venditori "sotto di te": ogni lv1/lv2 invita i propri diretti.
-- Tre pezzi, tutti senza dati sensibili esposti al browser:
--  1. livello_rete(id): livello dell'utente nell'albero (1 = radice). La usa
--     SOLO la Edge Function admin-crea-profilo (service_role).
--  2. registro_inviti: chi ha creato / reinviato l'invito a chi e quando.
--  3. rete_vendita_inviti_pendenti(): id dei venditori visibili nell'albero che
--     non hanno ancora mai fatto accesso (per l'etichetta "invito inviato").

begin;

-- 1. Livello nell'albero: stessa regola di rete_vendita_albero (radice = venditore
--    senza responsabile). null se non e' un nodo (es. Tomas developer).
create or replace function public.livello_rete(p_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  with recursive assoluto as (
    select p.id, 1 as livello, array[p.id] as percorso
    from public.profili p
    where p.ruolo = 'venditore' and p.responsabile_id is null

    union all

    select p.id, a.livello + 1, a.percorso || p.id
    from public.profili p
    join assoluto a on p.responsabile_id = a.id
    where p.ruolo = 'venditore' and not p.id = any(a.percorso)
  )
  select a.livello from assoluto a where a.id = p_id;
$$;

revoke all on function public.livello_rete(uuid) from public, anon, authenticated;
grant execute on function public.livello_rete(uuid) to service_role;

-- 2. Registro delle creazioni e dei reinvii. Solo la Edge Function scrive
--    (service_role); in lettura solo il developer.
create table if not exists public.registro_inviti (
  id uuid primary key default gen_random_uuid(),
  azione text not null check (azione in ('invito', 'reinvio')),
  -- Niente FK: e' un audit, deve restare leggibile anche se un profilo viene cancellato.
  creato_da uuid not null,
  profilo_id uuid not null,
  responsabile_id uuid,
  creato_il timestamptz not null default now()
);

alter table public.registro_inviti enable row level security;

drop policy if exists registro_inviti_select_developer on public.registro_inviti;
create policy registro_inviti_select_developer on public.registro_inviti
for select to authenticated
using (exists (
  select 1 from public.profili p where p.id = auth.uid() and p.ruolo = 'developer'
));

revoke all on public.registro_inviti from public, anon, authenticated;
grant select on public.registro_inviti to authenticated;
grant all on public.registro_inviti to service_role;

-- 3. Venditori dell'albero visibile che non sono mai entrati. Legge
--    auth.users.last_sign_in_at (non accessibile dal browser) e restituisce solo
--    gli id, mai email o date.
create or replace function public.rete_vendita_inviti_pendenti()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select t.id
  from public.rete_vendita_albero() t
  join auth.users u on u.id = t.id
  where u.last_sign_in_at is null;
$$;

revoke all on function public.rete_vendita_inviti_pendenti() from public, anon;
grant execute on function public.rete_vendita_inviti_pendenti() to authenticated;

commit;
