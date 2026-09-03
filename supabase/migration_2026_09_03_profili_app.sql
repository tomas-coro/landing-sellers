-- supabase/migration_2026_09_03_profili_app.sql
alter table public.profili
  add column if not exists username text,
  add column if not exists avatar_url text;

create unique index if not exists profili_username_unique
  on public.profili (lower(username))
  where username is not null and btrim(username) <> '';

create or replace function public.update_my_profile(
  p_username text,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(btrim(p_username), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_username is not null and length(v_username) < 3 then raise exception 'username troppo corto'; end if;
  if v_username is not null and length(v_username) > 30 then raise exception 'username troppo lungo'; end if;

  update public.profili
  set username = v_username, avatar_url = p_avatar_url
  where id = auth.uid();

  if not found then raise exception 'profilo non trovato'; end if;
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_avatars_select on storage.objects;
drop policy if exists profile_avatars_insert on storage.objects;
drop policy if exists profile_avatars_update on storage.objects;
drop policy if exists profile_avatars_delete on storage.objects;

create policy profile_avatars_select on storage.objects
for select to authenticated using (bucket_id='profile-avatars');

create policy profile_avatars_insert on storage.objects
for insert to authenticated with check (
  bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text
);

create policy profile_avatars_update on storage.objects
for update to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create policy profile_avatars_delete on storage.objects
for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
