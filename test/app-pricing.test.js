const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
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

test('il salvataggio converte sconto e date vuote in null', () => {
  const form = {
    nome: 'ZDE',
    sconto_tipo: '',
    data_attivazione: '',
    data_rinnovo: ''
  };
  assert.deepStrictEqual(normalizzaClientePerSalvataggio(form), {
    nome: 'ZDE',
    sconto_tipo: null,
    data_attivazione: null,
    data_rinnovo: null,
    prossimo_contatto: null,
    brief_cliente: null,
    prossima_azione: null,
    esito_motivazione: null
  });
  assert.strictEqual(form.sconto_tipo, '');
  assert.strictEqual(form.data_attivazione, '');
  assert.strictEqual(form.data_rinnovo, '');
});

test('un cliente legacy può impostare il rinnovo senza cambiare prezzo', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<select[^>]+x-model="nuovoClienteForm\.periodicita_contratto"/);
});

test('il database impedisce due vendite attive per lo stesso cliente', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migration_2026_09_12_02_vendita_unica_e_legacy.sql'),
    'utf8'
  );
  assert.match(sql, /create unique index/i);
  assert.match(sql, /where stato = 'attiva'/i);
});

test('una vendita attiva duplicata mostra un errore chiaro', () => {
  const js =
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app-economia.js'), 'utf8');
  assert.match(js, /error\.code === '23505'/);
  assert.match(js, /Questo cliente ha già una vendita attiva/);
});

test('la vendita salva anche lo snapshot della configurazione commerciale', () => {
  const js =
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, '..', 'js', 'app-economia.js'), 'utf8');
  assert.match(js, /'registra_vendita_completa'/);
  assert.match(js, /p_configurazione:\s*this\.venditaEconomicaForm\.configurazioneCommerciale/);
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



test('la descrizione commerciale usa una sola fonte per formula, upgrade ed extra', () => {
  const stato = appState();

  global.window ||= {};
  global.window.CATALOGO_PREZZI_LE = {
    formule: {
      mensile: {
        id: 'mensile',
        nome: 'Start mensile'
      },
      annuale: {
        id: 'annuale',
        nome: 'Start annuale'
      }
    },
    upgrade: [
      {
        id: 'gallery_dinamica',
        nome: 'Gallery dinamica'
      },
      {
        id: 'chatbot_ai',
        nome: 'Chatbot AI personalizzato'
      }
    ],
    annuali: {
      dominioIt: { nome: 'Dominio .it' },
      dominioCom: { nome: 'Dominio .com' },
      email5: { nome: 'Email - 5 caselle da 1 GB' }
    },
    sicurezza: {
      nome: 'Conservazione garantita per 12 mesi'
    }
  };

  assert.equal(
    stato.descrizioneConfigurazioneCommerciale({
      formula: 'annuale',
      periodicita_contratto: 'annuale',
      upgrade: ['gallery_dinamica'],
      pagine_extra: 1,
      lingue_extra: 0,
      cliente_ha_dominio: false,
      dominio_it: 0,
      dominio_com: 1,
      email_5_caselle: 0
    }),
    'Start annuale + Gallery dinamica + 1 pagina extra + Dominio .com'
  );
});

test('la descrizione salvata nello snapshot resta prioritaria per lo storico', () => {
  const stato = appState();

  assert.equal(
    stato.descrizioneConfigurazioneCommerciale(
      {
        formula: 'annuale',
        descrizione_pacchetto:
          'Start annuale + Gallery storica'
      },
      'Sito web',
      true
    ),
    'Start annuale + Gallery storica'
  );
});

test('una vendita storica con servizio generico usa le scelte gia salvate nello snapshot', () => {
  const stato = appState();

  global.window ||= {};
  global.window.CATALOGO_PREZZI_LE = {
    formule: {
      mensile: {
        id: 'mensile',
        nome: 'Start mensile'
      },
      annuale: {
        id: 'annuale',
        nome: 'Start annuale'
      }
    },
    upgrade: [
      {
        id: 'gallery_dinamica',
        nome: 'Gallery dinamica'
      }
    ],
    annuali: {
      dominioIt: { nome: 'Dominio .it' },
      dominioCom: { nome: 'Dominio .com' },
      email5: { nome: 'Email - 5 caselle da 1 GB' }
    },
    sicurezza: {
      nome: 'Conservazione garantita per 12 mesi'
    }
  };

  stato.pacchettoVenditaPerCliente = {
    c1: {
      nomePacchetto: 'Sito web',
      configurazioneCommerciale: {
        formula: 'annuale',
        periodicita_contratto: 'annuale',
        upgrade: ['gallery_dinamica'],
        pagine_extra: 1,
        lingue_extra: 0,
        cliente_ha_dominio: true,
        dominio_it: 0,
        dominio_com: 0,
        email_5_caselle: 0
      }
    }
  };

  assert.equal(
    stato.etichettaPacchettoCliente({
      id: 'c1',
      nome_pacchetto: ''
    }),
    'Start annuale + Gallery dinamica + 1 pagina extra'
  );
});

test('senza snapshot commerciale la descrizione legacy non viene inventata', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    legacy: {
      nomePacchetto: 'Sito web',
      configurazioneCommerciale: null
    }
  };

  assert.equal(
    stato.etichettaPacchettoCliente({
      id: 'legacy',
      nome_pacchetto: 'Vecchio pacchetto'
    }),
    'Sito web'
  );
});

test('le nuove vendite congelano la descrizione commerciale dentro lo snapshot', () => {
  const js = require('fs').readFileSync(
    require('path').join(
      __dirname,
      '..',
      'js',
      'app-vendita.js'
    ),
    'utf8'
  );

  assert.match(
    js,
    /cfg\.descrizione_pacchetto\s*=\s*descrizionePacchetto/
  );

  assert.match(
    js,
    /this\.venditaEconomicaForm\.servizio\s*=\s*descrizionePacchetto/
  );
});

test('la Home usa la vendita attiva per valore annuale e durata contratto', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      venditaId: 'v1',
      nomePacchetto: 'Start annuale',
      importoVendita: 540,
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 1,
      dataVendita: '2026-09-25'
    }
  };

  const cliente = {
    id: 'c1',
    nome: 'Spazio52',
    importo_abbonamento: 0,
    periodicita_contratto: null,
    durata_contratto_anni: null
  };

  assert.equal(
    stato.riepilogoContrattoCliente(cliente).valoreAnnuale,
    540
  );

  assert.equal(
    stato.etichettaImportoCliente(cliente),
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(540) + '/anno'
  );

  assert.equal(
    stato.etichettaDurataContrattoCliente(cliente),
    '1 anno'
  );

  assert.equal(
    stato.etichettaPeriodicitaContrattoCliente(cliente),
    'Annuale'
  );
});

test('un contratto pluriennale mostra il valore medio annuale senza usare il catalogo corrente', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      venditaId: 'v1',
      importoVendita: 1500,
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 2,
      dataVendita: '2026-09-25'
    }
  };

  const cliente = {
    id: 'c1',
    importo_abbonamento: null
  };

  assert.equal(
    stato.riepilogoContrattoCliente(cliente).valoreAnnuale,
    750
  );

  assert.equal(
    stato.etichettaDurataContrattoCliente(cliente),
    '2 anni'
  );
});

test('la Home deriva automaticamente il rinnovo annuale dalla data vendita', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      venditaId: 'v1',
      importoVendita: 540,
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 1,
      dataVendita: '2026-09-25'
    }
  };

  const cliente = {
    id: 'c1',
    data_rinnovo: null,
    data_attivazione: null
  };

  assert.equal(
    stato.rinnovoCalcolatoCliente(
      cliente,
      '2026-09-25'
    ),
    '2027-09-25'
  );
});

test('una scadenza rinnovo esplicita resta prioritaria sul calcolo automatico', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 1,
      dataVendita: '2026-09-25'
    }
  };

  const cliente = {
    id: 'c1',
    data_rinnovo: '2027-10-10'
  };

  assert.equal(
    stato.rinnovoCalcolatoCliente(
      cliente,
      '2026-09-25'
    ),
    '2027-10-10'
  );
});

test('una rata precedente al rinnovo resta la prossima scadenza della card', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 1,
      dataVendita: '2026-09-25'
    }
  };

  stato.scadenzePagamentoPerCliente = {
    c1: [{
      id: 'p1',
      tipo: 'rata',
      label: 'Rata',
      data: '2027-02-15',
      importo: 270
    }]
  };

  const cliente = {
    id: 'c1',
    data_rinnovo: null,
    prossimo_contatto: null
  };

  const scadenza =
    stato.prossimaScadenzaCliente(
      cliente,
      '2026-09-25'
    );

  assert.equal(scadenza.tipo, 'rata');
  assert.equal(scadenza.data, '2027-02-15');
  assert.equal(scadenza.importo, 270);
});

test('i clienti legacy continuano a usare i dati storici senza ricalcolo dal catalogo', () => {
  const stato = appState();

  const cliente = {
    id: 'legacy',
    importo_abbonamento: 35,
    periodicita_contratto: 'mensile',
    durata_contratto_anni: 1,
    data_rinnovo: '2026-12-01'
  };

  assert.equal(
    stato.riepilogoContrattoCliente(cliente).valoreAnnuale,
    420
  );

  assert.equal(
    stato.etichettaImportoCliente(cliente),
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(420) + '/anno'
  );

  assert.equal(
    stato.rinnovoCalcolatoCliente(
      cliente,
      '2026-09-25'
    ),
    '2026-12-01'
  );
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

test('anche nel dettaglio economico il totale mensile viene mostrato su base annuale', () => {
  const stato = appState();
  stato.clienteEconomiaSelezionato = {
    id: 'mr-smoky',
    importo_abbonamento: 20,
    periodicita_contratto: 'mensile'
  };
  stato.venditaClienteAttiva = { importo_vendita: 20 };

  assert.strictEqual(stato.totaleVenditaCliente(), 240);
  assert.strictEqual(stato.residuoCliente(), 240);
  assert.strictEqual(stato.valoreAnnualeVenditaEconomia(stato.venditaClienteAttiva), 240);
});

test('senza vendita attiva non mostra un pagamento da saldare', () => {
  const stato = appState();

  assert.strictEqual(stato.statoPagamentoCliente(), 'nessuna_vendita');
  assert.strictEqual(stato.etichettaStatoPagamentoCliente(), 'Nessuna vendita');
});

test('WhatsApp aggiunge il prefisso italiano solo ai numeri locali', () => {
  const stato = appState();

  assert.strictEqual(stato.whatsappCliente({ telefono: '333 123 4567' }), 'https://wa.me/393331234567');
  assert.strictEqual(stato.whatsappCliente({ telefono: '+39 333 123 4567' }), 'https://wa.me/393331234567');
  assert.strictEqual(stato.whatsappCliente({ telefono: '+44 20 1234 5678' }), 'https://wa.me/442012345678');
  assert.strictEqual(stato.whatsappCliente({ telefono: '0044 20 1234 5678' }), 'https://wa.me/442012345678');
  assert.strictEqual(stato.whatsappCliente({ telefono: '' }), '');
});

test('la Pipeline seleziona lo stato reale del cliente', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  assert.match(html, /:selected="opzione\.valore === cliente\.stato"/);
});

test('il form cliente chiede conferma solo se contiene modifiche non salvate', async () => {
  const stato = appState();
  stato.view = 'nuovo';
  stato.clienteFormSnapshot = stato.snapshotFormCliente();

  assert.strictEqual(await stato.confermaUscitaFormCliente(), true);

  stato.nuovoClienteForm.nome = 'Cliente non salvato';
  const uscita1 = stato.annullaFormCliente();
  assert.strictEqual(stato.confermaGenerica.aperto, true);
  stato.rispondiConferma(false);
  await uscita1;
  assert.strictEqual(stato.view, 'nuovo');

  const uscita2 = stato.annullaFormCliente();
  assert.strictEqual(stato.confermaGenerica.aperto, true);
  stato.rispondiConferma(true);
  await uscita2;
  assert.strictEqual(stato.view, 'lista');
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



test('un contratto pluriennale usa il totale vendita per la percentuale incassata', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      venditaId: 'v1',
      importoVendita: 1500,
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 2,
      dataVendita: '2026-09-25'
    }
  };

  stato.riepilogoPagamentiPerCliente = {
    c1: {
      numeroVendite: 1,
      totaleVendite: 1500,
      incassato: 750,
      rateIncassate: 1,
      ratePreviste: 1,
      percentualeIncassata: 50
    }
  };

  const cliente = {
    id: 'c1',
    nome: 'Contratto biennale'
  };

  assert.equal(
    stato.riepilogoContrattoCliente(cliente).valoreAnnuale,
    750
  );

  assert.equal(
    stato.riepilogoPagamentoListaCliente(cliente).totaleVendite,
    1500
  );

  assert.equal(
    stato.riepilogoPagamentoListaCliente(cliente).percentualeIncassata,
    50
  );

  const summary =
    stato.schedaClienteCompleta(cliente);

  assert.equal(summary.valoreAnnuale, 750);
  assert.equal(summary.totalePagamento, 1500);
  assert.equal(summary.incassato, 750);
  assert.equal(summary.percentualeIncassata, 50);
});

test('schedaClienteCompleta normalizza sempre gli stessi campi', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      venditaId: 'v1',
      nomePacchetto: 'Start annuale',
      importoVendita: 540,
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 1,
      dataVendita: '2026-09-25'
    }
  };

  stato.riepilogoPagamentiPerCliente = {
    c1: {
      numeroVendite: 1,
      totaleVendite: 540,
      incassato: 270,
      rateIncassate: 1,
      ratePreviste: 0,
      percentualeIncassata: 50
    }
  };

  const summary =
    stato.schedaClienteCompleta({
      id: 'c1',
      nome: 'Spazio52',
      stato: 'vinto',
      prossimo_contatto: null
    });

  assert.equal(summary.nome, 'Spazio52');
  assert.equal(summary.pacchetto, 'Start annuale');
  assert.equal(summary.valoreAnnuale, 540);
  assert.equal(summary.durataContrattoLabel, '1 anno');
  assert.equal(summary.periodicitaContrattoLabel, 'Annuale');
  assert.equal(summary.incassato, 270);
  assert.equal(summary.totalePagamento, 540);
  assert.equal(summary.percentualeIncassata, 50);

  assert.ok(
    Object.hasOwn(summary, 'prossimaScadenzaLabel')
  );

  assert.ok(
    Object.hasOwn(summary, 'prossimaScadenzaDataLabel')
  );
});

test('schedaClienteCompleta usa fallback grafici standard senza inventare dati', () => {
  const stato = appState();

  const summary =
    stato.schedaClienteCompleta({
      id: 'legacy-vuoto',
      nome: 'Legacy',
      stato: 'contattato'
    });

  assert.equal(summary.nome, 'Legacy');
  assert.equal(
    summary.pacchetto,
    'Pacchetto non specificato'
  );
  assert.equal(summary.valoreAnnualeLabel, '-');
  assert.equal(summary.durataContrattoLabel, '-');
  assert.equal(
    summary.periodicitaContrattoLabel,
    'Non indicata'
  );
  assert.equal(
    summary.prossimaScadenzaLabel,
    'Nessuna'
  );
  assert.equal(
    summary.prossimaScadenzaDataLabel,
    'Nessuna scadenza'
  );
  assert.equal(
    summary.percentualeIncassataLabel,
    'Importo non indicato'
  );
});

test('schedaClienteCompleta usa automaticamente rata prima del rinnovo', () => {
  const stato = appState();

  stato.pacchettoVenditaPerCliente = {
    c1: {
      importoVendita: 540,
      periodicitaContratto: 'annuale',
      durataContrattoAnni: 1,
      dataVendita: '2026-09-25'
    }
  };

  stato.scadenzePagamentoPerCliente = {
    c1: [{
      id: 'r1',
      tipo: 'rata',
      label: 'Rata',
      data: '2027-02-15',
      importo: 270
    }]
  };

  const originale = stato.dataISOOggi;
  stato.dataISOOggi = () => '2026-09-25';

  const summary =
    stato.schedaClienteCompleta({
      id: 'c1',
      nome: 'Cliente',
      data_rinnovo: null,
      prossimo_contatto: null
    });

  stato.dataISOOggi = originale;

  assert.match(
    summary.prossimaScadenzaLabel,
    /^Rata/
  );

  assert.equal(
    summary.prossimaScadenza.data,
    '2027-02-15'
  );
});

test('la pagina Clienti usa solo la scheda cliente normalizzata per i dati principali', () => {
  const html = require('fs').readFileSync(
    require('path').join(
      __dirname,
      '..',
      'index.html'
    ),
    'utf8'
  );

  assert.match(
    html,
    /schedaClienteCompleta\(cliente\)\.pacchetto/
  );

  assert.match(
    html,
    /schedaClienteCompleta\(cliente\)\.valoreAnnualeLabel/
  );

  assert.match(
    html,
    /schedaClienteCompleta\(cliente\)\.durataContrattoLabel/
  );

  assert.match(
    html,
    /schedaClienteCompleta\(cliente\)\.periodicitaContrattoLabel/
  );

  assert.match(
    html,
    /schedaClienteCompleta\(cliente\)\.prossimaScadenzaLabel/
  );

  assert.match(
    html,
    /schedaClienteCompleta\(cliente\)\.totalePagamento/
  );
});

test('la card cliente mostra sempre il valore annuale, anche senza vendita economica', () => {
  const stato = appState();
  const cliente = {
    id: 'mr-smoky',
    importo_abbonamento: 20,
    periodicita_contratto: 'mensile'
  };

  assert.deepStrictEqual(stato.riepilogoPagamentoListaCliente(cliente), {
    numeroVendite: 0,
    totaleVendite: 240,
    incassato: 0,
    rateIncassate: 0,
    ratePreviste: 0,
    percentualeIncassata: 0
  });

  stato.riepilogoPagamentiPerCliente[cliente.id] = {
    numeroVendite: 1,
    totaleVendite: 20,
    incassato: 20,
    rateIncassate: 1,
    ratePreviste: 0,
    percentualeIncassata: 100
  };

  assert.strictEqual(stato.riepilogoPagamentoListaCliente(cliente).totaleVendite, 240);
  assert.strictEqual(stato.riepilogoPagamentoListaCliente(cliente).percentualeIncassata, 20 / 240 * 100);
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

test('il motore economico riconosce partecipanti legacy senza id o nome', () => {
  const stato = appState();

  const alessandro = {
    ruolo: 'referente',
    modalitaFatturazione: 'nessuna',
    haVenduto: false
  };

  const tomas = {
    ruolo: 'produzione',
    modalitaFatturazione: 'nessuna',
    haVenduto: false
  };

  const venditore = {
    ruolo: 'venditore',
    modalitaFatturazione: 'nessuna',
    haVenduto: true
  };

  stato.venditaEconomicaForm.importoVendita = 300;
  stato.venditaEconomicaForm.costi = [{ importo: 40 }];
  stato.venditaEconomicaForm.modalitaFatturazioneAdmin = 'totale';
  stato.venditaEconomicaForm.partecipanti = [
    alessandro,
    tomas,
    venditore
  ];

  for (const partecipante of stato.venditaEconomicaForm.partecipanti) {
    const calcolo =
      stato.calcoloPartecipanteEconomia(partecipante);

    assert.ok(calcolo);
    assert.ok(
      Math.abs(calcolo.quotaCalcolata - 104 / 3) < 0.001
    );
  }
});

test('in modalità incasso i costi della vendita sono applicati in proporzione alla rata', () => {
  const stato = appState();

  stato.costiVenditaRiferimento = [
    { descrizione: 'Costo vendita', importo: 50 }
  ];
  stato.venditaEconomicaForm.importoVendita = 540;
  stato.venditaEconomicaForm.importoIncassato = 270;

  assert.deepEqual(
    stato.costiPerMotoreRataEconomia(),
    [{ descrizione: 'Costo vendita', importo: 25 }]
  );
});

test('PROBLEMA 2: la fatturazione della rata è derivata da quella consolidata della vendita, non impostabile a parte', () => {
  const stato = appState();

  stato.venditaEconomicaForm.importoVendita = 1000;
  stato.venditaEconomicaForm.importoIncassato = 500;

  stato.venditaEconomicaForm.partecipanti = [
    {
      id: 'a',
      ruolo: 'referente',
      // Modalità e importo fatturato decisi alla registrazione della
      // vendita (consolidati sull'importo TOTALE della vendita).
      modalitaFatturazione: 'mista',
      importoFatturato: 400
    }
  ];

  const [referente] = stato.partecipantiPerMotoreRataEconomia();

  assert.equal(referente.modalitaFatturazione, 'mista');

  // Stessa proporzione fatturato/vendita (400/1000) applicata
  // all'importo di questa rata (500): 200.
  assert.equal(referente.importoFatturato, 200);
});

test('PROBLEMA 2: un override consolidato della vendita viene applicato automaticamente alla rata, scalato in proporzione', () => {
  const stato = appState();

  stato.venditaEconomicaForm.importoVendita = 375;
  stato.venditaEconomicaForm.importoIncassato = 187.5;

  stato.venditaEconomicaForm.partecipanti = [
    { id: 'a', ruolo: 'referente', modalitaFatturazione: 'totale' },
    {
      id: 't',
      ruolo: 'produzione',
      modalitaFatturazione: 'nessuna',

      // Override consolidato deciso alla registrazione della vendita
      // (50 euro sull'intera vendita da 375).
      quotaOverride: true,
      quotaEffettiva: 50
    }
  ];

  const partecipanti = stato.partecipantiPerMotoreRataEconomia();
  const tomas = partecipanti.find(p => p.id === 't');

  // Nessun controllo "manuale" sulla rata: l'override consolidato
  // si applica sempre, scalato sulla proporzione della rata (187.5/375).
  assert.equal(tomas.quotaOverride, true);
  assert.equal(tomas.quotaEffettiva, 25);
});

test('un costo della rata viene salvato separatamente dai costi della vendita', () => {
  const stato = appState();

  stato.venditaEconomicaForm.costi = [
    {
      id: 'vendita',
      descrizione: 'Costo vendita',
      importo: 40
    }
  ];

  stato.venditaEconomicaForm.costoRataDescrizione =
    'Costo rata';

  stato.venditaEconomicaForm.costoRataImporto = 15;

  stato.aggiungiCostoRataEconomia();

  assert.equal(
    stato.venditaEconomicaForm.costi.length,
    1
  );

  assert.equal(
    stato.venditaEconomicaForm.costiRata.length,
    1
  );

  assert.equal(
    stato.venditaEconomicaForm.costiRata[0].descrizione,
    'Costo rata'
  );

  assert.equal(
    stato.venditaEconomicaForm.costiRata[0].importo,
    15
  );

  assert.deepEqual(
    stato.costiPerMotoreRataEconomia(),
    [
      {
        descrizione: 'Costo rata',
        importo: 15
      }
    ]
  );
});

test('il payload economico della rata salva la quota finale effettiva', () => {
  const stato = appState();

  const payload =
    stato.payloadSnapshotPagamentoEconomia({
      importoPagamento: 375,
      totaleCosti: 40,
      margine: 335,
      percentualeTasse: 60,
      percentualeFatturataAdmin: 100,
      importoTasse: 201,
      nettoDistribuibile: 134,
      costiApplicati: [
        {
          descrizione: 'Costi iniziali',
          importo: 40
        }
      ],
      partecipanti: [
        {
          id: 'profilo-tomas',
          ruolo: 'produzione',
          modalitaFatturazione: 'nessuna',
          importoFatturato: 0,
          quotaBase: 44.67,
          quotaTeorica: 44.67,
          percentualeRiduzione: 0,
          riduzioneNoFattura: 0,
          bonusAdmin: 0,
          quotaCalcolata: 44.67,
          quotaFinale: 50,
          quotaOverride: true
        }
      ]
    });

  assert.equal(
    payload.calcolo.importo_pagamento,
    375
  );

  assert.equal(
    payload.calcolo.importo_costi,
    40
  );

  assert.equal(
    payload.partecipanti[0].quota_effettiva,
    50
  );

  assert.equal(
    payload.partecipanti[0].quota_override,
    true
  );

  assert.deepEqual(
    payload.calcolo.costi_snapshot,
    [
      {
        descrizione: 'Costi iniziali',
        importo: 40
      }
    ]
  );
});

test('il riepilogo rata appare solo per un incasso valido', () => {
  const stato = appState();
  const riepilogo = { importoPagamento: 100 };
  let calcoli = 0;
  stato.snapshotPagamentoEconomia = () => {
    calcoli += 1;
    return riepilogo;
  };
  stato.venditaEconomicaForm.partecipanti = [{ id: 'a' }];
  stato.venditaEconomicaForm.importoIncassato = 100;
  stato.venditaEconomicaAttiva = { id: 'v1' };

  assert.equal(stato.previewPagamentoEconomia(), null);

  stato.modalitaEconomia = 'incasso';
  assert.strictEqual(stato.previewPagamentoEconomia(), riepilogo);
  assert.equal(calcoli, 1);

  stato.venditaEconomicaForm.statoIncasso = 'previsto';
  assert.equal(stato.previewPagamentoEconomia(), null);
});

test('l’azione cliente apre incasso con vendita attiva e vendita negli altri casi', async () => {
  const stato = appState();
  const aperture = [];
  stato.clienti = [
    { id: 'c1', haVenditaAttiva: true },
    { id: 'c2', haVenditaAttiva: false }
  ];
  stato.chiudiAzioniCliente = () => {};
  stato.apriPagamentoCliente = async cliente => aperture.push(['incasso', cliente.id]);
  stato.apriEconomia = async modalita => aperture.push([modalita]);
  stato.selezionaClienteEconomia = cliente => aperture.push(['cliente', cliente.id]);

  stato.clienteAzioniRapideId = 'c1';
  await stato.apriEconomiaDaAzioniCliente();
  stato.clienteAzioniRapideId = 'c2';
  await stato.apriEconomiaDaAzioniCliente();

  assert.deepStrictEqual(aperture, [
    ['incasso', 'c1'],
    ['vendita'],
    ['cliente', 'c2']
  ]);
});

test('pipeline commerciale e produzione restano separate', () => {
  const stato = appState();
  stato.clienti = [
    { id: '1', nome: 'A', stato: 'vinto', stato_produzione: 'in_lavorazione' },
    { id: '2', nome: 'B', stato: 'perso', stato_produzione: null },
    { id: '3', nome: 'C', stato: 'vinto', stato_produzione: 'pubblicato' }
  ];

  assert.deepStrictEqual(stato.statiPipeline().map(s => s.valore), [
    'contattato', 'brief_mandato', 'vinto', 'perso'
  ]);
  assert.deepStrictEqual(stato.clientiPipeline('vinto').map(c => c.id), ['1', '3']);
  assert.deepStrictEqual(stato.clientiPubblicati().map(c => c.id), ['3']);
  assert.ok(stato.funnelPipeline().every(s => !('conversione' in s)));
});

test('la migrazione conserva i vecchi stati nella nuova struttura CRM', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260922120000_pipeline_commerciale_produzione.sql'),
    'utf8'
  );
  assert.match(sql, /when 'in_lavorazione' then 'in_lavorazione'/);
  assert.match(sql, /when stato in \('in_lavorazione', 'pubblicato'\) then 'vinto'/);
  assert.match(sql, /imposta_stato_produzione/);
});

test('lo storico registra prezzo e scadenza nel database', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260924170000_storico_modifiche_cliente.sql'),
    'utf8'
  );

  assert.match(sql, /'prezzo'/);
  assert.match(sql, /new\.importo_abbonamento is distinct from old\.importo_abbonamento/i);
  assert.match(sql, /'scadenza'/);
  assert.match(sql, /new\.data_rinnovo is distinct from old\.data_rinnovo/i);
  assert.match(sql, /auth\.uid\(\)/i);
});

test('la timeline mostra prezzo, scadenza e autore della modifica', () => {
  global.formattaData = data => `data:${data}`;
  global.formattaStato = stato => `stato:${stato}`;

  const stato = appState();
  stato.attivitaCliente = [
    { id: '1', tipo: 'prezzo', creata_il: '2026-09-23', valore_precedente: '300', valore_nuovo: '400', attore: { nome: 'Tomas' } },
    { id: '2', tipo: 'scadenza', creata_il: '2026-09-24', valore_precedente: '2026-10-01', valore_nuovo: '2026-11-01', attore: { username: 'tom' } }
  ];

  const eventi = stato.timelineCliente();
  assert.deepStrictEqual(eventi.map(({ titolo, dettaglio, attore }) => ({ titolo, dettaglio, attore })), [
    { titolo: 'Scadenza aggiornata', dettaglio: 'data:2026-10-01 → data:2026-11-01', attore: 'tom' },
    { titolo: 'Prezzo aggiornato', dettaglio: '300,00 € → 400,00 €', attore: 'Tomas' }
  ]);

  delete global.formattaData;
  delete global.formattaStato;
});

test('la timeline formatta le attività senza metodi Alpine inesistenti', () => {
  global.formattaData = data => `data:${data}`;
  global.formattaStato = stato => `stato:${stato}`;

  const stato = appState();
  stato.attivitaCliente = [
    { id: '1', tipo: 'stato', creata_il: '2026-09-17', valore_precedente: 'contattato', valore_nuovo: 'pubblicato' },
    { id: '2', tipo: 'contatto_completato', creata_il: '2026-09-18', valore_precedente: '2026-09-18' }
  ];

  assert.deepStrictEqual(stato.timelineCliente().map(evento => evento.dettaglio), [
    'data:2026-09-18',
    'stato:contattato → stato:pubblicato'
  ]);

  delete global.formattaData;
  delete global.formattaStato;
});

test('la scheda cliente permette di correggere i servizi senza passare al catalogo corrente', () => {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'),
    'utf8'
  );

  assert.match(
    html,
    /Modifica servizi/
  );

  assert.match(
    html,
    /salvaServiziCliente\(\)/
  );

  assert.match(
    html,
    /non ricalcola il prezzo storico/
  );
});

test('la modifica servizi usa una RPC dedicata e non aggiorna importo vendita', () => {
  const js = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'js',
      'app-cliente.js'
    ),
    'utf8'
  );

  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migration_2026_09_25_01_aggiorna_servizi_cliente.sql'
    ),
    'utf8'
  );

  assert.match(
    js,
    /\.rpc\(\s*'aggiorna_servizi_cliente'/
  );

  assert.match(
    sql,
    /configurazione_commerciale\s*=\s*v_configurazione_nuova/
  );

  assert.match(
    sql,
    /servizio\s*=\s*v_descrizione/
  );

  assert.doesNotMatch(
    sql,
    /set\s+importo_vendita\s*=/i
  );

  assert.doesNotMatch(
    sql,
    /update\s+public\.pagamenti/i
  );

  assert.doesNotMatch(
    sql,
    /update\s+public\.vendita_partecipanti/i
  );

  assert.doesNotMatch(
    sql,
    /update\s+public\.costi_vendita/i
  );
});

test('il caricamento standard della vendita include sempre lo snapshot commerciale', () => {
  const js = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'js',
      'app-cliente.js'
    ),
    'utf8'
  );

  const occorrenze =
    js.match(
      /id,cliente_id,importo_vendita,servizio,data_vendita,creato_il,configurazione_commerciale/g
    ) || [];

  assert.ok(
    occorrenze.length >= 2
  );
});

test('l editor servizi recupera automaticamente extra storici dal cliente', () => {
  const stato = appState();

  const form =
    stato.formServiziClienteDaStorico(
      {
        nome_pacchetto: 'Start annuale',
        periodicita_contratto: 'annuale',
        pagine_extra: 2,
        lingue_extra: 1,
        cliente_ha_dominio: false,
        dominio_it: 1,
        dominio_com: 0,
        email_5_caselle: 1,
        pacchetto_sicurezza: false
      },
      {
        servizio: 'Start annuale',
        configurazione_commerciale: null
      }
    );

  assert.equal(form.formula, 'annuale');
  assert.equal(form.pagine_extra, 2);
  assert.equal(form.lingue_extra, 1);
  assert.equal(form.cliente_ha_dominio, false);
  assert.equal(form.dominio_it, 1);
  assert.equal(form.email_5_caselle, 1);
});

test('v129 sincronizza automaticamente cliente e vendita commerciale', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.match(
    sql,
    /sincronizza_cliente_da_configurazione/
  );

  assert.match(
    sql,
    /create or replace function public\.registra_vendita_completa/
  );

  assert.match(
    sql,
    /perform public\.sincronizza_cliente_da_configurazione/
  );

  assert.match(
    sql,
    /create or replace function public\.aggiorna_servizi_cliente/
  );
});

test('v129 non ricalcola dati economici storici nel backfill', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.doesNotMatch(
    sql,
    /update\s+public\.pagamenti/i
  );

  assert.doesNotMatch(
    sql,
    /update\s+public\.vendita_partecipanti/i
  );

  assert.doesNotMatch(
    sql,
    /update\s+public\.costi_vendita/i
  );

  assert.doesNotMatch(
    sql,
    /set\s+importo_vendita\s*=/i
  );
});

test('v129 supporta quantita dominio ed email fino a 10', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.match(
    sql,
    /least\(\s*10,\s*coalesce\(\s*\(v_cfg ->> 'dominio_it'\)::integer/s
  );

  assert.match(
    sql,
    /least\(\s*10,\s*coalesce\(\s*\(v_cfg ->> 'dominio_com'\)::integer/s
  );

  assert.match(
    sql,
    /least\(\s*10,\s*coalesce\(\s*\(v_cfg ->> 'email_5_caselle'\)::integer/s
  );
});

test('v129 backfill ricostruisce descrizione dai dati cliente senza inventare servizi', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.match(sql, /Start annuale/);
  assert.match(sql, /pagina extra/);
  assert.match(sql, /Dominio \.it/);

  assert.match(
    sql,
    /v_testo like '%gallery dinamica%'/
  );
});

test('v129 propaga le modifiche commerciali cliente alla vendita attiva', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.match(
    sql,
    /create or replace function public\.sincronizza_vendita_da_cliente/
  );

  assert.match(
    sql,
    /create trigger trg_sincronizza_vendita_da_cliente/
  );

  assert.match(
    sql,
    /after update of[\s\S]*pagine_extra[\s\S]*dominio_it[\s\S]*pacchetto_sicurezza/
  );
});

test('v129 data attivazione si inserisce nella vendita e arriva al cliente', () => {
  const app = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'app.js'),
    'utf8'
  );

  const html = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'),
    'utf8'
  );

  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.match(
    app,
    /configurazioneCommerciale:[\s\S]*data_attivazione:\s*''/
  );

  assert.match(
    html,
    /venditaEconomicaForm\.configurazioneCommerciale\.data_attivazione/
  );

  assert.match(
    sql,
    /data_attivazione\s*=\s*case/
  );
});

test('v129 rigenera le descrizioni legacy da configurazione consolidata', () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'supabase',
      'migrations',
      '20260925164500_commercial_single_source.sql'
    ),
    'utf8'
  );

  assert.match(
    sql,
    /v_cfg - 'descrizione_pacchetto'/
  );

  assert.match(
    sql,
    /descrizione_configurazione_commerciale/
  );
});

test('v129 Home admin ricarica dashboard e clienti prima di mostrare le card', () => {
  const app = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'app.js'),
    'utf8'
  );

  assert.match(
    app,
    /async vaiHome\(\)[\s\S]*if \(this\.isAdmin\)[\s\S]*await this\.caricaDashboardAdmin\(\)[\s\S]*await this\.caricaClienti\(\)/
  );
});

test('v129 ritorno dalla scheda rilegge i clienti prima della navigazione', () => {
  const cliente = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'app-cliente.js'),
    'utf8'
  );

  assert.match(
    cliente,
    /async tornaDaScheda\(\)[\s\S]*await this\.caricaClienti\(\)[\s\S]*history\.back\(\)/
  );
});

test('v129 modifica servizi rilegge DB prima di aggiornare la UI', () => {
  const cliente = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'app-cliente.js'),
    'utf8'
  );

  assert.match(
    cliente,
    /async salvaServiziCliente\(\)[\s\S]*rpc\([\s\S]*aggiorna_servizi_cliente[\s\S]*await this\.caricaClienti\(\)[\s\S]*await this\.caricaPagamentiCliente/
  );
});
