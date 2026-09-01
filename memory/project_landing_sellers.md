---
name: project-landing-sellers
description: Stato del progetto landing-sellers (PWA venditori Landing Evolution) - repo, stack, feature consegnate
metadata:
  type: project
---

PWA vanilla JS + Alpine.js (CDN, zero build) per i venditori di Landing Evolution, backend Supabase (Postgres + Auth + RLS), pubblicata su GitHub Pages. Repo GitHub reale: `https://github.com/tomas-coro/landing-sellers` (account `tomas-coro`, non `xBacco` come nominato nel piano originale - deviazione approvata da Tomas durante il Task 11 dell'MVP). Working copy locale su iCloud: `.../PROGETTI AI/LANDING EVOLUTION/landing-sellers/`.

MVP originale (login, lista clienti, scheda cliente, note, stato pipeline, PWA installabile) completato e deployato ad agosto 2026. Da allora aggiunte oltre il piano iniziale: modifica/eliminazione cliente (soft-delete con colonna `cancellato_il`), statistiche vendite, dashboard admin multi-venditore, promemoria urgenza prossimo contatto, ricerca/filtro lista, pulizia automatica del cestino via job `pg_cron` dopo 30 giorni (`supabase/migration_2026_08_31_cestino.sql`), e (2026-09-01) vista Cestino self-service con ripristino cliente (commit `0b692ba`, pushato).

**Come si testa in locale:** `python3 -m http.server 8000` nella cartella progetto, poi `localhost:8000`. Login richiede credenziali Supabase reali (account venditore di Tomas), non simulabili senza password.

**Come si applica**: prima di proporre nuove feature su questo progetto, verificare lo stato reale con `git log` - il progetto si muove più veloce di quanto i piani/spec datati suggeriscano. Vedi anche [[gotcha-worktree-service-worker]] per le insidie specifiche di QA su questa PWA.
