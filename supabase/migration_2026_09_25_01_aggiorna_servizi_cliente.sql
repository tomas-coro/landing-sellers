-- Modifica controllata dei soli servizi descrittivi di un cliente.
-- NON modifica importo_vendita, pagamenti, quote, costi o condizioni economiche.

create or replace function public.aggiorna_servizi_cliente(
  p_cliente_id uuid,
  p_configurazione jsonb,
  p_descrizione text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendita_id uuid;
  v_configurazione_esistente jsonb;
  v_configurazione_nuova jsonb;

  v_formula text;
  v_upgrade jsonb;
  v_pagine_extra integer;
  v_lingue_extra integer;
  v_cliente_ha_dominio boolean;
  v_dominio_it integer;
  v_dominio_com integer;
  v_email_5_caselle integer;
  v_pacchetto_sicurezza boolean;
  v_descrizione text;
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

  v_formula := nullif(trim(p_configurazione ->> 'formula'), '');

  if v_formula not in ('mensile', 'annuale') then
    raise exception 'Formula non valida';
  end if;

  v_upgrade := coalesce(
    p_configurazione -> 'upgrade',
    '[]'::jsonb
  );

  if jsonb_typeof(v_upgrade) <> 'array' then
    raise exception 'Lista upgrade non valida';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_upgrade) as x(valore)
    where x.valore not in (
      'modulo_dinamico',
      'gallery_dinamica',
      'chatbot_ai'
    )
  ) then
    raise exception 'Upgrade non riconosciuto';
  end if;

  v_pagine_extra :=
    greatest(
      0,
      least(
        15,
        coalesce(
          (p_configurazione ->> 'pagine_extra')::integer,
          0
        )
      )
    );

  v_lingue_extra :=
    greatest(
      0,
      least(
        5,
        coalesce(
          (p_configurazione ->> 'lingue_extra')::integer,
          0
        )
      )
    );

  v_cliente_ha_dominio :=
    coalesce(
      (p_configurazione ->> 'cliente_ha_dominio')::boolean,
      true
    );

  if v_cliente_ha_dominio then
    v_dominio_it := 0;
    v_dominio_com := 0;
    v_email_5_caselle := 0;
  else
    v_dominio_it :=
      case
        when coalesce(
          (p_configurazione ->> 'dominio_it')::integer,
          0
        ) > 0 then 1
        else 0
      end;

    v_dominio_com :=
      case
        when coalesce(
          (p_configurazione ->> 'dominio_com')::integer,
          0
        ) > 0 then 1
        else 0
      end;

    v_email_5_caselle :=
      case
        when coalesce(
          (p_configurazione ->> 'email_5_caselle')::integer,
          0
        ) > 0 then 1
        else 0
      end;
  end if;

  v_pacchetto_sicurezza :=
    case
      when v_formula = 'mensile'
        then coalesce(
          (p_configurazione ->> 'pacchetto_sicurezza')::boolean,
          false
        )
      else false
    end;

  v_descrizione := nullif(trim(p_descrizione), '');

  if v_descrizione is null then
    raise exception 'Descrizione servizi obbligatoria';
  end if;

  select
    v.id,
    coalesce(v.configurazione_commerciale, '{}'::jsonb)
  into
    v_vendita_id,
    v_configurazione_esistente
  from public.vendite v
  where v.cliente_id = p_cliente_id
    and v.stato = 'attiva'
  order by
    v.data_vendita desc nulls last,
    v.creato_il desc
  limit 1;

  v_configurazione_nuova :=
    coalesce(v_configurazione_esistente, '{}'::jsonb)
    || jsonb_build_object(
      'formula', v_formula,
      'periodicita_contratto', v_formula,
      'upgrade', v_upgrade,
      'pagine_extra', v_pagine_extra,
      'lingue_extra', v_lingue_extra,
      'cliente_ha_dominio', v_cliente_ha_dominio,
      'dominio_it', v_dominio_it,
      'dominio_com', v_dominio_com,
      'email_5_caselle', v_email_5_caselle,
      'pacchetto_sicurezza', v_pacchetto_sicurezza,
      'descrizione_pacchetto', v_descrizione
    );

  -- Sincronizza solo i campi descrittivi del cliente.
  -- Prezzi e rinnovi non vengono toccati.
  update public.clienti
  set
    nome_pacchetto = v_descrizione,
    pagine_extra = v_pagine_extra,
    lingue_extra = v_lingue_extra,
    cliente_ha_dominio = v_cliente_ha_dominio,
    dominio_it = (v_dominio_it > 0),
    dominio_com = (v_dominio_com > 0),
    email_5_caselle = (v_email_5_caselle > 0),
    pacchetto_sicurezza = v_pacchetto_sicurezza
  where id = p_cliente_id;

  if v_vendita_id is not null then
    update public.vendite
    set
      servizio = v_descrizione,
      configurazione_commerciale = v_configurazione_nuova
    where id = v_vendita_id;
  end if;
end;
$$;

revoke all
on function public.aggiorna_servizi_cliente(uuid, jsonb, text)
from public, anon;

grant execute
on function public.aggiorna_servizi_cliente(uuid, jsonb, text)
to authenticated;
