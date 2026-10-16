-- Promemoria "Ricontatta": giorno e ora, visibile e modificabile solo dal
-- venditore a cui il cliente e' assegnato. Admin, developer e produzione
-- continuano a vedere il cliente ma non possono gestire questo promemoria.

alter table public.clienti
  alter column prossimo_contatto type timestamptz
  using prossimo_contatto::timestamp at time zone 'Europe/Rome';

comment on column public.clienti.prossimo_contatto is
  'Data e ora del ricontatto riservato al venditore diretto';

drop function if exists public.imposta_prossimo_contatto_cliente(uuid, date);
drop function if exists public.imposta_prossimo_contatto_cliente(uuid, timestamptz);

create function public.imposta_prossimo_contatto_cliente(
  p_cliente_id uuid,
  p_data timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.clienti c
    join public.profili p on p.id = auth.uid()
    where c.id = p_cliente_id
      and c.venditore_id = auth.uid()
      and p.ruolo not in ('admin', 'developer')
      and coalesce(p.ruolo_economico, '') <> 'produzione'
  ) then
    raise exception 'Ricontatto non consentito';
  end if;

  update public.clienti
  set prossimo_contatto = p_data
  where id = p_cliente_id;
end;
$$;

revoke all
on function public.imposta_prossimo_contatto_cliente(uuid, timestamptz)
from public, anon;

grant execute
on function public.imposta_prossimo_contatto_cliente(uuid, timestamptz)
to authenticated;
