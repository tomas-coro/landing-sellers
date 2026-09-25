-- Landing Sellers
-- Source of truth commerciale unico.
--
-- Obiettivi:
-- 1. i dati commerciali si inseriscono una sola volta;
-- 2. vendita attiva e cliente restano sincronizzati;
-- 3. i clienti legacy vengono completati solo con dati già esistenti;
-- 4. prezzi, pagamenti, quote e costi storici NON vengono ricalcolati.

-- ============================================================
-- Helper: descrizione commerciale canonica lato DB
-- ============================================================

create or replace function public.descrizione_configurazione_commerciale(
  p_configurazione jsonb,
  p_fallback text default null
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cfg jsonb := coalesce(p_configurazione, '{}'::jsonb);
  v_formula text;
  v_descrizione_salvata text;
  v_voci text[] := array[]::text[];
  v_upgrade text;
  v_pagine integer;
  v_lingue integer;
  v_dominio_it integer;
  v_dominio_com integer;
  v_email integer;
begin
  v_descrizione_salvata :=
    nullif(trim(v_cfg ->> 'descrizione_pacchetto'), '');

  if v_descrizione_salvata is not null then
    return v_descrizione_salvata;
  end if;

  v_formula :=
    coalesce(
      nullif(trim(v_cfg ->> 'formula'), ''),
      nullif(trim(v_cfg ->> 'periodicita_contratto'), '')
    );

  if v_formula = 'mensile' then
    v_voci := array_append(v_voci, 'Start mensile');
  elsif v_formula = 'annuale' then
    v_voci := array_append(v_voci, 'Start annuale');
  end if;

  for v_upgrade in
    select value
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_cfg -> 'upgrade') = 'array'
          then v_cfg -> 'upgrade'
        else '[]'::jsonb
      end
    )
  loop
    if v_upgrade = 'modulo_dinamico' then
      v_voci := array_append(
        v_voci,
        'Modulo di contatto dinamico'
      );
    elsif v_upgrade = 'gallery_dinamica' then
      v_voci := array_append(
        v_voci,
        'Gallery dinamica'
      );
    elsif v_upgrade = 'chatbot_ai' then
      v_voci := array_append(
        v_voci,
        'Chatbot AI personalizzato'
      );
    end if;
  end loop;

  v_pagine :=
    greatest(
      0,
      coalesce((v_cfg ->> 'pagine_extra')::integer, 0)
    );

  if v_pagine = 1 then
    v_voci := array_append(v_voci, '1 pagina extra');
  elsif v_pagine > 1 then
    v_voci := array_append(
      v_voci,
      v_pagine || ' pagine extra'
    );
  end if;

  v_lingue :=
    greatest(
      0,
      coalesce((v_cfg ->> 'lingue_extra')::integer, 0)
    );

  if v_lingue = 1 then
    v_voci := array_append(v_voci, '1 lingua extra');
  elsif v_lingue > 1 then
    v_voci := array_append(
      v_voci,
      v_lingue || ' lingue extra'
    );
  end if;

  if coalesce(
    (v_cfg ->> 'cliente_ha_dominio')::boolean,
    true
  ) = false then

    v_dominio_it :=
      greatest(
        0,
        coalesce((v_cfg ->> 'dominio_it')::integer, 0)
      );

    v_dominio_com :=
      greatest(
        0,
        coalesce((v_cfg ->> 'dominio_com')::integer, 0)
      );

    v_email :=
      greatest(
        0,
        coalesce(
          (v_cfg ->> 'email_5_caselle')::integer,
          0
        )
      );

    if v_dominio_it > 0 then
      v_voci := array_append(
        v_voci,
        'Dominio .it' ||
        case
          when v_dominio_it > 1
            then ' x' || v_dominio_it
          else ''
        end
      );
    end if;

    if v_dominio_com > 0 then
      v_voci := array_append(
        v_voci,
        'Dominio .com' ||
        case
          when v_dominio_com > 1
            then ' x' || v_dominio_com
          else ''
        end
      );
    end if;

    if v_email > 0 then
      v_voci := array_append(
        v_voci,
        'Email - 5 caselle da 1 GB' ||
        case
          when v_email > 1
            then ' x' || v_email
          else ''
        end
      );
    end if;
  end if;

  if
    v_formula = 'mensile'
    and coalesce(
      (v_cfg ->> 'pacchetto_sicurezza')::boolean,
      false
    )
  then
    v_voci := array_append(
      v_voci,
      'Conservazione garantita per 12 mesi'
    );
  end if;

  if cardinality(v_voci) > 0 then
    return array_to_string(v_voci, ' + ');
  end if;

  return nullif(trim(p_fallback), '');
end;
$$;


-- ============================================================
-- Helper: sincronizza cliente dai dati commerciali canonici
-- ============================================================

create or replace function public.sincronizza_cliente_da_configurazione(
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
  v_cfg jsonb := coalesce(p_configurazione, '{}'::jsonb);
  v_formula text;
  v_descrizione text;
  v_durata integer;
  v_sconto_tipo text;
  v_sconto_valore numeric;
  v_sconto_durata integer;
begin
  if p_cliente_id is null then
    return;
  end if;

  v_formula :=
    coalesce(
      nullif(trim(v_cfg ->> 'formula'), ''),
      nullif(trim(v_cfg ->> 'periodicita_contratto'), '')
    );

  if v_formula not in ('mensile', 'annuale') then
    v_formula := null;
  end if;

  v_descrizione :=
    coalesce(
      nullif(trim(p_descrizione), ''),
      public.descrizione_configurazione_commerciale(
        v_cfg,
        null
      )
    );

  v_durata :=
    case
      when v_cfg ? 'durata_contratto_anni'
        then greatest(
          1,
          least(
            4,
            coalesce(
              (v_cfg ->> 'durata_contratto_anni')::integer,
              1
            )
          )
        )
      else null
    end;

  v_sconto_tipo :=
    case
      when v_cfg ? 'sconto_tipo'
        then nullif(trim(v_cfg ->> 'sconto_tipo'), '')
      else null
    end;

  if v_sconto_tipo not in (
    'percentuale',
    'fisso',
    'prezzo_fisso'
  ) then
    v_sconto_tipo := null;
  end if;

  v_sconto_valore :=
    case
      when v_cfg ? 'sconto_valore'
        then greatest(
          0,
          coalesce(
            (v_cfg ->> 'sconto_valore')::numeric,
            0
          )
        )
      else null
    end;

  v_sconto_durata :=
    case
      when v_cfg ? 'sconto_durata_anni'
        and nullif(
          trim(v_cfg ->> 'sconto_durata_anni'),
          ''
        ) is not null
      then greatest(
        1,
        least(
          coalesce(v_durata, 4),
          (v_cfg ->> 'sconto_durata_anni')::integer
        )
      )
      else null
    end;

  update public.clienti
  set
    nome_pacchetto =
      coalesce(
        v_descrizione,
        nome_pacchetto
      ),

    periodicita_contratto =
      coalesce(
        v_formula,
        periodicita_contratto
      ),

    data_attivazione =
      case
        when
          v_cfg ? 'data_attivazione'
          and nullif(
            trim(v_cfg ->> 'data_attivazione'),
            ''
          ) is not null
        then
          (v_cfg ->> 'data_attivazione')::date
        else data_attivazione
      end,

    durata_contratto_anni =
      case
        when v_cfg ? 'durata_contratto_anni'
          then v_durata
        else durata_contratto_anni
      end,

    sconto_tipo =
      case
        when v_cfg ? 'sconto_tipo'
          then v_sconto_tipo
        else sconto_tipo
      end,

    sconto_valore =
      case
        when v_cfg ? 'sconto_valore'
          then coalesce(v_sconto_valore, 0)
        else sconto_valore
      end,

    sconto_durata_anni =
      case
        when v_cfg ? 'sconto_durata_anni'
          then v_sconto_durata
        else sconto_durata_anni
      end,

    pagine_extra =
      case
        when v_cfg ? 'pagine_extra'
          then greatest(
            0,
            least(
              15,
              coalesce(
                (v_cfg ->> 'pagine_extra')::integer,
                0
              )
            )
          )
        else pagine_extra
      end,

    lingue_extra =
      case
        when v_cfg ? 'lingue_extra'
          then greatest(
            0,
            least(
              5,
              coalesce(
                (v_cfg ->> 'lingue_extra')::integer,
                0
              )
            )
          )
        else lingue_extra
      end,

    cliente_ha_dominio =
      case
        when v_cfg ? 'cliente_ha_dominio'
          then coalesce(
            (v_cfg ->> 'cliente_ha_dominio')::boolean,
            true
          )
        else cliente_ha_dominio
      end,

    dominio_it =
      case
        when v_cfg ? 'dominio_it'
          then greatest(
            0,
            least(
              10,
              coalesce(
                (v_cfg ->> 'dominio_it')::integer,
                0
              )
            )
          )
        else dominio_it
      end,

    dominio_com =
      case
        when v_cfg ? 'dominio_com'
          then greatest(
            0,
            least(
              10,
              coalesce(
                (v_cfg ->> 'dominio_com')::integer,
                0
              )
            )
          )
        else dominio_com
      end,

    email_5_caselle =
      case
        when v_cfg ? 'email_5_caselle'
          then greatest(
            0,
            least(
              10,
              coalesce(
                (v_cfg ->> 'email_5_caselle')::integer,
                0
              )
            )
          )
        else email_5_caselle
      end,

    pacchetto_sicurezza =
      case
        when v_cfg ? 'pacchetto_sicurezza'
          then coalesce(
            (v_cfg ->> 'pacchetto_sicurezza')::boolean,
            false
          )
        else pacchetto_sicurezza
      end

  where id = p_cliente_id;
end;
$$;

revoke all
on function public.sincronizza_cliente_da_configurazione(
  uuid,
  jsonb,
  text
)
from public, anon, authenticated;


-- ============================================================
-- registra_vendita_completa:
-- registra vendita + snapshot + sincronizza cliente
-- ============================================================

create or replace function public.registra_vendita_completa(
  p_vendita jsonb,
  p_configurazione jsonb default '{}'::jsonb,
  p_costi jsonb default '[]'::jsonb,
  p_partecipanti jsonb default '[]'::jsonb,
  p_pagamento jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendita_id uuid;
  v_cliente_id uuid;
  v_descrizione text;
  v_cfg jsonb;
begin
  if jsonb_typeof(
    coalesce(p_configurazione, '{}'::jsonb)
  ) <> 'object' then
    raise exception 'Configurazione commerciale non valida';
  end if;

  v_cliente_id :=
    nullif(p_vendita ->> 'cliente_id', '')::uuid;

  v_vendita_id :=
    public.registra_vendita_economica(
      p_vendita,
      p_costi,
      p_partecipanti,
      p_pagamento
    );

  v_cfg :=
    coalesce(
      p_configurazione,
      '{}'::jsonb
    );

  v_descrizione :=
    coalesce(
      public.descrizione_configurazione_commerciale(
        v_cfg,
        p_vendita ->> 'servizio'
      ),
      nullif(trim(p_vendita ->> 'servizio'), ''),
      'Servizio registrato'
    );

  v_cfg :=
    v_cfg ||
    jsonb_build_object(
      'descrizione_pacchetto',
      v_descrizione
    );

  update public.vendite
  set
    servizio = v_descrizione,
    configurazione_commerciale = v_cfg
  where id = v_vendita_id;

  perform public.sincronizza_cliente_da_configurazione(
    v_cliente_id,
    v_cfg,
    v_descrizione
  );

  return v_vendita_id;
end;
$$;

revoke all
on function public.registra_vendita_completa(
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from public, anon;

grant execute
on function public.registra_vendita_completa(
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
to authenticated;


-- ============================================================
-- aggiorna_servizi_cliente:
-- stessa fonte canonica, nessun ricalcolo economico
-- ============================================================

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

  v_descrizione :=
    coalesce(
      public.descrizione_configurazione_commerciale(
        v_cfg_nuova,
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


-- ============================================================
-- BACKFILL LEGACY
--
-- Completa SOLO configurazioni vuote/parziali usando dati
-- già presenti nel cliente e nella vendita.
-- Non tocca importi, pagamenti, quote o costi.
-- ============================================================

do $$
declare
  r record;
  v_cfg jsonb;
  v_upgrade jsonb;
  v_descrizione text;
  v_testo text;
begin
  for r in
    select
      v.id as vendita_id,
      v.cliente_id,
      v.servizio,
      coalesce(
        v.configurazione_commerciale,
        '{}'::jsonb
      ) as cfg,

      c.nome_pacchetto,
      c.periodicita_contratto,
      c.data_attivazione,
      c.durata_contratto_anni,
      c.sconto_tipo,
      c.sconto_valore,
      c.sconto_durata_anni,
      c.pagine_extra,
      c.lingue_extra,
      c.cliente_ha_dominio,
      c.dominio_it,
      c.dominio_com,
      c.email_5_caselle,
      c.pacchetto_sicurezza

    from public.vendite v
    join public.clienti c
      on c.id = v.cliente_id

    where v.stato = 'attiva'
      and c.cancellato_il is null
  loop
    v_testo :=
      lower(
        coalesce(r.servizio, '') ||
        ' ' ||
        coalesce(r.nome_pacchetto, '')
      );

    v_upgrade :=
      case
        when jsonb_typeof(r.cfg -> 'upgrade') = 'array'
          then r.cfg -> 'upgrade'
        else '[]'::jsonb
      end;

    if
      not (v_upgrade ? 'modulo_dinamico')
      and v_testo like '%modulo di contatto dinamico%'
    then
      v_upgrade :=
        v_upgrade || '["modulo_dinamico"]'::jsonb;
    end if;

    if
      not (v_upgrade ? 'gallery_dinamica')
      and v_testo like '%gallery dinamica%'
    then
      v_upgrade :=
        v_upgrade || '["gallery_dinamica"]'::jsonb;
    end if;

    if
      not (v_upgrade ? 'chatbot_ai')
      and v_testo like '%chatbot ai personalizzato%'
    then
      v_upgrade :=
        v_upgrade || '["chatbot_ai"]'::jsonb;
    end if;

    v_cfg :=
      r.cfg ||
      jsonb_strip_nulls(
        jsonb_build_object(
          'formula',
          coalesce(
            nullif(r.cfg ->> 'formula', ''),
            r.periodicita_contratto
          ),

          'periodicita_contratto',
          coalesce(
            nullif(
              r.cfg ->> 'periodicita_contratto',
              ''
            ),
            r.periodicita_contratto
          ),

          'upgrade',
          v_upgrade,

          'data_attivazione',
          coalesce(
            nullif(
              r.cfg ->> 'data_attivazione',
              ''
            ),
            r.data_attivazione::text
          ),

          'durata_contratto_anni',
          coalesce(
            nullif(
              r.cfg ->> 'durata_contratto_anni',
              ''
            )::integer,
            r.durata_contratto_anni
          ),

          'sconto_tipo',
          coalesce(
            nullif(r.cfg ->> 'sconto_tipo', ''),
            r.sconto_tipo
          ),

          'sconto_valore',
          case
            when r.cfg ? 'sconto_valore'
              then (r.cfg ->> 'sconto_valore')::numeric
            else r.sconto_valore
          end,

          'sconto_durata_anni',
          coalesce(
            nullif(
              r.cfg ->> 'sconto_durata_anni',
              ''
            )::integer,
            r.sconto_durata_anni
          ),

          'pagine_extra',
          case
            when r.cfg ? 'pagine_extra'
              then (r.cfg ->> 'pagine_extra')::integer
            else r.pagine_extra
          end,

          'lingue_extra',
          case
            when r.cfg ? 'lingue_extra'
              then (r.cfg ->> 'lingue_extra')::integer
            else r.lingue_extra
          end,

          'cliente_ha_dominio',
          case
            when r.cfg ? 'cliente_ha_dominio'
              then (r.cfg ->> 'cliente_ha_dominio')::boolean
            else r.cliente_ha_dominio
          end,

          'dominio_it',
          case
            when r.cfg ? 'dominio_it'
              then (r.cfg ->> 'dominio_it')::integer
            else r.dominio_it
          end,

          'dominio_com',
          case
            when r.cfg ? 'dominio_com'
              then (r.cfg ->> 'dominio_com')::integer
            else r.dominio_com
          end,

          'email_5_caselle',
          case
            when r.cfg ? 'email_5_caselle'
              then (r.cfg ->> 'email_5_caselle')::integer
            else r.email_5_caselle
          end,

          'pacchetto_sicurezza',
          case
            when r.cfg ? 'pacchetto_sicurezza'
              then (r.cfg ->> 'pacchetto_sicurezza')::boolean
            else r.pacchetto_sicurezza
          end
        )
      );

    v_descrizione :=
      public.descrizione_configurazione_commerciale(
        v_cfg - 'descrizione_pacchetto',
        coalesce(
          nullif(trim(r.nome_pacchetto), ''),
          nullif(trim(r.servizio), '')
        )
      );

    if v_descrizione is not null then
      v_cfg :=
        v_cfg ||
        jsonb_build_object(
          'descrizione_pacchetto',
          v_descrizione
        );
    end if;

    update public.vendite
    set
      configurazione_commerciale = v_cfg,
      servizio = coalesce(
        v_descrizione,
        servizio
      )
    where id = r.vendita_id;

    perform public.sincronizza_cliente_da_configurazione(
      r.cliente_id,
      v_cfg,
      v_descrizione
    );
  end loop;
end;
$$;


-- ============================================================
-- SINCRONIZZAZIONE CLIENTE -> VENDITA ATTIVA
--
-- Se un dato commerciale viene corretto dalla scheda cliente,
-- la configurazione della vendita attiva viene aggiornata nello
-- stesso momento.
--
-- NON modifica:
-- - importo_vendita
-- - pagamenti
-- - quote
-- - costi
-- ============================================================

create or replace function public.sincronizza_vendita_da_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendita_id uuid;
  v_cfg jsonb;
  v_descrizione text;
begin
  select
    v.id,
    coalesce(
      v.configurazione_commerciale,
      '{}'::jsonb
    )
  into
    v_vendita_id,
    v_cfg
  from public.vendite v
  where v.cliente_id = new.id
    and v.stato = 'attiva'
  order by
    v.data_vendita desc nulls last,
    v.creato_il desc
  limit 1;

  if v_vendita_id is null then
    return new;
  end if;

  /*
   * Manteniamo gli elementi presenti solo nella vendita
   * (es. upgrade), ma sovrascriviamo tutti i campi che hanno
   * una rappresentazione anche sul cliente.
   */
  v_cfg :=
    v_cfg ||
    jsonb_build_object(
      'formula',
      new.periodicita_contratto,

      'periodicita_contratto',
      new.periodicita_contratto,

      'data_attivazione',
      new.data_attivazione,

      'durata_contratto_anni',
      new.durata_contratto_anni,

      'sconto_tipo',
      new.sconto_tipo,

      'sconto_valore',
      new.sconto_valore,

      'sconto_durata_anni',
      new.sconto_durata_anni,

      'pagine_extra',
      new.pagine_extra,

      'lingue_extra',
      new.lingue_extra,

      'cliente_ha_dominio',
      new.cliente_ha_dominio,

      'dominio_it',
      new.dominio_it,

      'dominio_com',
      new.dominio_com,

      'email_5_caselle',
      new.email_5_caselle,

      'pacchetto_sicurezza',
      new.pacchetto_sicurezza
    );

  /*
   * Rigenera sempre il testo leggibile dai dati correnti:
   * una vecchia label come "Sito web" non deve vincere sui
   * dati commerciali realmente compilati.
   */
  v_descrizione :=
    public.descrizione_configurazione_commerciale(
      v_cfg - 'descrizione_pacchetto',
      coalesce(
        nullif(trim(new.nome_pacchetto), ''),
        (
          select nullif(trim(servizio), '')
          from public.vendite
          where id = v_vendita_id
        )
      )
    );

  if v_descrizione is not null then
    v_cfg :=
      v_cfg ||
      jsonb_build_object(
        'descrizione_pacchetto',
        v_descrizione
      );
  end if;

  update public.vendite
  set
    configurazione_commerciale = v_cfg,
    servizio = coalesce(
      v_descrizione,
      servizio
    )
  where id = v_vendita_id;

  return new;
end;
$$;

revoke all
on function public.sincronizza_vendita_da_cliente()
from public, anon;

drop trigger if exists
  trg_sincronizza_vendita_da_cliente
on public.clienti;

create trigger trg_sincronizza_vendita_da_cliente
after update of
  nome_pacchetto,
  periodicita_contratto,
  data_attivazione,
  durata_contratto_anni,
  sconto_tipo,
  sconto_valore,
  sconto_durata_anni,
  pagine_extra,
  lingue_extra,
  cliente_ha_dominio,
  dominio_it,
  dominio_com,
  email_5_caselle,
  pacchetto_sicurezza
on public.clienti
for each row
execute function public.sincronizza_vendita_da_cliente();
