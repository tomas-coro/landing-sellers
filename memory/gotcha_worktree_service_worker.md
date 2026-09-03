---
name: gotcha-worktree-service-worker
description: Due insidie tecniche specifiche di questo progetto - worktree che parte da origin invece che da main locale, e service worker che serve asset vecchi durante il QA
metadata:
  type: feedback
---

**Worktree via `EnterWorktree`/`git worktree` parte da `origin/<default-branch>` (baseRef "fresh"), non dal `main` locale.** Se `main` locale ha commit non ancora pushati (es. spec/piano scritti durante il brainstorming), il worktree appena creato non li contiene e gli script del piano (`sdd-workspace`, `task-brief`) falliscono con "no such plan file" anche se il file esiste su `main` locale.

**Come si applica:** dopo aver creato un worktree per eseguire un piano appena scritto, controllare `git log --oneline -3` nel worktree contro `git branch -vv` sul repo principale. Se il worktree è indietro rispetto al `main` locale, fare `git rebase main` dentro il worktree prima di procedere - non serve pushare `main` solo per sbloccare il worktree.

---

**Il service worker di questa PWA (`service-worker.js`) è cache-first sull'app shell** (index.html, js/*.js) per design (installabilità offline). Durante il QA manuale in browser di una modifica appena fatta, se il browser ha già una registrazione service worker attiva sulla stessa origin/porta da una sessione precedente, serve gli asset VECCHI dalla cache anche dopo un reload pieno o un fetch con `cache: 'no-store'` - il fetch stesso viene intercettato dal service worker che risponde dalla Cache Storage, non dalla rete.

**Come si applica:** prima di fare QA visivo su una modifica a `index.html`/`js/*.js` in locale, o usare una porta http.server diversa mai usata prima su questa macchina per quell'origin, oppure eseguire in console: `(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister())` + `(await caches.keys()).forEach(k => caches.delete(k))` prima di navigare. Vedi anche [[project-landing-sellers]].
