-- Ogni profilo ha un codice referente stabile da mostrare al venditore.
-- Deriva dall'UUID del profilo: non cambia se cambia username o nome.

alter table public.profili
  add column if not exists codice_referente text
  generated always as (
    'LE-' || upper(substr(replace(id::text, '-', ''), 1, 8))
  ) stored;

create unique index if not exists profili_codice_referente_unique
  on public.profili (codice_referente);
