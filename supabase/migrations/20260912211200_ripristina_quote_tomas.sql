-- Tomas è developer nell'app ma partecipa economicamente alla produzione.
-- Le vendite commerciali restano attribuite al rispettivo venditore.

update public.profili
set ruolo = 'developer', ruolo_economico = 'produzione'
where id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid;

-- Ripristina gli snapshot economici precedenti alla migrazione errata.
delete from public.vendita_partecipanti
where profilo_id in (
  'dc0449f5-506c-45aa-a90c-0cd3409e743d'::uuid,
  '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
);

insert into public.vendita_partecipanti (
  id, vendita_id, profilo_id, ruolo, fa_fattura, quota_base,
  percentuale_tasse, importo_tasse, percentuale_riduzione,
  importo_riduzione, importo_trasferito_admin, quota_finale,
  saldato, data_saldo, modalita_fatturazione, importo_fatturato,
  quota_calcolata, quota_effettiva, quota_override, note_quota
) values
  -- Vendite storiche: Alessandro.
  ('e4f21145-8feb-42d9-a6c3-fe368329641c', '0331e41d-5e80-42ce-a5d3-7b4f1afff98d', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 150, 0, 0, 0, 0, 0, 168, false, null, 'nessuna', 0, 168, 168, false, null),
  ('d9d579da-ad79-41d8-84fd-5d130e66562d', '1954bf3e-e532-4ffc-889c-4532eb95fded', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 147.50, 0, 0, 0, 0, 0, 165.20, false, null, 'nessuna', 0, 165.20, 165.20, false, null),
  ('9f1d055e-2bbb-430a-99a5-e692b6eabb8e', '27e61745-fe1e-4400-94c1-70a6ab4aaad9', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 0, 0, 0, 0, 0, 0, 0, false, null, 'nessuna', 0, 0, 0, false, null),
  ('d0c3c9bb-486c-4fd1-b796-a12d197b5e75', '43eaa7be-6676-4a0f-8ba3-614d42b666d9', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 100, 0, 0, 0, 0, 0, 120, false, null, 'nessuna', 0, 100, 120, true, '40 € dell’anticipo assegnati ad Alessandro.'),
  ('e4594c63-af85-4a8a-9495-868df281255e', 'c6a0d118-dba4-417d-a6fd-ad86fb7e2514', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 100, 0, 0, 0, 0, 0, 120, false, null, 'nessuna', 0, 100, 120, true, '40 € dell’anticipo assegnati ad Alessandro.'),
  ('d5b308df-2eb0-4c16-8ef7-743706befe7f', 'db3736aa-4a55-48f6-a63b-3c46b9ecea7b', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', true, 94.67, 60, 142, 0, 0, 0, 94.67, false, null, 'totale', 750, 94.67, 94.67, false, 'Assorbe 40 € di costi e 426 € di tasse sulla vendita.'),
  ('05f0c0d3-7c6e-4cbf-8f9e-280835f16364', 'f7b7a876-3336-477f-99cd-fa1dbf074de6', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 90, 0, 0, 0, 0, 0, 80, false, null, 'nessuna', 0, 100.80, 80, true, 'Quota residua dopo i 100 € annuali anticipati a Tomas'),
  ('d28d1b4f-71b1-4273-97eb-d7f084ecd8a6', 'b6bfe093-33ef-4d11-8994-b273411cc9d6', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', true, 142, 60, 213, 0, 0, 0, 159.04, false, null, 'totale', 750, 159.04, 159.04, false, null),

  -- Vendite storiche: Tomas.
  ('61901af4-0a92-416b-91d2-84610f55aeb5', '0331e41d-5e80-42ce-a5d3-7b4f1afff98d', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 150, 0, 0, 20, 0, 0, 135, false, null, 'nessuna', 0, 132, 135, true, null),
  ('2ee9c33e-515f-4532-b432-f981d92e631b', '1954bf3e-e532-4ffc-889c-4532eb95fded', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 147.50, 0, 0, 20, 0, 0, 120, false, null, 'nessuna', 0, 129.80, 120, true, 'Quota concordata: 120 €'),
  ('ea78e10a-555d-4c93-82c6-55cb903a9440', '27e61745-fe1e-4400-94c1-70a6ab4aaad9', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 0, 0, 0, 20, 0, 0, 0, false, null, 'nessuna', 0, 0, 0, false, null),
  ('cd43b265-d1e4-4cf7-8a26-86f829af2638', '43eaa7be-6676-4a0f-8ba3-614d42b666d9', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 100, 0, 0, 0, 0, 0, 90, false, null, 'nessuna', 0, 100, 90, true, '30 € dell’anticipo assegnati a Tomas.'),
  ('ba808d99-e216-423a-bc30-394c926552bd', 'c6a0d118-dba4-417d-a6fd-ad86fb7e2514', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 100, 0, 0, 0, 0, 0, 90, false, null, 'nessuna', 0, 100, 90, true, '30 € dell’anticipo assegnati a Tomas.'),
  ('cf1e27c3-bae0-41c9-bf3d-cf511e02ec6c', 'db3736aa-4a55-48f6-a63b-3c46b9ecea7b', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 94.67, 60, 142, 20, 0, 0, 50, false, null, 'nessuna', 0, 94.67, 50, true, 'Quota concordata: 50 €. Nessuna fattura ad Alessandro.'),
  ('09aad15b-448b-464d-80f0-7ee6d23f0057', 'f7b7a876-3336-477f-99cd-fa1dbf074de6', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 90, 0, 0, 0, 0, 0, 100, true, date '2026-09-01', 'nessuna', 0, 79.20, 100, true, '100 € annuali anticipati da Alessandro in unica soluzione; data saldo da inserire'),
  ('e2fb55fe-9c59-4217-9931-016232162e49', 'b6bfe093-33ef-4d11-8994-b273411cc9d6', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 142, 60, 213, 20, 0, 0, 124.96, false, null, 'nessuna', 0, 124.96, 124.96, false, null),

  -- Contratti legacy aggiunti oggi: Alessandro vende, Tomas produce.
  ('a6b1a707-b889-4708-b81c-f87a0e892fc0', 'a966ea86-ec19-4e13-aef9-3cc9ddab0761', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 0, 0, 0, 0, 0, 0, 0, false, null, 'nessuna', 0, 0, 0, false, 'Vendita legacy Giuly Style'),
  ('71983dc7-2c3d-4e5a-8e0a-bec8805ea650', 'a966ea86-ec19-4e13-aef9-3cc9ddab0761', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 0, 0, 0, 20, 0, 0, 0, false, null, 'nessuna', 0, 0, 0, false, 'Vendita legacy Giuly Style'),
  ('a0367c5a-3ad6-4ac0-a520-ad4330e44b3c', '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e', 'dc0449f5-506c-45aa-a90c-0cd3409e743d', 'referente', false, 2.50, 0, 0, 0, 0, 0, 2.80, false, null, 'nessuna', 0, 2.80, 2.80, false, 'Vendita legacy Mr Smoky'),
  ('c3c18198-fe0c-4992-a58c-7e02d11332d6', '5ca0feb3-ec7b-4e6f-8eb7-88ca0d14cd7e', '6abedc44-a330-42a2-bc90-b90fae133b37', 'produzione', false, 2.50, 0, 0, 20, 0, 0, 2.20, false, null, 'nessuna', 0, 2.20, 2.20, false, 'Vendita legacy Mr Smoky');

-- Ripristina Tomas come partecipante fisso nelle vendite future.
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
  where p.ruolo <> 'admin' or p.id = auth.uid()
  order by
    case p.ruolo_economico
      when 'referente' then 0
      when 'produzione' then 1
      else 2
    end,
    p.nome nulls last,
    p.username nulls last;
$$;

revoke all on function public.get_partecipanti_economici() from public, anon;
grant execute on function public.get_partecipanti_economici() to authenticated;

-- Verifica: Tomas partecipa a ogni vendita attiva, ma non ne è il venditore.
do $$
begin
  if exists (
    select 1
    from public.vendite v
    where v.stato = 'attiva'
      and not exists (
        select 1 from public.vendita_partecipanti vp
        where vp.vendita_id = v.id
          and vp.profilo_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
      )
  ) then raise exception 'Tomas manca da una vendita attiva'; end if;

  if exists (
    select 1 from public.vendite
    where stato = 'attiva'
      and venditore_id = '6abedc44-a330-42a2-bc90-b90fae133b37'::uuid
  ) then raise exception 'Una vendita commerciale risulta attribuita a Tomas'; end if;
end;
$$;
