const { test } = require('node:test');
const assert = require('node:assert');
const { calcolaStatisticheVenditore } = require('../js/app.js');
const mixin = require('../js/app-rete.js');
const {
  escapaHtml, indicizzaAlbero, sottoalbero, percorsoNodo,
  calcolaStatisticheRete, riepilogoRete, markupAlberoRete, vendutoReteVenditore,
  aggregaQuoteRete
} = mixin.__puri;

// Albero come nel database: Alessandro > Nicola, Nicholas > Selim.
const NODI = [
  { id: 'ale', nome: 'Alessandro', responsabile_id: null, livello: 1 },
  { id: 'nho', nome: 'Nicholas', responsabile_id: 'ale', livello: 2 },
  { id: 'nic', nome: 'Nicola', responsabile_id: 'ale', livello: 2 },
  { id: 'sel', nome: 'Selim', responsabile_id: 'nho', livello: 3 }
];

// Una vendita per venditore (importo 1000 ciascuna), generato diverso.
const VENDITE = [
  { id: 'v-ale', cliente_id: 'c1', importo_vendita: 1000, stato: 'attiva', venditore_id: 'ale' },
  { id: 'v-nic', cliente_id: 'c2', importo_vendita: 1000, stato: 'attiva', venditore_id: 'nic' },
  { id: 'v-nho', cliente_id: 'c3', importo_vendita: 1000, stato: 'attiva', venditore_id: 'nho' },
  { id: 'v-sel', cliente_id: 'c4', importo_vendita: 1000, stato: 'attiva', venditore_id: 'sel' }
];
const PARTECIPAZIONI = [
  { vendita_id: 'v-ale', profilo_id: 'ale', quota_finale: 300 },
  { vendita_id: 'v-nic', profilo_id: 'nic', quota_finale: 200 },
  { vendita_id: 'v-nic', profilo_id: 'ale', quota_finale: 50 },   // Alessandro e dentro le vendite degli altri
  { vendita_id: 'v-nho', profilo_id: 'nho', quota_finale: 200 },
  { vendita_id: 'v-nho', profilo_id: 'ale', quota_finale: 50 },
  { vendita_id: 'v-sel', profilo_id: 'sel', quota_finale: 150 },
  { vendita_id: 'v-sel', profilo_id: 'nho', quota_finale: 30 }
];
const INCASSI = [
  { profilo_id: 'nic', vendita_id: 'v-nic', quota_effettiva: 80 },
  { profilo_id: 'ale', vendita_id: 'v-nic', quota_effettiva: 20 }
];

function statistiche() {
  return calcolaStatisticheRete({
    albero: indicizzaAlbero(NODI),
    vendite: VENDITE,
    partecipazioni: PARTECIPAZIONI,
    incassi: INCASSI,
    clientiPerId: {},
    calcola: calcolaStatisticheVenditore
  });
}

test('indicizzaAlbero mette il padre prima dei figli e Nicola prima di Nicholas', () => {
  const albero = indicizzaAlbero(NODI);
  assert.deepStrictEqual(albero.radici, ['ale']);
  assert.deepStrictEqual(albero.ordine, ['ale', 'nic', 'nho', 'sel']);
});

test('un nodo il cui padre non e visibile diventa radice (vista di Nicholas)', () => {
  const albero = indicizzaAlbero([
    { id: 'nho', nome: 'Nicholas', responsabile_id: null, livello: 2 },
    { id: 'sel', nome: 'Selim', responsabile_id: 'nho', livello: 3 }
  ]);
  assert.deepStrictEqual(albero.radici, ['nho']);
  assert.strictEqual(albero.perId.nho.livello, 2);
});

test('sottoalbero e percorso', () => {
  const albero = indicizzaAlbero(NODI);
  assert.deepStrictEqual(sottoalbero(albero, 'nho'), ['nho', 'sel']);
  assert.deepStrictEqual(sottoalbero(albero, 'ale'), ['ale', 'nic', 'nho', 'sel']);
  assert.deepStrictEqual(percorsoNodo(albero, 'sel'), ['ale', 'nho', 'sel']);
});

test('venduto e solo del venditore diretto, generato e la sua quota su tutte le vendite', () => {
  const s = statistiche();
  assert.strictEqual(s.ale.venduto, 1000);
  assert.strictEqual(s.ale.generato, 400);   // 300 + 50 + 50
  assert.strictEqual(s.nho.venduto, 1000);
  assert.strictEqual(s.nho.generato, 230);   // 200 + 30
  assert.strictEqual(s.nic.incassato, 80);
  assert.strictEqual(s.ale.incassato, 20);
  assert.strictEqual(s.sel.incassato, 0);
});

test('Alessandro vede la rete intera: venduto 4000, di cui suo diretto 1000', () => {
  const albero = indicizzaAlbero(NODI);
  const v = riepilogoRete({ albero, statistiche: statistiche(), selezionati: albero.ordine, focusId: null });
  assert.strictEqual(v.venduto, 4000);
  assert.strictEqual(v.diretto, 1000);
  assert.strictEqual(v.team, 3000);
  assert.strictEqual(v.generato, 400 + 230 + 200 + 150);
  assert.strictEqual(v.incassato, 100);
  assert.strictEqual(v.mediaVendita, 1000);
});

test('entrare in Nicholas mostra lui e Selim, con il diretto di Nicholas', () => {
  const albero = indicizzaAlbero(NODI);
  const v = riepilogoRete({ albero, statistiche: statistiche(), selezionati: albero.ordine, focusId: 'nho' });
  assert.deepStrictEqual(v.visibili, ['nho', 'sel']);
  assert.strictEqual(v.venduto, 2000);
  assert.strictEqual(v.diretto, 1000);
});

test('i due filtri lavorano insieme: spunte e ramo si intersecano', () => {
  const albero = indicizzaAlbero(NODI);
  const v = riepilogoRete({ albero, statistiche: statistiche(), selezionati: ['nho', 'nic'], focusId: 'nho' });
  assert.deepStrictEqual(v.visibili, ['nho']);
  assert.strictEqual(v.venduto, 1000);
});

test('un venditore senza sottoposti vede solo se stesso', () => {
  const albero = indicizzaAlbero([{ id: 'nic', nome: 'Nicola', responsabile_id: null, livello: 2 }]);
  const v = riepilogoRete({ albero, statistiche: statistiche(), selezionati: ['nic'], focusId: null });
  assert.deepStrictEqual(v.visibili, ['nic']);
  assert.strictEqual(v.diretto, 1000);
  assert.strictEqual(v.team, 0);
});

test('il markup annida i figli e il nome e escapato', () => {
  const nodi = [
    { id: 'a', nome: '<img src=x onerror=1>', responsabile_id: null, livello: 1 },
    { id: 'b', nome: 'Figlio', responsabile_id: 'a', livello: 2 }
  ];
  const albero = indicizzaAlbero(nodi);
  const html = markupAlberoRete({
    albero, statistiche: {}, visibili: ['a', 'b'], centro: 'a', viewerId: 'a'
  });
  assert.ok(!html.includes('<img'), 'il nome non deve diventare HTML');
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('rete-kids'));
  assert.ok(html.includes('data-id="b"'));
  assert.strictEqual(escapaHtml('a&b"'), 'a&amp;b&quot;');
});

test('ogni venditore diverso dal centro e cliccabile, anche senza team', () => {
  const albero = indicizzaAlbero(NODI);
  const html = markupAlberoRete({
    albero, statistiche: statistiche(), visibili: albero.ordine, centro: 'ale', viewerId: 'ale'
  });
  // Alessandro e il centro: div. Nicholas (con team), Nicola e Selim (senza team): bottoni.
  assert.ok(/<button type="button" class="rete-node" data-id="nho">/.test(html));
  assert.ok(/<button[^>]*data-id="nic"/.test(html));
  assert.ok(/<button[^>]*data-id="sel"/.test(html));
  assert.ok(!/<button[^>]*data-id="ale"/.test(html));
});

test('le funzioni pure non finiscono nello stato Alpine', () => {
  assert.ok(!Object.keys(mixin).includes('__puri'));
  assert.ok(typeof mixin.apriRete === 'function');
});

test('home: il venduto di rete somma se stesso e chi sta sotto, con il diretto a parte', () => {
  const albero = indicizzaAlbero(NODI);
  const nho = vendutoReteVenditore({ albero, viewerId: 'nho', vendite: VENDITE, clientiPerId: {}, calcola: calcolaStatisticheVenditore });
  // Nicholas (1000) + Selim (1000); Nicola e Alessandro restano fuori.
  assert.deepStrictEqual(nho, { rete: 2000, diretto: 1000, numeroVendite: 2, mediaVendita: 1000, haTeam: true });
  const ale = vendutoReteVenditore({ albero, viewerId: 'ale', vendite: VENDITE, clientiPerId: {}, calcola: calcolaStatisticheVenditore });
  assert.strictEqual(ale.rete, 4000);
  assert.strictEqual(ale.diretto, 1000);
});

test('home: senza team o fuori dall\'albero non c\'e venduto di rete', () => {
  const albero = indicizzaAlbero(NODI);
  const sel = vendutoReteVenditore({ albero, viewerId: 'sel', vendite: VENDITE, clientiPerId: {}, calcola: calcolaStatisticheVenditore });
  assert.strictEqual(sel.haTeam, false);
  assert.strictEqual(sel.rete, 1000);
  const tomas = vendutoReteVenditore({ albero, viewerId: 'tom', vendite: VENDITE, clientiPerId: {}, calcola: calcolaStatisticheVenditore });
  assert.strictEqual(tomas, null);
});

// ----- Quota di rete 10%: cosa ha preso ogni gestore -----

const QUOTE_RETE = [
  { a_profilo_id: 'nho', da_profilo_id: 'sel', importo: 15 },
  { a_profilo_id: 'nho', da_profilo_id: 'sel', importo: 5.5 },
  { a_profilo_id: 'ale', da_profilo_id: 'nho', importo: 4 }
];

test('quote rete: somma per gestore e ricorda da chi arrivano', () => {
  const albero = indicizzaAlbero(NODI);
  const q = aggregaQuoteRete(QUOTE_RETE, albero);
  assert.strictEqual(q.nho.totale, 20.5);
  assert.deepStrictEqual(q.nho.daNomi, ['Selim']);
  assert.strictEqual(q.ale.totale, 4);
  assert.strictEqual(q.sel, undefined);
});

test('quote rete: righe vuote o con importo non valido non contano', () => {
  const albero = indicizzaAlbero(NODI);
  assert.deepStrictEqual(aggregaQuoteRete([], albero), {});
  assert.deepStrictEqual(aggregaQuoteRete([{ a_profilo_id: 'nho', da_profilo_id: 'sel', importo: 'x' }], albero), {});
});

test('il nodo mostra "da rete" solo se ha ricevuto una quota, e il nome e escapato', () => {
  const albero = indicizzaAlbero(NODI);
  const html = markupAlberoRete({
    albero, statistiche: statistiche(), visibili: albero.ordine, centro: 'ale', viewerId: 'ale',
    quoteRete: aggregaQuoteRete(QUOTE_RETE, albero)
  });
  assert.ok(html.includes('quota di rete'));
  assert.ok(html.includes('da Selim'));
  assert.strictEqual((html.match(/rete-quota/g) || []).length, 2); // Nicholas e Alessandro
  const senza = markupAlberoRete({
    albero, statistiche: statistiche(), visibili: albero.ordine, centro: 'ale', viewerId: 'ale'
  });
  assert.ok(!senza.includes('rete-quota'));
});
