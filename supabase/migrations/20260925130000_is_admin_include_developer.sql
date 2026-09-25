-- is_admin() deve riconoscere anche ruolo='developer' come admin-equivalente,
-- altrimenti chi ha ruolo developer non vede vendite/clienti/pagamenti creati
-- da altri venditori (RLS), pur essendo bloccato dai vincoli univoci globali
-- (es. una sola vendita attiva per cliente) come se fosse un admin.

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo in ('admin', 'developer')
  );
$function$;
