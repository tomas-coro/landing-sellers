const { test } = require('node:test');
const assert = require('node:assert');
const rete = require('../js/app-rete.js');
const clienti = require('../js/app-clienti.js');
const { indicizzaAlbero } = rete.__puri;
const { tappaCliente, rigaCliente, ordinaRighe, raggruppaPerTappa, perimetroClienti, markupGruppi } = clienti.__puri;

// Albero come nel database: Alessandro > Nicola, Nicholas > Selim.
const albero = indicizzaAlbero([
  { id: 'ale', nome: 'Alessandro', responsabile_id: null, livello: 1 },
  { id: 'nho', nome: 'Nicholas', responsabile_id: 'ale', livello: 2 },
  { id: 'nic', nome: 'Nicola', responsabile_id: 'ale', livello: 2 },
  { id: 'sel', nome: 'Selim', responsabile_id: 'nho', livello: 3 }
]);

test('le tappe cliente seguono il percorso commerciale completo', () => {
  assert.strictEqual(tappaCliente({ stato: 'contattato' }), 1);
  assert.strictEqual(tappaCliente({}), 1);
  assert.strictEqual(tappaCliente({ stato: 'acquisito' }), 2);
  assert.strictEqual(tappaCliente({ stato: 'brief_mandato' }), 3);
  assert.strictEqual(tappaCliente({ stato: 'vinto', stato_produzione: 'in_lavorazione' }), 4);
  assert.strictEqual(tappaCliente({ stato: 'vinto', stato_produzione: 'da_avviare' }), 4);
  assert.strictEqual(tappaCliente({ stato: 'completato', stato_produzione: 'pubblicato' }), 5);
  assert.strictEqual(tappaCliente({ stato: 'vinto', stato_produzione: 'pubblicato' }), 5);
  assert.strictEqual(tappaCliente({ stato: 'perso' }), 6);
});

test('Alessandro: parte dai diretti, "Tutta la rete" prende il suo ramo', () => {
  const own = perimetroClienti({ albero, viewerId: 'ale', modo: 'own' });
  assert.deepStrictEqual(own.ids, ['ale']);
  assert.ok(own.haSegmento);
  assert.ok(!own.haCampo);

  const rete4 = perimetroClienti({ albero, viewerId: 'ale', modo: 'rete' });
  assert.deepStrictEqual([...rete4.ids].sort(), ['ale', 'nho', 'nic', 'sel']);
  assert.ok(rete4.haCampo);

  const scelti = perimetroClienti({ albero, viewerId: 'ale', modo: 'rete', scelti: ['nic', 'sel'] });
  assert.deepStrictEqual(scelti.ids, ['nic', 'sel']);
  assert.ok(scelti.filtrato);
});

test('Nicholas vede i suoi e Selim, mai Nicola', () => {
  const r = perimetroClienti({ albero, viewerId: 'nho', modo: 'rete' });
  assert.deepStrictEqual([...r.ids].sort(), ['nho', 'sel']);
  // una scelta fuori dal suo ramo viene ignorata
  const fuori = perimetroClienti({ albero, viewerId: 'nho', modo: 'rete', scelti: ['nic'] });
  assert.deepStrictEqual([...fuori.ids].sort(), ['nho', 'sel']);
});

test('Nicola e Selim (foglie): niente segmento ne campo, solo i propri', () => {
  const r = perimetroClienti({ albero, viewerId: 'nic', modo: 'rete' });
  assert.ok(!r.haSegmento);
  assert.ok(!r.haCampo);
  assert.deepStrictEqual(r.ids, ['nic']);
  assert.deepStrictEqual(perimetroClienti({ albero, viewerId: 'sel', modo: 'rete' }).ids, ['sel']);
});

test('Tomas (non e un nodo): vede tutto, anche i clienti non assegnati, e puo filtrare', () => {
  const tutto = perimetroClienti({ albero, viewerId: 'tomas', modo: 'own' });
  assert.strictEqual(tutto.ids, null);
  assert.ok(tutto.haCampo);
  assert.ok(!tutto.haSegmento);
  const filtrato = perimetroClienti({ albero, viewerId: 'tomas', scelti: ['nic'] });
  assert.deepStrictEqual(filtrato.ids, ['nic']);
});

const scheda = (extra = {}) => ({
  nome: 'Adioro', totalePagamento: 2400, valoreAnnuale: 1200, percentualeIncassata: 49.6,
  prossimaScadenza: { tipo: 'contatto', data: '2026-10-13', label: 'Contatto' },
  prossimaScadenzaLabel: 'Contatto', prossimaScadenzaInRitardo: true, ...extra
});

test('la riga usa la prossima_azione scritta, altrimenti la scadenza', () => {
  const scritta = rigaCliente({ id: 'c1', stato: 'contattato', prossima_azione: ' Inviare il brief ', venditore_id: 'nic' }, scheda());
  assert.strictEqual(scritta.azione, 'Inviare il brief');
  assert.strictEqual(scritta.dataEtichetta, 'dal 13/10');
  assert.ok(scritta.ritardo);
  assert.strictEqual(scritta.valore, 2400);
  assert.strictEqual(scritta.pagato, 50);

  const dalla = rigaCliente({ id: 'c2', stato: 'vinto' }, scheda({ prossimaScadenzaLabel: 'Rata 300 €', prossimaScadenzaInRitardo: false }));
  assert.strictEqual(dalla.azione, 'Rata 300 €');
  assert.strictEqual(dalla.dataEtichetta, '13/10');
  assert.ok(!dalla.ritardo);

  const nessuna = rigaCliente({ id: 'c3', stato: 'vinto' }, scheda({ prossimaScadenza: null, prossimaScadenzaInRitardo: false, totalePagamento: 0 }));
  assert.strictEqual(nessuna.azione, 'Nessuna scadenza');
  assert.strictEqual(nessuna.valore, 1200); // senza totale contratto usa il valore annuo
  assert.strictEqual(nessuna.pagato, 0);
});

test('i clienti mancati non risultano mai scaduti', () => {
  const r = rigaCliente({ id: 'c4', stato: 'perso' }, scheda());
  assert.strictEqual(r.tappa, 6);
  assert.ok(!r.ritardo);
});

test('dentro un gruppo prima i ritardi, poi la data piu vicina, poi chi non ha scadenza', () => {
  const r = (nome, data, ritardo) => ({ nome, data, ritardo, tappa: 1, valore: 100 });
  const ordinate = ordinaRighe([r('C', '', false), r('B', '2026-10-30', false), r('A', '2026-10-20', false), r('Z', '2026-10-14', true)]);
  assert.deepStrictEqual(ordinate.map(x => x.nome), ['Z', 'A', 'B', 'C']);
});

test('i gruppi saltano le tappe vuote e sommano il valore', () => {
  const gruppi = raggruppaPerTappa([
    { nome: 'A', tappa: 1, valore: 100, data: '', ritardo: false },
    { nome: 'B', tappa: 1, valore: 50, data: '', ritardo: false },
    { nome: 'C', tappa: 4, valore: 10, data: '', ritardo: false }
  ]);
  assert.deepStrictEqual(gruppi.map(g => g.n), [1, 4]);
  assert.strictEqual(gruppi[0].totale, 150);
});

test('il markup limita a 3 clienti, offre "Mostra altri" e protegge l html', () => {
  const righe = ['<b>x</b>', 'B', 'C', 'D', 'E'].map((nome, i) => ({
    id: 'id' + i, nome, tappa: 1, valore: 100, pagato: 0, azione: 'Inviare il brief', data: '', dataEtichetta: '', ritardo: i === 0, venditoreId: 'nic'
  }));
  const gruppi = raggruppaPerTappa(righe);
  const base = { gruppi, aperti: { 1: true }, altri: {}, cerca: false, mostraVenditore: false, nomeVenditore: () => 'Nicola' };

  const chiuso = markupGruppi(base);
  assert.strictEqual((chiuso.match(/data-cliente=/g) || []).length, 3);
  assert.match(chiuso, /Mostra altri 2/);
  assert.doesNotMatch(chiuso, /<b>x<\/b>/);
  assert.match(chiuso, /cli-it lt/);

  const espanso = markupGruppi({ ...base, altri: { 1: true } });
  assert.strictEqual((espanso.match(/data-cliente=/g) || []).length, 5);
  assert.doesNotMatch(espanso, /Mostra altri/);

  const nascosto = markupGruppi({ ...base, aperti: { 1: false } });
  assert.doesNotMatch(nascosto, /data-cliente=/);
  assert.match(nascosto, /aria-expanded="false"/);

  assert.match(markupGruppi({ ...base, mostraVenditore: true }), /cli-sel">Nicola/);
});

test('il popup venditori filtra per nome e applica le stesse scorciatoie della rete', () => {
  const stato = Object.assign({}, clienti, {
    clientiNodi: Object.values(albero.perId).map(n => ({ ...n, responsabile_id: n.padre })),
    clientiModo: 'rete',
    clientiScelti: [],
    clientiRicerca: 'sel',
    clientiFoglioTmp: [],
    sessione: { user: { id: 'ale' } }
  });

  assert.deepStrictEqual(stato.clientiElencoFoglio().map(n => n.id), ['sel']);
  stato.clientiScorciatoia('io');
  assert.deepStrictEqual(stato.clientiFoglioTmp, ['ale']);
  stato.clientiScorciatoia('team');
  assert.deepStrictEqual([...stato.clientiFoglioTmp].sort(), ['ale', 'nho', 'nic', 'sel']);
});
