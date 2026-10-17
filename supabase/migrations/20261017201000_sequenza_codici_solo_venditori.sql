-- I profili tecnici nascosti non consumano il progressivo dei venditori.
-- Dopo Nicola001, Nicholas002 e Selim003 il prossimo codice sara' Nome004.

select setval(
  'public.codice_referente_seq',
  greatest(
    3,
    coalesce(
      (select max(substring(codice_referente from '([0-9]+)$')::bigint)
       from public.profili
       where ruolo = 'venditore'
         and codice_referente not in ('LandingTop000', 'LandingDev000')),
      3
    )
  ),
  true
);
