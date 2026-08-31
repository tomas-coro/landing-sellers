# Vista Cestino clienti - Design

## Contesto

I clienti eliminati sono gia' soft-delete (colonna `clienti.cancellato_il`, migrazione `supabase/migration_2026_08_31.sql`) e vengono rimossi definitivamente dal database dopo 30 giorni da un job `pg_cron` (`supabase/migration_2026_08_31_cestino.sql`). Il popup di eliminazione promette gia' all'utente "puoi chiedere di recuperarlo entro 30 giorni", ma oggi non esiste nessuna UI per farlo: il ripristino richiede un intervento manuale su Supabase. Questo design chiude quel buco con una vista Cestino self-service.

## Obiettivo

Un venditore (o un admin che sta guardando la lista di un venditore specifico) deve poter vedere i propri clienti eliminati e ripristinarli da solo, senza passare da un intervento sul database.

## Chi puo' ripristinare

Il venditore proprietario del cliente. L'admin puo' farlo indirettamente perche' la vista Cestino e' raggiungibile dalla stessa schermata lista che l'admin gia' usa per guardare i clienti di un venditore specifico (`filtroVenditoreId`), quindi eredita lo stesso scoping.

Nessuna modifica alle RLS: la policy `clienti_update` esistente (`venditore_id = auth.uid() or public.is_admin()`, `supabase/policies.sql`) gia' permette di rimettere `cancellato_il` a `null` sia al venditore proprietario sia all'admin.

## Navigazione

Nuova view `cestino`, raggiungibile con un'icona nell'header della lista clienti (accanto a "Controlla aggiornamenti" ed "Esci"). Bottone "Torna alla lista" per uscirne, stesso pattern gia' usato dalla scheda cliente (`view = 'lista'`).

## Componenti

### `js/validators.js` - `giorniResiduiCestino(cancellatoIl)`

Funzione pura, testabile con `node --test`. Riceve la stringa ISO di `cancellato_il` e ritorna i giorni interi mancanti a 30 dalla cancellazione (`30 - giorni trascorsi`, minimo 0). Usata solo per la visualizzazione del countdown, il valore reale di scadenza resta calcolato lato database dal job `pg_cron`.

### `js/app.js` - stato e metodi

```js
cestino: [],
erroreCestino: '',

async caricaCestino() {
  this.erroreCestino = '';
  let query = window.supabaseClient.from('clienti').select('*')
    .not('cancellato_il', 'is', null)
    .order('cancellato_il', { ascending: false });
  if (this.isAdmin && this.filtroVenditoreId) {
    query = query.eq('venditore_id', this.filtroVenditoreId);
  } else if (!this.isAdmin) {
    query = query.eq('venditore_id', this.sessione.user.id);
  }
  const { data, error } = await query;
  if (error) { this.erroreCestino = 'Errore nel caricare il cestino: ' + error.message; return; }
  this.cestino = data;
},

async apriCestino() {
  this.view = 'cestino';
  await this.caricaCestino();
},

async ripristinaCliente(clienteId) {
  const { error } = await window.supabaseClient.from('clienti')
    .update({ cancellato_il: null }).eq('id', clienteId);
  if (error) { this.erroreCestino = 'Ripristino fallito: ' + error.message; return; }
  await this.caricaCestino();
  await this.caricaClienti();
},
```

Nessun popup di conferma per il ripristino: e' un'azione non distruttiva (a differenza dell'eliminazione), coerente con YAGNI.

### `index.html` - markup

- Icona "Cestino" nell'header della view `lista`, accanto alle icone esistenti, `@click="apriCestino()"`.
- Nuova `<div x-show="view === 'cestino'">`:
  - Header con "Torna alla lista" (`@click="view = 'lista'"`)
  - `<p x-show="erroreCestino">` per errori, stesso stile delle altre view
  - Lista card per ogni cliente in `cestino`: nome, testo "Eliminato il {data}, rimosso tra {giorniResiduiCestino(c.cancellato_il)} giorni", bottone "Ripristina" (`@click="ripristinaCliente(c.id)"`)
  - Stato vuoto: `<p x-show="cestino.length === 0 && !erroreCestino">Cestino vuoto.</p>`

## Errori

Stesso pattern gia' in uso in tutto `js/app.js`: nessun fallback silenzioso, ogni chiamata Supabase che fallisce popola una stringa di errore mostrata inline (`erroreCestino`), mai un default che nasconde il problema.

## Test

- `test/validators.test.js`: nuovi casi per `giorniResiduiCestino` (0 giorni trascorsi -> 30 residui, 29 giorni trascorsi -> 1 residuo, oltre 30 giorni trascorsi -> 0, mai negativo).
- Resto della feature (caricamento cestino, ripristino, navigazione) e' verifica manuale nel browser, stesso livello di copertura delle altre view CRUD del progetto (nessuna automazione UI esistente da estendere).

## Fuori scope

- Cancellazione manuale immediata dal cestino (bypass dei 30 giorni): non richiesta, il job pg_cron gia' se ne occupa.
- Filtro/ricerca dentro il cestino: la lista eliminati e' tipicamente corta, non serve.
- Notifiche push quando un cliente sta per scadere dal cestino.
