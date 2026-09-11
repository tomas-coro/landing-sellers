-- Landing Sellers
-- Completamento operativo dei prossimi contatti.

alter table public.attivita_clienti
  drop constraint if exists attivita_clienti_tipo_check;

alter table public.attivita_clienti
  add constraint attivita_clienti_tipo_check
  check (
    tipo in (
      'stato',
      'prossimo_contatto',
      'contatto_completato'
    )
  );


-- Il trigger continua a registrare normalmente modifiche/rimozioni
-- del prossimo contatto, tranne quando la rimozione avviene tramite
-- l'azione esplicita "Fatto".
-- Il trigger creato dalla migration Timeline riconosce già
-- landing_sellers.contatto_completato e non registra una seconda
-- attività prossimo_contatto quando l'azione esplicita è "Fatto".

create or replace function public.completa_contatto_cliente(
  p_cliente_id uuid,
  p_data date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date;
begin

  if not exists (
    select 1
    from public.clienti c
    where c.id = p_cliente_id
      and (
        c.venditore_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in ('referente', 'produzione')
        )
        or exists (
          select 1
          from public.vendite v
          where v.cliente_id = c.id
            and v.venditore_id = auth.uid()
        )
      )
  ) then
    raise exception 'Cliente non accessibile';
  end if;

  select prossimo_contatto
  into v_data
  from public.clienti
  where id = p_cliente_id;

  if v_data is null then
    raise exception 'Nessun prossimo contatto da completare';
  end if;

  if p_data is not null and v_data is distinct from p_data then
    raise exception 'Il prossimo contatto è stato modificato';
  end if;

  insert into public.attivita_clienti (
    cliente_id,
    attore_id,
    tipo,
    valore_precedente,
    valore_nuovo
  )
  values (
    p_cliente_id,
    auth.uid(),
    'contatto_completato',
    v_data::text,
    'completato'
  );

  perform set_config(
    'landing_sellers.contatto_completato',
    '1',
    true
  );

  update public.clienti
  set prossimo_contatto = null
  where id = p_cliente_id;
end;
$$;

revoke all
on function public.completa_contatto_cliente(uuid, date)
from public, anon;

grant execute
on function public.completa_contatto_cliente(uuid, date)
to authenticated;
