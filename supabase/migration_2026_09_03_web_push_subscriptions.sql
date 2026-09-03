-- supabase/migration_2026_09_03_web_push_subscriptions.sql
-- Da eseguire una volta sola nell'SQL Editor di Supabase (dashboard progetto),
-- SOLO dopo conferma esplicita: questo file non viene applicato in automatico.
--
-- Tabella per le subscription Web Push standard (browser desktop/mobile via
-- PWA installata), separata da public.push_devices che invece serve ai token
-- nativi APNs/FCM della build Capacitor (branch mobile-app, non su main).
-- Nessun segreto qui dentro: solo endpoint pubblico e chiavi p256dh/auth
-- della subscription, che senza la VAPID private key (mai in questo file,
-- mai nel frontend) non permettono di inviare nulla.

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true
);

create index web_push_subscriptions_user_id_idx on public.web_push_subscriptions (user_id);
create index web_push_subscriptions_user_id_active_idx on public.web_push_subscriptions (user_id, active);

alter table public.web_push_subscriptions enable row level security;

-- web_push_subscriptions: ognuno vede/gestisce solo le proprie subscription.
create policy web_push_subscriptions_select on public.web_push_subscriptions
  for select using (user_id = auth.uid());

-- UPDATE diretto: resta permesso (stesso schema di push_devices), serve al
-- logout per-device per disattivare SOLO la subscription del browser corrente
-- (fareLogout() in app.js, update sulla riga identificata dal suo endpoint).
-- La RLS garantisce che si possa toccare solo una riga con user_id = auth.uid(),
-- quindi non c'e' bisogno di una RPC dedicata solo per questo.
create policy web_push_subscriptions_update on public.web_push_subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy web_push_subscriptions_delete on public.web_push_subscriptions
  for delete using (user_id = auth.uid());

-- Nessuna policy di INSERT diretto: la registrazione passa sempre dalla RPC
-- public.register_web_push_subscription (sotto), che gira SECURITY DEFINER e
-- gestisce anche la riassegnazione dell'endpoint tra utenti diversi sullo
-- stesso browser (A fa logout, B fa login sullo stesso device: il browser
-- restituisce lo stesso endpoint, ancora intestato ad A). Un INSERT diretto
-- dal client si scontrerebbe contro il vincolo unique(endpoint) su una riga
-- che RLS non gli farebbe ne' vedere ne' aggiornare.

-- ---------------------------------------------------------------------
-- RPC: public.register_web_push_subscription(p_endpoint, p_p256dh, p_auth)
-- ---------------------------------------------------------------------
-- Registra o riassegna in sicurezza una subscription Web Push per l'utente
-- autenticato corrente. Il client non puo' passare user_id: viene sempre
-- preso da auth.uid() lato server.
create function public.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns public.web_push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.web_push_subscriptions;
begin
  if v_user_id is null then
    raise exception 'auth.uid() richiesto';
  end if;

  if coalesce(trim(p_endpoint), '') = ''
     or coalesce(trim(p_p256dh), '') = ''
     or coalesce(trim(p_auth), '') = '' then
    raise exception 'endpoint, p256dh e auth non possono essere vuoti';
  end if;

  insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = v_user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        active = true,
        updated_at = now(),
        last_seen_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_web_push_subscription(text, text, text) from public;
revoke all on function public.register_web_push_subscription(text, text, text) from anon;
grant execute on function public.register_web_push_subscription(text, text, text) to authenticated;
