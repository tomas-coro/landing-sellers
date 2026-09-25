-- Permette di correggere un pagamento già registrato (importo, data, metodo,
-- note) mantenendo coerente lo snapshot economico (pagamento_calcoli e
-- pagamento_partecipanti), che altrimenti resterebbe fermo ai valori vecchi.
--
-- Allinea anche la configurazione consolidata dei partecipanti alla
-- stessa validazione usata da registra_pagamento_economico.
-- Applicata a un UPDATE del pagamento esistente invece che a un INSERT.
-- Il residuo cliente esclude il pagamento in modifica da se stesso, per non
-- contarlo due volte.

create or replace function public.modifica_pagamento_economico(
  p_pagamento_id uuid,
  p_importo numeric,
  p_data_pagamento date default null,
  p_metodo text default null,
  p_note text default null,
  p_calcolo jsonb default '{}'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_vendita_id uuid;
  v_stato_attuale text;
  v_totale numeric(12,2);
  v_incassato_altri numeric(12,2);
  v_importo_snapshot numeric(12,2);
  v_importo_costi numeric(12,2);
  v_margine numeric(12,2);
  v_importo_tasse numeric(12,2);
  v_netto numeric(12,2);
  v_totale_quote numeric(12,2);
  v_numero_partecipanti integer;
  v_numero_snapshot integer;
  v_numero_referenti integer;
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  if coalesce(p_importo, 0) <= 0 then
    raise exception 'Importo pagamento non valido';
  end if;

  select p.vendita_id, p.stato
  into v_vendita_id, v_stato_attuale
  from public.pagamenti p
  join public.vendite v on v.id = p.vendita_id
  where p.id = p_pagamento_id
    and (
      v.venditore_id = v_user
      or v.creato_da = v_user
      or public.is_admin()
    )
  for update of p;

  if v_vendita_id is null then
    raise exception 'Pagamento non disponibile';
  end if;

  if v_stato_attuale = 'annullato' then
    raise exception 'Non è possibile modificare un pagamento annullato';
  end if;

  select v.importo_vendita into v_totale
  from public.vendite v
  where v.id = v_vendita_id
  for update;

  select coalesce(sum(p.importo), 0)
  into v_incassato_altri
  from public.pagamenti p
  where p.vendita_id = v_vendita_id
    and p.stato in ('previsto', 'incassato')
    and p.id <> p_pagamento_id;

  if v_incassato_altri + p_importo > v_totale then
    raise exception 'Importo superiore al residuo';
  end if;

  -- Snapshot economico: richiesto solo per pagamenti incassati.
  if v_stato_attuale = 'incassato' then
    if jsonb_typeof(p_calcolo) <> 'object' then
      raise exception 'Snapshot economico non valido';
    end if;

    if jsonb_typeof(p_partecipanti) <> 'array'
       or jsonb_array_length(p_partecipanti) = 0 then
      raise exception 'Partecipanti pagamento mancanti';
    end if;

    v_importo_snapshot :=
      coalesce((p_calcolo ->> 'importo_pagamento')::numeric, 0);

    v_importo_costi :=
      coalesce((p_calcolo ->> 'importo_costi')::numeric, 0);

    v_margine :=
      coalesce((p_calcolo ->> 'margine')::numeric, 0);

    v_importo_tasse :=
      coalesce((p_calcolo ->> 'importo_tasse')::numeric, 0);

    v_netto :=
      coalesce((p_calcolo ->> 'netto_distribuibile')::numeric, 0);

    if abs(v_importo_snapshot - p_importo) > 0.01 then
      raise exception 'Importo snapshot diverso dal pagamento';
    end if;

    if v_importo_costi < 0
       or v_margine < 0
       or v_importo_tasse < 0
       or v_netto < 0 then
      raise exception 'Valori economici negativi non validi';
    end if;

    if abs(v_margine - greatest(0, p_importo - v_importo_costi)) > 0.01 then
      raise exception 'Margine pagamento non coerente';
    end if;

    if abs(v_netto - greatest(0, v_margine - v_importo_tasse)) > 0.01 then
      raise exception 'Netto distribuibile non coerente';
    end if;

    if jsonb_typeof(
      coalesce(p_calcolo -> 'costi_snapshot', '[]'::jsonb)
    ) <> 'array' then
      raise exception 'Snapshot costi non valido';
    end if;

    select count(*)
    into v_numero_partecipanti
    from public.vendita_partecipanti vp
    where vp.vendita_id = v_vendita_id;

    select count(distinct elemento ->> 'profilo_id')
    into v_numero_snapshot
    from jsonb_array_elements(p_partecipanti) elemento;

    if v_numero_partecipanti = 0
       or v_numero_snapshot <> v_numero_partecipanti then
      raise exception 'Partecipanti pagamento non coerenti con la vendita';
    end if;

    if jsonb_array_length(p_partecipanti) <> v_numero_snapshot then
      raise exception 'Partecipanti duplicati nel pagamento';
    end if;

    -- Stessa configurazione consolidata usata in registrazione:
    -- ruolo, modalità di fatturazione e quota_override devono
    -- corrispondere alla vendita.
    --
    -- Il referente è escluso dal confronto quota_override perché
    -- assorbe il residuo economico della singola rata.
    if exists (
      select 1
      from jsonb_array_elements(p_partecipanti) elemento
      left join public.vendita_partecipanti vp
        on vp.vendita_id = v_vendita_id
       and vp.profilo_id = (elemento ->> 'profilo_id')::uuid
      where vp.id is null
         or coalesce(elemento ->> 'ruolo', '') <>
            coalesce(vp.ruolo, '')
         or coalesce(
              nullif(
                elemento ->> 'modalita_fatturazione',
                ''
              ),
              'nessuna'
            ) <>
            coalesce(
              nullif(vp.modalita_fatturazione, ''),
              case
                when vp.fa_fattura then 'totale'
                else 'nessuna'
              end
            )
         or (
           coalesce(elemento ->> 'ruolo', '') <> 'referente'
           and coalesce(
             (elemento ->> 'quota_override')::boolean,
             false
           ) <>
           coalesce(vp.quota_override, false)
         )
    ) then
      raise exception
        'Partecipante non coerente con la configurazione consolidata della vendita';
    end if;

    select count(*)
    into v_numero_referenti
    from jsonb_array_elements(p_partecipanti) elemento
    where elemento ->> 'ruolo' = 'referente';

    if v_numero_referenti <> 1 then
      raise exception 'Referente economico pagamento non valido';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_partecipanti) elemento
      where coalesce(elemento ->> 'modalita_fatturazione', 'nessuna')
            not in ('nessuna', 'mista', 'totale')
         or coalesce((elemento ->> 'importo_fatturato')::numeric, 0) < 0
         or coalesce((elemento ->> 'quota_base')::numeric, 0) < 0
         or coalesce((elemento ->> 'quota_teorica')::numeric, 0) < 0
         or coalesce((elemento ->> 'importo_riduzione')::numeric, 0) < 0
         or coalesce((elemento ->> 'bonus_admin')::numeric, 0) < 0
         or coalesce((elemento ->> 'quota_calcolata')::numeric, 0) < 0
         or coalesce((elemento ->> 'quota_effettiva')::numeric, 0) < 0
    ) then
      raise exception 'Valori partecipante pagamento non validi';
    end if;

    select coalesce(
      sum((elemento ->> 'quota_effettiva')::numeric),
      0
    )
    into v_totale_quote
    from jsonb_array_elements(p_partecipanti) elemento;

    if abs(v_totale_quote - v_netto) > 0.01 then
      raise exception 'Le quote del pagamento non quadrano';
    end if;
  end if;

  update public.pagamenti
  set importo = p_importo,
      data_pagamento = case
        when v_stato_attuale = 'incassato'
          then coalesce(p_data_pagamento, data_pagamento, current_date)
        else data_pagamento
      end,
      metodo = nullif(trim(p_metodo), ''),
      note = nullif(trim(p_note), '')
  where id = p_pagamento_id;

  if v_stato_attuale = 'incassato' then
    delete from public.pagamento_partecipanti
    where pagamento_id = p_pagamento_id;

    delete from public.pagamento_calcoli
    where pagamento_id = p_pagamento_id;

    insert into public.pagamento_calcoli (
      pagamento_id,
      importo_pagamento,
      importo_costi,
      margine,
      percentuale_tasse,
      percentuale_fatturata_admin,
      importo_tasse,
      netto_distribuibile,
      costi_snapshot
    )
    values (
      p_pagamento_id,
      v_importo_snapshot,
      v_importo_costi,
      v_margine,
      coalesce((p_calcolo ->> 'percentuale_tasse')::numeric, 0),
      coalesce((p_calcolo ->> 'percentuale_fatturata_admin')::numeric, 0),
      v_importo_tasse,
      v_netto,
      coalesce(p_calcolo -> 'costi_snapshot', '[]'::jsonb)
    );

    insert into public.pagamento_partecipanti (
      pagamento_id,
      profilo_id,
      ruolo,
      modalita_fatturazione,
      importo_fatturato,
      quota_base,
      quota_teorica,
      percentuale_riduzione,
      importo_riduzione,
      bonus_admin,
      quota_calcolata,
      quota_effettiva,
      quota_override,
      note_quota
    )
    select
      p_pagamento_id,
      (elemento ->> 'profilo_id')::uuid,
      nullif(elemento ->> 'ruolo', ''),
      coalesce(nullif(elemento ->> 'modalita_fatturazione', ''), 'nessuna'),
      coalesce((elemento ->> 'importo_fatturato')::numeric, 0),
      coalesce((elemento ->> 'quota_base')::numeric, 0),
      coalesce((elemento ->> 'quota_teorica')::numeric, 0),
      coalesce((elemento ->> 'percentuale_riduzione')::numeric, 0),
      coalesce((elemento ->> 'importo_riduzione')::numeric, 0),
      coalesce((elemento ->> 'bonus_admin')::numeric, 0),
      coalesce((elemento ->> 'quota_calcolata')::numeric, 0),
      coalesce((elemento ->> 'quota_effettiva')::numeric, 0),
      coalesce((elemento ->> 'quota_override')::boolean, false),
      nullif(trim(elemento ->> 'note_quota'), '')
    from jsonb_array_elements(p_partecipanti) elemento;
  end if;

  return p_pagamento_id;
end;
$$;

revoke all on function public.modifica_pagamento_economico(
  uuid, numeric, date, text, text, jsonb, jsonb
) from public, anon;

grant execute on function public.modifica_pagamento_economico(
  uuid, numeric, date, text, text, jsonb, jsonb
) to authenticated;
