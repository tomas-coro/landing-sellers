const { test } = require('node:test');
const assert = require('node:assert');
const { FAQ_ASSISTENTE, trovaRisposta, AssistenteLanding } = require('../js/assistente.js');
const { appState } = require('../js/app.js');

test('trova risposte anche con parole diverse', () => {
  assert.match(trovaRisposta('Dove posso creare un nuovo cliente?').risposta, /Nuovo cliente/);
  assert.match(trovaRisposta('Vorrei recuperare un cliente cancellato').risposta, /Cestino/);
  assert.match(trovaRisposta('Come applico uno sconto percentuale?').risposta, /percentuale/);
  assert.match(trovaRisposta('Dove vedo il residuo da incassare?').risposta, /Residuo/);
  assert.match(trovaRisposta('Come posso fare il logout?').risposta, /Esci/);
});

test('copre tutte le aree reali dell’app', () => {
  assert.strictEqual(FAQ_ASSISTENTE.length, 62);
  assert.deepStrictEqual([...new Set(FAQ_ASSISTENTE.map(voce => voce.categoria))], [
    'Orientamento', 'Clienti', 'Offerte e rinnovi', 'Agenda e pipeline',
    'Vendite e pagamenti', 'Profilo e app', 'Area admin'
  ]);
  for (const voce of FAQ_ASSISTENTE) assert.strictEqual(trovaRisposta(voce.domanda), voce);
  assert.deepStrictEqual(appState().categorieAssistente().map(gruppo => gruppo.voci.length), [6, 15, 12, 6, 11, 7, 5]);
});

test('invia la domanda, svuota il campo e porta la risposta in vista', () => {
  const stato = appState();
  const container = { scrollTop: 0, scrollHeight: 1200 };
  const documentoPrecedente = globalThis.document;
  globalThis.document = { getElementById: id => {
    assert.strictEqual(id, 'app');
    return container;
  } };
  stato.$nextTick = callback => callback();
  try {
    stato.assistenteDomanda = '   ';
    stato.inviaDomandaAssistente();
    assert.strictEqual(stato.assistenteMessaggi.length, 1);
    assert.strictEqual(container.scrollTop, 0);
    stato.assistenteDomanda = ' Come cambio la password? ';
    stato.inviaDomandaAssistente();
    assert.strictEqual(stato.assistenteMessaggi[1].testo, 'Come cambio la password?');
    assert.match(stato.assistenteMessaggi[2].testo, /Tomas/);
    assert.strictEqual(stato.assistenteDomanda, '');
    assert.strictEqual(container.scrollTop, container.scrollHeight);
  } finally {
    if (documentoPrecedente === undefined) delete globalThis.document;
    else globalThis.document = documentoPrecedente;
  }
});

test('non inventa risposte quando il dubbio non è coperto', () => {
  for (const domanda of [
    'Qual è il meteo di domani?',
    'Come cucino la pasta?',
    'Come cambio la password?',
    'Come posso esportare i clienti in Excel?'
  ]) {
    assert.strictEqual(trovaRisposta(domanda), null, domanda);
    assert.match(AssistenteLanding.rispondi(domanda), /Tomas/);
  }
});
