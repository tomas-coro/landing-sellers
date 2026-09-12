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
  valoreContrattoVendita,
  clientiAttribuitiAlProfilo,
  clientiDelVenditoreRiferimento,
  ordinaClassificaVenditori,
  ordinaTeamEconomico,
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

  const stato = appState();
  stato.avatarPosizione = { x: 0, y: 0, zoom: 1.5 };
  assert.match(stato.avatarStile(), /object-position:0% 0%/);
  stato.profiloPersonale.avatar_url = url;
  assert.match(stato.avatarPersonaleStile(), /object-position:25% 80%/);
});

test('il calendario admin riunisce le scadenze di tutti i venditori', () => {
  const stato = appState();
  stato.isAdmin = true;
  stato.adminVenditoriPerId = { v1: 'Alessandro', v2: 'Nicola' };
  stato.adminClienti = [
    { id: 'c1', nome: 'Cliente Uno', venditore_id: 'v1', prossimo_contatto: '2030-01-10' },
    { id: 'c2', nome: 'Cliente Due', venditore_id: 'v2', data_rinnovo: '2030-01-11', periodicita_contratto: 'annuale' }
  ];

  assert.deepStrictEqual(stato.eventiAgenda().map(evento => [evento.clienteNome, evento.venditoreNome]), [
    ['Cliente Uno', 'Alessandro'],
    ['Cliente Due', 'Nicola']
  ]);
});

test('agenda mostra tutte le rate e include quelle scadute nella vista oggi', () => {
  const stato = appState();
  const oggi = stato.dataISOOggi();
  const ieri = stato.aggiungiGiorniISO(oggi, -1);
  const domani = stato.aggiungiGiorniISO(oggi, 1);
  stato.clienti = [{ id: 'c1', nome: 'Cliente Uno', venditore_id: 'v1' }];
  stato.scadenzePagamentoPerCliente = {
    c1: [
      { id: 'p1', data: ieri, importo: 100 },
      { id: 'p2', data: domani, importo: 200 }
    ]
  };

  assert.deepStrictEqual(
    stato.eventiAgenda().filter(e => e.tipo === 'rata').map(e => e.pagamentoId),
    ['p1', 'p2']
  );
  assert.deepStrictEqual(
    stato.eventiAgendaVisibili().filter(e => e.tipo === 'rata').map(e => e.pagamentoId),
    ['p1']
  );
});

test('totale e residuo cliente derivano dalla vendita attiva', () => {
  const stato = appState();
  stato.venditaClienteAttiva = { importo_vendita: 500 };
  stato.pagamentiCliente = [
    { stato: 'incassato', importo: 125 },
    { stato: 'previsto', importo: 200 }
  ];

  assert.strictEqual(stato.totaleVenditaCliente(), 500);
  assert.strictEqual(stato.residuoCliente(), 375);
});

test('un cliente condiviso viene contato per ogni partecipante alla vendita', () => {
  const clienti = [
    { id: 'c1', venditore_id: 'tomas', stato: 'pubblicato' },
    { id: 'c2', venditore_id: 'alessandro', stato: 'in_lavorazione' }
  ];
  const vendite = [{ id: 'v1', cliente_id: 'c1' }];
  const partecipanti = [
    { vendita_id: 'v1', profilo_id: 'alessandro' },
    { vendita_id: 'v1', profilo_id: 'tomas' }
  ];

  assert.deepStrictEqual(
    clientiAttribuitiAlProfilo('alessandro', clienti, vendite, partecipanti).map(c => c.id),
    ['c1', 'c2']
  );
  assert.deepStrictEqual(
    clientiAttribuitiAlProfilo('tomas', clienti, vendite, partecipanti).map(c => c.id),
    ['c1']
  );
});

test('la dashboard attribuisce il cliente al venditore di riferimento, non a tutti i partecipanti', () => {
  const clienti = [
    { id: 'senza-terzo', venditore_id: 'alessandro' },
    { id: 'con-terzo', venditore_id: 'tomas' }
  ];
  const vendite = [
    { id: 'v1', cliente_id: 'senza-terzo', venditore_id: 'alessandro' },
    { id: 'v2', cliente_id: 'con-terzo', venditore_id: 'nicola' }
  ];

  assert.deepStrictEqual(
    clientiDelVenditoreRiferimento('alessandro', clienti, vendite).map(c => c.id),
    ['senza-terzo']
  );
  assert.deepStrictEqual(
    clientiDelVenditoreRiferimento('nicola', clienti, vendite).map(c => c.id),
    ['con-terzo']
  );
});

test('il venduto annualizza i mensili ma non moltiplica per gli anni di contratto', () => {
  const clienti = {
    mensile: { id: 'mensile', importo_abbonamento: 20, periodicita_contratto: 'mensile', durata_contratto_anni: 2 },
    biennale: { id: 'biennale', importo_abbonamento: 750, periodicita_contratto: 'annuale', durata_contratto_anni: 2 }
  };

  assert.strictEqual(valoreContrattoVendita({ cliente_id: 'mensile' }, clienti), 240);
  assert.strictEqual(valoreContrattoVendita({ cliente_id: 'biennale' }, clienti), 750);
});

test('il venduto conta ogni cliente una volta e include quelli non pubblicati', () => {
  const clienti = {
    a: { id: 'a', importo_abbonamento: 20, periodicita_contratto: 'mensile', stato: 'pubblicato' },
    b: { id: 'b', importo_abbonamento: 20, periodicita_contratto: 'mensile', stato: 'pubblicato' },
    c: { id: 'c', importo_abbonamento: 300, periodicita_contratto: 'annuale', stato: 'pubblicato' },
    d: { id: 'd', importo_abbonamento: 35, periodicita_contratto: 'mensile', stato: 'pubblicato' },
    metrix: { id: 'metrix', importo_abbonamento: 360, stato: 'in_lavorazione' }
  };
  const vendite = ['a', 'b', 'c', 'd', 'metrix', 'metrix'].map((cliente_id, indice) => ({
    id: String(indice), cliente_id, venditore_id: 'alessandro', stato: 'attiva', importo_vendita: clienti[cliente_id].importo_abbonamento
  }));

  const statistiche = calcolaStatisticheVenditore(vendite, [], {}, 'alessandro', clienti);
  assert.strictEqual(statistiche.venduto, 1560);
  assert.strictEqual(statistiche.numeroVendite, 5);
  assert.strictEqual(statistiche.mediaVendita, 312);
});

test('il team mostra Alessandro, Tomas, Nicola e poi i futuri venditori', () => {
  const team = [
    { nome: 'Zeno' },
    { nome: 'Nicola' },
    { nome: 'Tomas' },
    { nome: 'Alessandro' },
    { nome: 'Bruno' }
  ];

  assert.deepStrictEqual(
    ordinaTeamEconomico(team).map(persona => persona.nome),
    ['Alessandro', 'Tomas', 'Nicola', 'Bruno', 'Zeno']
  );
  assert.strictEqual(team[0].nome, 'Zeno');
});

test('la classifica ordina i venditori per venduto ed esclude il developer', () => {
  const venditori = [
    { nome: 'Tomas', ruolo: 'Developer', totaleVenduto: 9000 },
    { nome: 'Alessandro', ruolo: 'Referente', totaleVenduto: 1200 },
    { nome: 'Nicola', ruolo: 'Venditore', totaleVenduto: 1800 }
  ];

  assert.deepStrictEqual(
    ordinaClassificaVenditori(venditori).map(v => v.nome),
    ['Nicola', 'Alessandro']
  );
  assert.deepStrictEqual(venditori.map(v => v.nome), ['Tomas', 'Alessandro', 'Nicola']);
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
  }), {
    generato: 600,
    incassato: 144,
    venduto: 0,
    mediaVendita: 0,
    numeroVendite: 0
  }); // 600 * (240 / 1000) incassato reale
});

test('le gesture tornano correttamente dalle viste admin e secondarie', () => {
  const stato = appState();
  const chiamate = [];
  stato.isAdmin = true;
  stato.filtroVenditoreId = 'nicola';
  stato.view = 'lista';
  stato.tornaAllaDashboard = () => chiamate.push('admin');
  stato.eseguiNavigazioneGesture('right');

  stato.view = 'ricerca';
  stato.tornaDaRicerca = () => chiamate.push('ricerca');
  stato.eseguiNavigazioneGesture('right');

  assert.deepStrictEqual(chiamate, ['admin', 'ricerca']);
  assert.strictEqual(stato.vistaSupportaSwipeIndietro(), true);

  stato.view = 'admin';
  assert.strictEqual(stato.vistaSupportaSwipeAvanti(), true);
});
