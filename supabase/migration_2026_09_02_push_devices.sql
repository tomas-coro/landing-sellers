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

create policy push_devices_insert on public.push_devices
  for insert with check (user_id = auth.uid());

create policy push_devices_update on public.push_devices
  for update using (user_id = auth.uid());

create policy push_devices_delete on public.push_devices
  for delete using (user_id = auth.uid());
