-- Alessandro gestisce vendita e produzione; Tomas resta solo developer.

-- Ruoli reali.
update public.profili
set ruolo = 'venditore', ruolo_economico = 'referente'
where id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid;

update public.profili
set ruolo = 'developer', ruolo_economico = null
where id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid;

-- Consolida in Alessandro le quote storiche nelle vendite in cui entrambi
-- risultavano partecipanti.
update public.vendita_partecipanti alessandro
set quota_base = alessandro.quota_base + tomas.quota_base,
    importo_tasse = alessandro.importo_tasse + tomas.importo_tasse,
    importo_riduzione = alessandro.importo_riduzione + tomas.importo_riduzione,
    importo_trasferito_admin = alessandro.importo_trasferito_admin + tomas.importo_trasferito_admin,
    quota_finale = alessandro.quota_finale + tomas.quota_finale,
    importo_fatturato = alessandro.importo_fatturato + tomas.importo_fatturato,
    quota_calcolata = coalesce(alessandro.quota_calcolata, alessandro.quota_finale)
      + coalesce(tomas.quota_calcolata, tomas.quota_finale),
    quota_effettiva = coalesce(alessandro.quota_effettiva, alessandro.quota_finale)
      + coalesce(tomas.quota_effettiva, tomas.quota_finale),
    quota_override = true,
    saldato = alessandro.saldato and tomas.saldato,
    data_saldo = case
      when alessandro.saldato and tomas.saldato
      then greatest(alessandro.data_saldo, tomas.data_saldo)
      else null
    end,
    note_quota = concat_ws(
      ' | ',
      nullif(alessandro.note_quota, ''),
      nullif(tomas.note_quota, ''),
      'Quota Tomas trasferita ad Alessandro'
    )
from public.vendita_partecipanti tomas
where alessandro.vendita_id = tomas.vendita_id
  and alessandro.profilo_id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
  and tomas.profilo_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid;

delete from public.vendita_partecipanti tomas
where tomas.profilo_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
  and exists (
    select 1
    from public.vendita_partecipanti alessandro
    where alessandro.vendita_id = tomas.vendita_id
      and alessandro.profilo_id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
  );

-- Copre eventuali quote di Tomas senza una riga Alessandro preesistente.
update public.vendita_partecipanti
set profilo_id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    ruolo = 'referente',
    quota_override = true,
    note_quota = concat_ws(
      ' | ',
      nullif(note_quota, ''),
      'Quota Tomas trasferita ad Alessandro'
    )
where profilo_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid;

-- Registra i due contratti mensili legacy che mancavano dalle vendite attive.
insert into public.vendite (
  id, cliente_id, venditore_id, admin_id, creato_da,
  servizio, importo_vendita, stato, data_vendita
) values
  (
    'a966ea86-ec19-4e13-aef9-3cc9ddab0761'::uuid,
    '408eca65-ff8d-4925-bd0e-febd2a950b64'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    'Start mensile', 20, 'attiva', date '2026-09-01'
  ),
  (
    '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e'::uuid,
    '3d3f5b29-29e3-4e47-9c71-091d7c0de002'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
    'Start mensile', 35, 'attiva', date '2026-09-01'
  )
on conflict do nothing;

insert into public.costi_vendita (vendita_id, descrizione, importo)
select id, 'Gestione sito', 30
from public.vendite
where id in (
  'a966ea86-ec19-4e13-aef9-3cc9ddab0761'::uuid,
  '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e'::uuid
)
and not exists (
  select 1 from public.costi_vendita c where c.vendita_id = vendite.id
);

insert into public.vendita_partecipanti (
  vendita_id, profilo_id, ruolo, fa_fattura, quota_base,
  percentuale_tasse, importo_tasse, percentuale_riduzione,
  importo_riduzione, importo_trasferito_admin, quota_finale,
  saldato, modalita_fatturazione, importo_fatturato,
  quota_calcolata, quota_effettiva, quota_override, note_quota
)
select
  v.id,
  'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
  'referente', false,
  greatest(0, v.importo_vendita - 30),
  0, 0, 0, 0, 0,
  greatest(0, v.importo_vendita - 30),
  false, 'nessuna', 0,
  greatest(0, v.importo_vendita - 30),
  greatest(0, v.importo_vendita - 30),
  false, 'Vendita legacy inserita durante la correzione ruoli'
from public.vendite v
where v.id in (
  'a966ea86-ec19-4e13-aef9-3cc9ddab0761'::uuid,
  '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e'::uuid
)
on conflict (vendita_id, profilo_id) do nothing;

-- I developer non sono candidati a ricevere quote future.
create or replace function public.get_partecipanti_economici()
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
  select p.id, p.nome, p.username, p.ruolo, p.ruolo_economico
  from public.profili p
  where p.ruolo = 'venditore'
  order by
    case p.ruolo_economico when 'referente' then 0 else 1 end,
    p.nome nulls last,
    p.username nulls last;
$$;

revoke all on function public.get_partecipanti_economici() from public, anon;
grant execute on function public.get_partecipanti_economici() to authenticated;

-- Verifiche atomiche: un errore annulla tutta la migrazione.
do $$
declare
  v_vendite integer;
  v_valore numeric;
begin
  if not exists (
    select 1 from public.profili
    where id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid
      and ruolo = 'venditore' and ruolo_economico = 'referente'
  ) then raise exception 'Ruolo Alessandro non corretto'; end if;

  if not exists (
    select 1 from public.profili
    where id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
      and ruolo = 'developer' and ruolo_economico is null
  ) then raise exception 'Ruolo Tomas non corretto'; end if;

  if exists (
    select 1 from public.vendita_partecipanti
    where profilo_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
  ) then raise exception 'Esistono ancora quote attribuite a Tomas'; end if;

  select count(*), coalesce(sum(
    case when c.periodicita_contratto = 'mensile'
      then c.importo_abbonamento * 12
      else c.importo_abbonamento
    end
  ), 0)
  into v_vendite, v_valore
  from public.vendite v
  join public.clienti c on c.id = v.cliente_id
  where v.stato = 'attiva'
    and v.venditore_id = 'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid;

  if v_vendite <> 5 or v_valore <> 1560 then
    raise exception 'Totali Alessandro inattesi: % vendite, % euro', v_vendite, v_valore;
  end if;
end;
$$;
