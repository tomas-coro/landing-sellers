const { test } = require('node:test');
const assert = require('node:assert');
const {
  normalizzaClientePerSalvataggio,
  prezzoRicorrenteDaForm,
  etichettaDurataScontoForm,
  totaleContrattoDaForm,
  costiGestioneCliente,
  percentualeTasseEconomia,
  appState,
  calcolaStatisticheVenditore,
  posizioneAvatarDaUrl,
  avatarUrlConPosizione
} = require('../js/app.js');

test('il salvataggio converte lo sconto vuoto in null', () => {
  const form = { nome: 'ZDE', sconto_tipo: '' };
  assert.deepStrictEqual(normalizzaClientePerSalvataggio(form), {
    nome: 'ZDE',
    sconto_tipo: null
  });
  assert.strictEqual(form.sconto_tipo, '');
});

test('il prezzo finale manuale sostituisce il prezzo di catalogo', () => {
  assert.strictEqual(prezzoRicorrenteDaForm(576, {
    sconto_tipo: 'prezzo_fisso',
    sconto_valore: 300
  }), 300);
});

test('gli sconti percentuale e fisso continuano a ridurre il catalogo', () => {
  assert.strictEqual(prezzoRicorrenteDaForm(100, {
    sconto_tipo: 'percentuale',
    sconto_valore: 10
  }), 90);
  assert.strictEqual(prezzoRicorrenteDaForm(100, {
    sconto_tipo: 'fisso',
    sconto_valore: 15
  }), 85);
});

test('la durata nulla indica un prezzo o sconto permanente', () => {
  assert.strictEqual(etichettaDurataScontoForm({ sconto_durata_anni: null }), 'Per sempre');
  assert.strictEqual(etichettaDurataScontoForm({ sconto_durata_anni: 2 }), 'Per i primi 2 anni');
});

test('il prezzo finale concordato include setup, dominio e altri extra', () => {
  assert.strictEqual(totaleContrattoDaForm(300, 180, {
    sconto_tipo: 'prezzo_fisso'
  }), 300);
  assert.strictEqual(totaleContrattoDaForm(300, 180, {
    sconto_tipo: 'percentuale'
  }), 480);
});

test('i costi del primo anno sono 30 euro più 10 per il dominio .it acquistato', () => {
  assert.strictEqual(typeof costiGestioneCliente, 'function');
  assert.deepStrictEqual(costiGestioneCliente({
    cliente_ha_dominio: false,
    dominio_it: true,
    dominio_com: false
  }), [
    { descrizione: 'Gestione sito', importo: 30 },
    { descrizione: 'Dominio .it - primo anno', importo: 10 }
  ]);
  assert.deepStrictEqual(costiGestioneCliente({ cliente_ha_dominio: true }), [
    { descrizione: 'Gestione sito', importo: 30 }
  ]);
});

test('il dominio .it costa 15 euro dai rinnovi successivi', () => {
  assert.deepStrictEqual(costiGestioneCliente({
    cliente_ha_dominio: false,
    dominio_it: true
  }, true), [
    { descrizione: 'Gestione sito', importo: 30 },
    { descrizione: 'Dominio .it - rinnovo', importo: 15 }
  ]);
});

test('il dominio .com costa 15 euro il primo anno e 20 dai rinnovi, l’email 5 il primo anno e 10 dai rinnovi', () => {
  assert.deepStrictEqual(costiGestioneCliente({
    cliente_ha_dominio: false,
    dominio_com: true,
    email_5_caselle: true
  }), [
    { descrizione: 'Gestione sito', importo: 30 },
    { descrizione: 'Dominio .com - primo anno', importo: 15 },
    { descrizione: 'Email 5 caselle - primo anno', importo: 5 }
  ]);
  assert.deepStrictEqual(costiGestioneCliente({
    cliente_ha_dominio: false,
    dominio_com: true,
    email_5_caselle: true
  }, true), [
    { descrizione: 'Gestione sito', importo: 30 },
    { descrizione: 'Dominio .com - rinnovo', importo: 20 },
    { descrizione: 'Email 5 caselle - rinnovo', importo: 10 }
  ]);
});

test('le tasse sono 60% se nessun collaboratore fattura, altrimenti 40%', () => {
  assert.strictEqual(typeof percentualeTasseEconomia, 'function');
  const referente = { ruolo: 'referente' };
  const tomas = { ruolo: 'produzione', modalitaFatturazione: 'nessuna' };
  const venditore = { ruolo: 'venditore', modalitaFatturazione: 'nessuna' };

  assert.strictEqual(percentualeTasseEconomia([referente, tomas, venditore]), 60);
  assert.strictEqual(percentualeTasseEconomia([
    referente,
    { ...tomas, modalitaFatturazione: 'totale' },
    venditore
  ]), 40);
  assert.strictEqual(percentualeTasseEconomia([
    referente,
    tomas,
    { ...venditore, modalitaFatturazione: 'mista' }
  ]), 40);
});

test('la ripartizione applica il 60% oppure la riduzione no-fattura del 20%', () => {
  assert.strictEqual(typeof appState, 'function');
  const stato = appState();
  const alessandro = { ruolo: 'referente', modalitaFatturazione: 'nessuna', haVenduto: false };
  const tomas = { ruolo: 'produzione', modalitaFatturazione: 'nessuna', haVenduto: false };
  const venditore = { ruolo: 'venditore', modalitaFatturazione: 'nessuna', haVenduto: true };
  stato.venditaEconomicaForm.importoVendita = 300;
  stato.venditaEconomicaForm.costi = [{ importo: 40 }];
  stato.venditaEconomicaForm.modalitaFatturazioneAdmin = 'totale';
  stato.venditaEconomicaForm.partecipanti = [alessandro, tomas, venditore];

  assert.strictEqual(stato.nettoDistribuibileEconomia(), 104);
  for (const partecipante of stato.venditaEconomicaForm.partecipanti) {
    assert.ok(Math.abs(stato.calcoloPartecipanteEconomia(partecipante).quotaCalcolata - 104 / 3) < 0.001);
  }

  tomas.modalitaFatturazione = 'totale';
  assert.strictEqual(stato.nettoDistribuibileEconomia(), 156);
  assert.strictEqual(stato.calcoloPartecipanteEconomia(tomas).quotaCalcolata, 52);
  assert.strictEqual(stato.calcoloPartecipanteEconomia(venditore).quotaCalcolata, 41.6);
  assert.strictEqual(stato.calcoloPartecipanteEconomia(alessandro).quotaCalcolata, 62.4);
});

test('inquadratura e zoom avatar vengono salvati nell’URL e riletti', () => {
  const url = avatarUrlConPosizione('https://example.com/avatar.png?v=1#vecchio', 25, 80, 1.5);
  assert.strictEqual(url, 'https://example.com/avatar.png?v=1#crop=25,80,1.5');
  assert.deepStrictEqual(posizioneAvatarDaUrl(url), { x: 25, y: 80, zoom: 1.5 });
  assert.deepStrictEqual(posizioneAvatarDaUrl('https://example.com/avatar.png#pos=40,60'), { x: 40, y: 60, zoom: 1 });
});

test('le statistiche del venditore usano la sua quota, non l’importo pieno della vendita condivisa', () => {
  assert.deepStrictEqual(calcolaStatisticheVenditore([
    { id: 'a', stato: 'attiva', importo_vendita: '1000' },
    { id: 'b', stato: 'annullata', importo_vendita: '500' }
  ], [
    { vendita_id: 'a', stato: 'incassato', importo: '240' },
    { vendita_id: 'a', stato: 'previsto', importo: '300' },
    { vendita_id: 'b', stato: 'incassato', importo: '100' }
  ], {
    a: 600, // quota_finale del venditore su una vendita da 1000 condivisa col team
    b: 500
  }), { generato: 600, incassato: 144 }); // 600 * (240 / 1000) incassato reale
});
