-- supabase/migration_2026_09_02_push_devices.sql
-- Da eseguire una volta sola nell'SQL Editor di Supabase (dashboard progetto).
-- Tabella per registrare i dispositivi (token push) dell'app nativa
-- iOS/Android. Nessun invio di notifiche in questa fase: solo
-- infrastruttura e registrazione. Non contiene mai segreti (niente
-- certificati APNs, chiavi FCM): solo il token del dispositivo.

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  unique (token)
);

create index push_devices_user_id_idx on public.push_devices (user_id);
create index push_devices_active_idx on public.push_devices (user_id, active);

alter table public.push_devices enable row level security;

-- push_devices: ognuno vede/gestisce solo i propri dispositivi.
-- Niente eccezione admin qui: la lettura dei token altrui non serve
-- a un admin lato app, solo a un eventuale backend con service_role
-- (bypassa RLS di default) che in futuro invierà le notifiche.
create policy push_devices_select on public.push_devices
  for select using (user_id = auth.uid());

-- Nessuna policy di INSERT diretto: la registrazione passa sempre
-- dalla RPC public.register_push_device (sotto), che gira SECURITY
-- DEFINER e gestisce anche la riassegnazione del token tra utenti
-- diversi sullo stesso dispositivo. Un INSERT diretto dal client non
-- serve a nessun flusso dell'app: se in futuro servisse, va aggiunta
-- una policy dedicata, non riaperta questa a scatola chiusa.

-- UPDATE diretto: resta permesso, serve al logout per disattivare i
-- propri dispositivi (fareLogout() in app.js, update semplice sulla
-- riga posseduta). Non serve una RPC dedicata qui: la RLS già
-- garantisce che un utente possa toccare solo righe con
-- user_id = auth.uid(), quindi non c'è il problema di collisione che
-- ha invece la registrazione (dove il token può appartenere a un
-- ALTRO utente). with check ripete la stessa condizione per evitare
-- che un update cambi user_id verso una riga che non gli appartiene.
create policy push_devices_update on public.push_devices
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_devices_delete on public.push_devices
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- RPC: public.register_push_device(p_token, p_platform)
-- ---------------------------------------------------------------------
-- Registra o riassegna in sicurezza un push token per l'utente
-- autenticato corrente. Risolve la collisione token tra utenti diversi
-- sullo stesso dispositivo (A fa logout, B fa login, APNs/FCM restituisce
-- di nuovo il token X: l'upsert diretto sulla tabella falliva perché la
-- RLS impediva a B di aggiornare la riga di A).
--
-- Punti di sicurezza (verificati contro la documentazione Supabase
-- corrente su funzioni SECURITY DEFINER e RLS):
-- - user_id non è MAI un parametro: viene sempre letto da auth.uid(),
--   quindi il client non può registrare un token a nome di un altro
--   utente.
-- - search_path = '' e nomi completamente qualificati (public.push_devices,
--   auth.uid()) per evitare hijacking dello schema.
-- - auth.uid() null => eccezione esplicita (chiamata non autenticata
--   respinta, non un fallimento silenzioso).
-- - EXECUTE concesso solo al ruolo authenticated, revocato da public
--   e anon (sotto).
--
-- Assunzione su cui si regge il bypass RLS voluto: la funzione va creata
-- da un utente con privilegi che bypassano la RLS (es. postgres, il ruolo
-- di default dell'SQL Editor di Supabase), e push_devices NON deve avere
-- FORCE ROW LEVEL SECURITY attivo. Con questa migration entrambe le
-- condizioni valgono; se in futuro la tabella venisse ricreata con FORCE
-- RLS o la funzione venisse ricreata da un ruolo diverso, la riassegnazione
-- del token smetterebbe di funzionare.
create or replace function public.register_push_device(
  p_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid platform: %', p_platform using errcode = '22023';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'invalid token' using errcode = '22023';
  end if;

  -- Un solo upsert copre tutti i casi richiesti:
  -- - token nuovo             -> insert, riga creata per v_uid;
  -- - token già di v_uid      -> conflitto, riattiva e aggiorna i timestamp;
  -- - token di un ALTRO utente -> conflitto, la riga viene riassegnata a
  --   v_uid (user_id sovrascritto). Sicuro solo perché questa funzione
  --   gira SECURITY DEFINER: bypassa la RLS di proposito, cosa che un
  --   client con solo il ruolo authenticated non potrebbe mai fare da sé.
  insert into public.push_devices (user_id, token, platform, active, updated_at, last_seen_at)
  values (v_uid, p_token, p_platform, true, now(), now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    active = true,
    updated_at = now(),
    last_seen_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text) from public;
revoke all on function public.register_push_device(text, text) from anon;
grant execute on function public.register_push_device(text, text) to authenticated;
