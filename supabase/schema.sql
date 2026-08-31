-- supabase/schema.sql

create table public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  ruolo text not null default 'venditore' check (ruolo in ('venditore', 'admin'))
);

create table public.clienti (
  id uuid primary key default gen_random_uuid(),
  venditore_id uuid not null references public.profili(id),
  nome text not null,
  referente text default '',
  telefono text default '',
  email text default '',
  piva text default '',
  iban text default '',
  importo_abbonamento numeric default 0,
  stato text not null default 'contattato'
    check (stato in ('contattato', 'brief_mandato', 'in_lavorazione', 'pubblicato')),
  prossimo_contatto date,
  creato_il timestamptz not null default now()
);

create table public.note (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti(id) on delete cascade,
  venditore_id uuid not null references public.profili(id),
  testo text not null,
  creata_il timestamptz not null default now()
);

-- Un account creato in Supabase Auth non crea automaticamente una riga in
-- profili: senza questo trigger un venditore nuovo farebbe login con
-- ruolo/nome assenti e ogni RLS lo tratterebbe come "nessun permesso".
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profili (id, nome, ruolo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'venditore');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
