-- Landing Sellers
-- Correzione ruoli applicativi vs ruoli economici
-- 2026-09-09
--
-- L'account admin tecnico resta admin dell'app.
-- Alessandro resta un normale venditore nell'app, ma viene marcato
-- come referente economico. Tomas viene marcato come produzione.

alter table public.profili
  add column if not exists ruolo_economico text;

alter table public.profili
  drop constraint if exists profili_ruolo_economico_check;

alter table public.profili
  add constraint profili_ruolo_economico_check
  check (
    ruolo_economico is null
    or ruolo_economico in ('referente', 'produzione')
  );

-- Verifica preventiva degli account reali del progetto.
do $$
begin
  if not exists (
    select 1 from public.profili
    where id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
      and ruolo = 'venditore'
  ) then
    raise exception 'Profilo Alessandro venditore non trovato';
  end if;

  if not exists (
    select 1 from public.profili
    where id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
      and ruolo = 'venditore'
  ) then
    raise exception 'Profilo Tomas venditore non trovato';
  end if;
end;
$$;

-- Mantiene separato l'admin tecnico dall'organizzazione economica.
update public.profili
set ruolo_economico = null
where ruolo_economico in ('referente', 'produzione');

update public.profili
set ruolo_economico = 'referente'
where id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid;

update public.profili
set ruolo_economico = 'produzione'
where id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid;

create unique index if not exists profili_unico_referente_economico_idx
  on public.profili (ruolo_economico)
  where ruolo_economico = 'referente';

-- La vecchia funzione non esponeva ruolo_economico: il tipo di ritorno cambia,
-- quindi va ricreata.
drop function if exists public.get_partecipanti_economici();

create function public.get_partecipanti_economici()
returns table (
  id uuid,
  nome text,
  username text,
  ruolo text,
  ruolo_economico text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.nome,
    p.username,
    p.ruolo,
    p.ruolo_economico
  from public.profili p
  where p.ruolo <> 'admin'
     or p.id = auth.uid()
  order by
    case p.ruolo_economico
      when 'referente' then 0
      when 'produzione' then 1
      else 2
    end,
    p.nome nulls last,
    p.username nulls last;
$$;

revoke all
on function public.get_partecipanti_economici()
from public, anon;

grant execute
on function public.get_partecipanti_economici()
to authenticated;

-- Ricrea la RPC di registrazione: admin_id resta il nome legacy della colonna,
-- ma ora contiene il referente economico (Alessandro), non l'admin tecnico.
create or replace function public.registra_vendita_economica(
  p_vendita jsonb,
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
  v_user uuid := auth.uid();
  v_vendita_id uuid;
  v_cliente_id uuid;
  v_venditore_id uuid;
  v_admin_id uuid;
  v_importo numeric(12,2);
  v_elemento jsonb;
begin
  if v_user is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_vendita is null then
    raise exception 'Dati vendita mancanti';
  end if;

  v_cliente_id := nullif(p_vendita->>'cliente_id', '')::uuid;
  v_venditore_id := nullif(p_vendita->>'venditore_id', '')::uuid;
  v_admin_id := nullif(p_vendita->>'admin_id', '')::uuid;
  v_importo := coalesce((p_vendita->>'importo_vendita')::numeric, 0);

  if v_cliente_id is null or v_venditore_id is null or v_admin_id is null then
    raise exception 'Cliente, venditore o referente economico mancanti';
  end if;

  if v_importo <= 0 then
    raise exception 'Importo vendita non valido';
  end if;

  if not exists (
    select 1
    from public.clienti c
    where c.id = v_cliente_id
      and c.cancellato_il is null
  ) then
    raise exception 'Cliente non valido';
  end if;

  if jsonb_typeof(coalesce(p_costi, '[]'::jsonb)) <> 'array' then
    raise exception 'Costi non validi';
  end if;

  if jsonb_typeof(coalesce(p_partecipanti, '[]'::jsonb)) <> 'array' then
    raise exception 'Partecipanti non validi';
  end if;

  if jsonb_array_length(coalesce(p_partecipanti, '[]'::jsonb)) = 0 then
    raise exception 'Nessun partecipante indicato';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
  ) <> (
    select count(distinct nullif(e->>'profilo_id', ''))
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
  ) then
    raise exception 'Partecipanti duplicati';
  end if;

  if not exists (
    select 1
    from public.profili p
    where p.id = v_admin_id
      and p.ruolo = 'venditore'
      and p.ruolo_economico = 'referente'
  ) then
    raise exception 'Referente economico non valido';
  end if;

  if not exists (
    select 1
    from public.profili p
    where p.id = v_venditore_id
      and p.ruolo = 'venditore'
  ) then
    raise exception 'Venditore non valido';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
    where nullif(e->>'profilo_id', '')::uuid = v_user
  ) then
    raise exception 'Chi registra deve essere incluso tra i partecipanti';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
    where nullif(e->>'profilo_id', '')::uuid = v_admin_id
      and e->>'ruolo' = 'referente'
  ) then
    raise exception 'Referente economico assente dalla ripartizione';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb)) e
    where nullif(e->>'profilo_id', '')::uuid = v_venditore_id
  ) then
    raise exception 'Venditore assente dalla ripartizione';
  end if;

  insert into public.vendite (
    cliente_id,
    venditore_id,
    admin_id,
    creato_da,
    servizio,
    descrizione,
    importo_vendita,
    stato,
    data_vendita,
    modalita_fatturazione_admin,
    importo_fatturato_admin,
    percentuale_tasse_admin
  ) values (
    v_cliente_id,
    v_venditore_id,
    v_admin_id,
    v_user,
    coalesce(nullif(trim(p_vendita->>'servizio'), ''), 'Servizio registrato'),
    nullif(trim(p_vendita->>'descrizione'), ''),
    v_importo,
    'attiva',
    coalesce(nullif(p_vendita->>'data_vendita', '')::date, current_date),
    coalesce(nullif(p_vendita->>'modalita_fatturazione_admin', ''), 'nessuna'),
    coalesce((p_vendita->>'importo_fatturato_admin')::numeric, 0),
    coalesce((p_vendita->>'percentuale_tasse_admin')::numeric, 40)
  )
  returning id into v_vendita_id;

  for v_elemento in
    select value
    from jsonb_array_elements(coalesce(p_costi, '[]'::jsonb))
  loop
    insert into public.costi_vendita (
      vendita_id,
      descrizione,
      importo
    ) values (
      v_vendita_id,
      coalesce(nullif(trim(v_elemento->>'descrizione'), ''), 'Costo'),
      coalesce((v_elemento->>'importo')::numeric, 0)
    );
  end loop;

  for v_elemento in
    select value
    from jsonb_array_elements(coalesce(p_partecipanti, '[]'::jsonb))
  loop
    insert into public.vendita_partecipanti (
      vendita_id,
      profilo_id,
      ruolo,
      fa_fattura,
      quota_base,
      percentuale_tasse,
      importo_tasse,
      percentuale_riduzione,
      importo_riduzione,
      importo_trasferito_admin,
      quota_finale,
      saldato,
      data_saldo,
      modalita_fatturazione,
      importo_fatturato,
      quota_calcolata,
      quota_effettiva,
      quota_override,
      note_quota
    ) values (
      v_vendita_id,
      nullif(v_elemento->>'profilo_id', '')::uuid,
      nullif(v_elemento->>'ruolo', ''),
      coalesce((v_elemento->>'fa_fattura')::boolean, false),
      coalesce((v_elemento->>'quota_base')::numeric, 0),
      coalesce((v_elemento->>'percentuale_tasse')::numeric, 0),
      coalesce((v_elemento->>'importo_tasse')::numeric, 0),
      coalesce((v_elemento->>'percentuale_riduzione')::numeric, 0),
      coalesce((v_elemento->>'importo_riduzione')::numeric, 0),
      coalesce((v_elemento->>'importo_trasferito_admin')::numeric, 0),
      coalesce((v_elemento->>'quota_finale')::numeric, 0),
      coalesce((v_elemento->>'saldato')::boolean, false),
      nullif(v_elemento->>'data_saldo', '')::date,
      coalesce(nullif(v_elemento->>'modalita_fatturazione', ''), 'nessuna'),
      coalesce((v_elemento->>'importo_fatturato')::numeric, 0),
      coalesce((v_elemento->>'quota_calcolata')::numeric, 0),
      coalesce((v_elemento->>'quota_effettiva')::numeric, 0),
      coalesce((v_elemento->>'quota_override')::boolean, false),
      nullif(trim(v_elemento->>'note_quota'), '')
    );
  end loop;

  if p_pagamento is not null then
    if coalesce((p_pagamento->>'importo')::numeric, 0) <= 0 then
      raise exception 'Importo pagamento non valido';
    end if;

    insert into public.pagamenti (
      vendita_id,
      incassato_da,
      creato_da,
      importo,
      stato,
      data_scadenza,
      data_pagamento,
      metodo,
      note
    ) values (
      v_vendita_id,
      coalesce(
        nullif(p_pagamento->>'incassato_da', '')::uuid,
        v_admin_id
      ),
      v_user,
      (p_pagamento->>'importo')::numeric,
      coalesce(nullif(p_pagamento->>'stato', ''), 'incassato'),
      nullif(p_pagamento->>'data_scadenza', '')::date,
      nullif(p_pagamento->>'data_pagamento', '')::date,
      nullif(trim(p_pagamento->>'metodo'), ''),
      nullif(trim(p_pagamento->>'note'), '')
    );
  end if;

  return v_vendita_id;
end;
$$;

revoke all
on function public.registra_vendita_economica(jsonb, jsonb, jsonb, jsonb)
from public, anon;

grant execute
on function public.registra_vendita_economica(jsonb, jsonb, jsonb, jsonb)
to authenticated;
