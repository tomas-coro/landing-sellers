const { test } = require('node:test');
const assert = require('node:assert');
const { calcolaStatisticheVenditore } = require('../js/app.js');
const mixin = require('../js/app-rete.js');
const {
  escapaHtml, indicizzaAlbero, sottoalbero, percorsoNodo,
  calcolaStatisticheRete, riepilogoRete, markupAlberoRete
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

test('indicizzaAlbero trova la radice e mette il padre prima dei figli in ordine alfabetico', () => {
  const albero = indicizzaAlbero(NODI);
  assert.deepStrictEqual(albero.radici, ['ale']);
  assert.deepStrictEqual(albero.ordine, ['ale', 'nho', 'sel', 'nic']);
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
  assert.deepStrictEqual(sottoalbero(albero, 'ale'), ['ale', 'nho', 'sel', 'nic']);
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

test('solo i nodi con un team sotto e diversi dal centro sono cliccabili', () => {
  const albero = indicizzaAlbero(NODI);
  const html = markupAlberoRete({
    albero, statistiche: statistiche(), visibili: albero.ordine, centro: 'ale', viewerId: 'ale'
  });
  // Nicholas ha Selim sotto: bottone. Alessandro e il centro, Nicola e Selim non hanno team: div.
  assert.ok(/<button type="button" class="rete-node" data-id="nho">/.test(html));
  assert.ok(!/<button[^>]*data-id="ale"/.test(html));
  assert.ok(!/<button[^>]*data-id="nic"/.test(html));
  assert.ok(!/<button[^>]*data-id="sel"/.test(html));
});

test('le funzioni pure non finiscono nello stato Alpine', () => {
  assert.ok(!Object.keys(mixin).includes('__puri'));
  assert.ok(typeof mixin.apriRete === 'function');
});
