create or replace function public.blocca_cestino_diretto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cancellato_il is distinct from old.cancellato_il
     and current_user in ('authenticated', 'anon') then
    raise exception 'Il cestino si gestisce solo dalle funzioni dedicate';
  end if;
  return new;
end;
$$;

drop trigger if exists clienti_blocca_cestino_diretto on public.clienti;

create trigger clienti_blocca_cestino_diretto
before update of cancellato_il on public.clienti
for each row
execute function public.blocca_cestino_diretto();

alter table public.clienti
  drop constraint if exists clienti_sito_url_schema_sicuro;

alter table public.clienti
  add constraint clienti_sito_url_schema_sicuro
  check (sito_url is null or sito_url !~* '^\s*(javascript|data|vbscript|file):')
  not valid;
