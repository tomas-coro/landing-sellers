-- Prezzo finale concordato e permanente.

update public.clienti
set sconto_tipo = null
where trim(coalesce(sconto_tipo, '')) = '';

alter table public.clienti
  drop constraint if exists clienti_sconto_tipo_check,
  add constraint clienti_sconto_tipo_check
    check (
      sconto_tipo is null
      or sconto_tipo in ('percentuale', 'fisso', 'prezzo_fisso')
    );
