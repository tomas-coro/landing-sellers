-- Percorso cliente: Contattato -> Acquisito -> Mandato brief -> Convertito -> Completato.
-- "Mancato" resta un esito separato. Lo stato Completato coincide con
-- produzione Pubblicato, cosi' le metriche esistenti continuano a funzionare.

begin;

alter table public.clienti
  drop constraint if exists clienti_stato_check;

alter table public.clienti disable trigger trg_registra_attivita_cliente;

update public.clienti
set stato = 'completato'
where stato = 'vinto'
  and stato_produzione = 'pubblicato';

alter table public.clienti enable trigger trg_registra_attivita_cliente;

alter table public.clienti
  add constraint clienti_stato_check
  check (stato in (
    'contattato', 'acquisito', 'brief_mandato',
    'vinto', 'completato', 'perso'
  ));

create or replace function public.imposta_stato_cliente(p_cliente_id uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  if p_stato is null or p_stato not in (
    'contattato', 'acquisito', 'brief_mandato',
    'vinto', 'completato', 'perso'
  ) then
    raise exception 'Stato non valido';
  end if;
  if not exists (
    select 1 from public.clienti c
    where c.id = p_cliente_id and (
      c.venditore_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.profili p where p.id = auth.uid() and p.ruolo_economico in ('referente', 'produzione'))
      or exists (select 1 from public.vendite v where v.cliente_id = c.id and v.venditore_id = auth.uid())
    )
  ) then raise exception 'Cliente non accessibile'; end if;

  update public.clienti
  set stato = p_stato,
      stato_produzione = case
        when p_stato = 'completato' then 'pubblicato'
        when p_stato = 'vinto' then
          case when stato_produzione in ('da_avviare', 'in_lavorazione')
            then stato_produzione else 'da_avviare' end
        else null
      end
  where id = p_cliente_id;
end;
$$;

create or replace function public.imposta_stato_produzione(p_cliente_id uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Utente non autenticato'; end if;
  if p_stato is null or p_stato not in ('da_avviare', 'in_lavorazione', 'pubblicato') then
    raise exception 'Stato produzione non valido';
  end if;
  if not exists (
    select 1 from public.clienti c
    where c.id = p_cliente_id and c.stato in ('vinto', 'completato') and (
      c.venditore_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.profili p where p.id = auth.uid() and p.ruolo_economico in ('referente', 'produzione'))
      or exists (select 1 from public.vendite v where v.cliente_id = c.id and v.venditore_id = auth.uid())
    )
  ) then raise exception 'Cliente non accessibile o non convertito'; end if;

  update public.clienti
  set stato_produzione = p_stato,
      stato = case
        when p_stato = 'pubblicato' then 'completato'
        else 'vinto'
      end
  where id = p_cliente_id;
end;
$$;

commit;
