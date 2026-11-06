---
timestamp: 2026-10-08T10-43-57Z
slug: html-app-pwa-venditori-home-pipeline-scheda-admin
---
# Audit UX/estetico - landing-sellers (2026-10-08)

Metodo: dual-agent, browser live fallito (timeout estensione Chrome), audit code-only.

## Punteggio (Nielsen 0-4): 29/40 - Buono
1 Visibilita stato: 3 | 2 Match mondo reale: 4 | 3 Controllo/liberta: 3 | 4 Coerenza: 3 | 5 Prevenzione errori: 2 | 6 Riconoscere/ricordare: 3 | 7 Flessibilita: 2 | 8 Estetica minimale: 3 | 9 Recupero errori: 3 | 10 Aiuto: 3

## Verdetto design-specificity: ALTA
App costruita sul ciclo di vita del contratto B2B (non CRUD generico), azioni rapide tel/WhatsApp/mailto, pipeline a slide mobile-first, motore economico con meccaniche reali di agenzia, palette lime/scuro coerente.

## Cosa funziona
1. Home con gerarchia reale (performance -> funnel -> OGGI -> ultimi clienti)
2. Reversibilita vera su azioni rischiose (cestino 30gg, retry, guardia uscita form)
3. Disciplina cromatica coerente (lime sempre su scuro)

## Problemi prioritari
[P0] Bottone eliminazione cliente (index.html:6734, class btn-primary) identico al Salva - nessuna classe btn-danger nel CSS. Fix: variante .btn-danger solo su questo bottone.
[P1] Dashboard admin senza sezione "serve attenzione ora" cross-venditore (manca equivalente di Home "OGGI" in index.html:1571+).
[P2] Ritardo invisibile nella lista clienti vera (.client-status-next, index.html:724) - nessun class binding overdue, solo in Agenda/Home-oggi.
[P3] Card cliente lista con 8 campi a pari peso (index.html:671-760) - nessuna gerarchia primario/secondario.
[P3] 3 blocchi CSS .home-attention-dot duplicati byte-per-byte in 3 media query (style.css righe 1824/2141/2451).

## Persona red flag
Casey (mobile): select cambio stato pipeline piccolo tra testo non interattivo, nessun undo; P2 lo colpisce di piu.
Alex (power/admin): P1 lo colpisce direttamente, nessuna scorciatoia mobile equivalente a cmdk.
Sam (accessibilita): icone elimina/modifica a 6px di distanza, hit-area ~32px sotto i 44px consigliati.

## Minori
- --danger non dichiarato nel :root principale
- Detector (modalita degradata): overused-font Montserrat (probabile falso positivo), flat-type-hierarchy, 3x layout-transition su width (barre progresso, difendibili)
- Calcolo VALORE ANNUALE non verificato per clienti mensile con primo anno parziale

## Domande
- Admin merita la versione cross-team del pattern OGGI?
- Il bottone di eliminazione deve portare il segnale visivo oltre al testo del modal?
