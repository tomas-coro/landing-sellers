-- Registra vendita e piano rateale previsto in una sola transazione.
-- Le rate devono coprire l'intera vendita e scadere entro sei mesi.

create function public.registra_vendita_con_trasferimenti(
  p_vendita jsonb,
  p_configurazione jsonb,
  p_costi jsonb,
  p_partecipanti jsonb,
  p_pagamento jsonb,
  p_rate_previste jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendita_id uuid;
  v_pagamento_id uuid;
  v_data_vendita date;
  v_importo_vendita numeric(12,2);
  v_totale_rate numeric(12,2);
  v_rata jsonb;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if jsonb_typeof(coalesce(p_rate_previste, '[]'::jsonb)) <> 'array' then
    raise exception 'Piano rateale non valido';
  end if;

  v_data_vendita :=
    coalesce(nullif(p_vendita ->> 'data_vendita', '')::date, current_date);
  v_importo_vendita :=
    coalesce((p_vendita ->> 'importo_vendita')::numeric, 0);

  if jsonb_array_length(coalesce(p_rate_previste, '[]'::jsonb)) > 0 then
    if p_pagamento is not null then
      raise exception 'Pagamento iniziale e piano rateale non possono coesistere';
    end if;

    if jsonb_array_length(p_rate_previste) < 2 then
      raise exception 'Il piano rateale deve contenere almeno due rate';
    end if;

    if jsonb_array_length(p_rate_previste) > 3 then
      raise exception 'Il piano rateale non può superare tre rate';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_rate_previste) rata
      where coalesce((rata ->> 'importo')::numeric, 0) <= 0
         or nullif(rata ->> 'data_scadenza', '') is null
         or (rata ->> 'data_scadenza')::date < v_data_vendita
         or (rata ->> 'data_scadenza')::date >
            (v_data_vendita + interval '6 months')::date
    ) then
      raise exception 'Rate non valide o oltre sei mesi dalla vendita';
    end if;

    select coalesce(sum((rata ->> 'importo')::numeric), 0)
    into v_totale_rate
    from jsonb_array_elements(p_rate_previste) rata;

    if v_totale_rate <> v_importo_vendita then
      raise exception 'La somma delle rate non coincide con la vendita';
    end if;
  end if;

  v_vendita_id := public.registra_vendita_completa(
    p_vendita,
    coalesce(p_configurazione, '{}'::jsonb),
    coalesce(p_costi, '[]'::jsonb),
    coalesce(p_partecipanti, '[]'::jsonb),
    p_pagamento
  );

  if p_pagamento is not null then
    select p.id
    into v_pagamento_id
    from public.pagamenti p
    where p.vendita_id = v_vendita_id
      and p.stato = 'incassato'
    order by p.creato_il desc
    limit 1;

    perform public._imposta_incassato_pagamento(
      v_pagamento_id,
      nullif(p_pagamento ->> 'incassato_da', '')::uuid
    );
  end if;

  for v_rata in
    select value
    from jsonb_array_elements(coalesce(p_rate_previste, '[]'::jsonb))
  loop
    perform public.registra_pagamento_vendita(
      p_vendita_id => v_vendita_id,
      p_importo => (v_rata ->> 'importo')::numeric,
      p_stato => 'previsto',
      p_data_scadenza => (v_rata ->> 'data_scadenza')::date,
      p_data_pagamento => null,
      p_metodo => null,
      p_note => nullif(trim(v_rata ->> 'note'), ''),
      p_pagamento_previsto_id => null
    );
  end loop;

  return v_vendita_id;
end;
$$;

revoke all on function public.registra_vendita_con_trasferimenti(
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.registra_vendita_con_trasferimenti(
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
