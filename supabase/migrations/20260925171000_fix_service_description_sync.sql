-- Landing Sellers
-- Fix rigenerazione descrizione servizi dopo modifica manuale.
--
-- Problema:
-- aggiorna_servizi_cliente univa la nuova configurazione allo snapshot
-- precedente mantenendo descrizione_pacchetto. L'helper dava priorità
-- a quella descrizione vecchia, ignorando quindi upgrade aggiunti/tolti.
--
-- Il fix rigenera sempre la descrizione dai dati correnti.
-- Nessun importo, pagamento, quota o costo viene modificato.

create or replace function public.aggiorna_servizi_cliente(
  p_cliente_id uuid,
  p_configurazione jsonb,
  p_descrizione text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendita_id uuid;
  v_cfg_esistente jsonb;
  v_cfg_nuova jsonb;
  v_descrizione text;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if jsonb_typeof(
    coalesce(p_configurazione, '{}'::jsonb)
  ) <> 'object' then
    raise exception 'Configurazione commerciale non valida';
  end if;

  if not exists (
    select 1
    from public.clienti c
    where c.id = p_cliente_id
      and c.cancellato_il is null
      and (
        c.venditore_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.profili p
          where p.id = auth.uid()
            and p.ruolo_economico in (
              'referente',
              'produzione'
            )
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

  select
    v.id,
    coalesce(
      v.configurazione_commerciale,
      '{}'::jsonb
    )
  into
    v_vendita_id,
    v_cfg_esistente
  from public.vendite v
  where v.cliente_id = p_cliente_id
    and v.stato = 'attiva'
  order by
    v.data_vendita desc nulls last,
    v.creato_il desc
  limit 1;

  v_cfg_nuova :=
    coalesce(v_cfg_esistente, '{}'::jsonb)
    ||
    coalesce(p_configurazione, '{}'::jsonb);

  /*
   * Fondamentale:
   * la descrizione precedente non deve prevalere sui servizi
   * appena modificati.
   */
  v_descrizione :=
    coalesce(
      public.descrizione_configurazione_commerciale(
        v_cfg_nuova - 'descrizione_pacchetto',
        p_descrizione
      ),
      nullif(trim(p_descrizione), '')
    );

  if v_descrizione is null then
    raise exception 'Descrizione servizi obbligatoria';
  end if;

  v_cfg_nuova :=
    v_cfg_nuova ||
    jsonb_build_object(
      'descrizione_pacchetto',
      v_descrizione
    );

  if v_vendita_id is not null then
    update public.vendite
    set
      servizio = v_descrizione,
      configurazione_commerciale = v_cfg_nuova
    where id = v_vendita_id;
  end if;

  perform public.sincronizza_cliente_da_configurazione(
    p_cliente_id,
    v_cfg_nuova,
    v_descrizione
  );
end;
$$;

revoke all
on function public.aggiorna_servizi_cliente(
  uuid,
  jsonb,
  text
)
from public, anon;

grant execute
on function public.aggiorna_servizi_cliente(
  uuid,
  jsonb,
  text
)
to authenticated;
