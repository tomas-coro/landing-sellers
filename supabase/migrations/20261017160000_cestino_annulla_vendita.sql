-- Landing Sellers
-- Eliminare un cliente non lascia piu' vendite attive "orfane":
--  * senza incassi -> la vendita viene annullata insieme al cliente
--    (le rate previste diventano 'annullato');
--  * con incassi   -> l'eliminazione e' bloccata con un messaggio chiaro.
-- In fondo: pulizia una tantum delle vendite orfane gia' esistenti.

create or replace function public.sposta_cliente_nel_cestino(
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

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

  -- Blocca le vendite attive del cliente: niente annullamenti in parallelo.
  perform 1
  from public.vendite v
  where v.cliente_id = p_cliente_id
    and v.stato = 'attiva'
  for update of v;

  if exists (
    select 1
    from public.vendite v
    join public.pagamenti pg on pg.vendita_id = v.id
    where v.cliente_id = p_cliente_id
      and v.stato = 'attiva'
      and pg.stato = 'incassato'
  ) then
    raise exception 'Questo cliente ha incassi registrati: annulla prima gli incassi, poi eliminalo';
  end if;

  update public.pagamenti
  set stato = 'annullato'
  where stato = 'previsto'
    and vendita_id in (
      select v.id
      from public.vendite v
      where v.cliente_id = p_cliente_id
        and v.stato = 'attiva'
    );

  update public.vendite
  set stato = 'annullata',
      aggiornato_il = now()
  where cliente_id = p_cliente_id
    and stato = 'attiva';

  update public.clienti
  set cancellato_il = now()
  where id = p_cliente_id
    and cancellato_il is null;
end;
$$;

revoke all
on function public.sposta_cliente_nel_cestino(uuid)
from public, anon;

grant execute
on function public.sposta_cliente_nel_cestino(uuid)
to authenticated;


-- Pulizia una tantum: vendite attive di clienti gia' nel cestino, senza
-- incassi. Quelle con incassi restano (vanno viste a mano).
update public.pagamenti
set stato = 'annullato'
where stato = 'previsto'
  and vendita_id in (
    select v.id
    from public.vendite v
    join public.clienti c on c.id = v.cliente_id
    where c.cancellato_il is not null
      and v.stato = 'attiva'
      and not exists (
        select 1 from public.pagamenti x
        where x.vendita_id = v.id and x.stato = 'incassato'
      )
  );

update public.vendite v
set stato = 'annullata',
    aggiornato_il = now()
from public.clienti c
where c.id = v.cliente_id
  and c.cancellato_il is not null
  and v.stato = 'attiva'
  and not exists (
    select 1 from public.pagamenti x
    where x.vendita_id = v.id and x.stato = 'incassato'
  );
