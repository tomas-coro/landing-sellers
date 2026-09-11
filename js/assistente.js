// Manuale verificato dell'app: una risposta breve per ogni azione disponibile.
const FAQ_ASSISTENTE = [
  {
    "categoria": "Orientamento",
    "domanda": "Dove trovo le funzioni principali?",
    "cerca": "funzioni principali navigazione menu barra home agenda nuovo pipeline profilo",
    "risposta": "Usa la barra in basso: Home riepiloga il lavoro, Agenda mostra le scadenze, Nuovo aggiunge clienti o pagamenti, Pipeline organizza le trattative e Profilo contiene impostazioni e account."
  },
  {
    "categoria": "Orientamento",
    "domanda": "Cosa mostrano i numeri della Home?",
    "cerca": "numeri home totale generato venduto media vendita incassato siti attivi",
    "risposta": "La Home mostra clienti e siti attivi, totale generato, totale venduto, media vendita e totale incassato. Più sotto trovi Pipeline, attività di oggi e ultimi clienti."
  },
  {
    "categoria": "Orientamento",
    "domanda": "Come apro l’elenco completo dei clienti?",
    "cerca": "aprire elenco completo archivio tutti clienti vedi",
    "risposta": "Dalla Home, nella sezione “Ultimi clienti”, premi “Vedi tutti”. Si apre l’archivio con ricerca, filtri, ordinamento e pagine."
  },
  {
    "categoria": "Orientamento",
    "domanda": "Come torno alla schermata precedente?",
    "cerca": "tornare indietro schermata precedente swipe gesto",
    "risposta": "Usa “Indietro” o “Home” in alto. Su mobile puoi anche scorrere dal bordo sinistro verso destra nelle schermate supportate."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come aggiungo un nuovo cliente?",
    "cerca": "aggiungere creare inserire nuovo cliente anagrafica",
    "risposta": "Premi “Nuovo” nella barra in basso, scegli “Nuovo cliente”, completa dati, offerta e rinnovi, poi premi “Salva cliente”."
  },
  {
    "categoria": "Clienti",
    "domanda": "Quali dati servono per salvare un cliente?",
    "cerca": "dati obbligatori servono salvare cliente nome attivazione",
    "risposta": "Il nome è obbligatorio. Per le offerte del catalogo serve anche la data di attivazione; email e URL vengono controllati se li inserisci."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come modifico un cliente?",
    "cerca": "modificare cambiare dati anagrafica cliente matita",
    "risposta": "Apri la scheda cliente e premi la matita in alto. Modifica i dati e premi “Salva modifiche”."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come elimino un cliente?",
    "cerca": "eliminare cancellare rimuovere cliente cestino",
    "risposta": "Apri la scheda cliente, premi il cestino in alto e conferma. Il cliente resta recuperabile per 30 giorni."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come recupero un cliente eliminato?",
    "cerca": "recuperare ripristinare cestino eliminato cancellato cliente",
    "risposta": "Apri Profilo, entra in “Cestino” e premi “Ripristina”. Dopo 30 giorni l’eliminazione diventa definitiva."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come cerco nell’archivio clienti?",
    "cerca": "cercare archivio elenco nome referente clienti",
    "risposta": "Apri “Vedi tutti” dalla Home e usa il campo in alto. La ricerca dell’archivio controlla nome e referente."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come funziona la ricerca globale?",
    "cerca": "ricerca globale lente telefono email piva note trovare cliente",
    "risposta": "Dalla Home premi la lente e inserisci almeno 2 caratteri. La ricerca controlla nome, referente, telefono, email, P.IVA e note."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come filtro i clienti per stato?",
    "cerca": "filtrare filtro clienti stato contattato brief lavorazione pubblicato",
    "risposta": "Nell’elenco completo premi un filtro di stato. Premilo di nuovo, oppure scegli “Tutti”, per rimuoverlo."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come ordino l’elenco clienti?",
    "cerca": "ordinare elenco clienti nome importo contatto recenti freccia",
    "risposta": "Nell’elenco completo scegli Nome, Importo, Prossimo contatto o Più recenti. Premi di nuovo per invertire l’ordine."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come contatto rapidamente un cliente?",
    "cerca": "contattare rapidamente chiamare whatsapp email cliente scheda",
    "risposta": "Apri la scheda cliente e usa Chiama, WhatsApp o Email. I pulsanti compaiono solo quando il relativo dato è presente."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come apro il sito di un cliente?",
    "cerca": "aprire sito web url cliente",
    "risposta": "Apri la scheda cliente e premi “Sito”, oppure espandi “Contatti” e premi “Apri il sito”."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come copio P.IVA o IBAN?",
    "cerca": "copiare partita iva piva iban cliente",
    "risposta": "Nella scheda cliente, se i dati sono presenti, trovi i comandi “Copia P.IVA” e “Copia IBAN”."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come mando il brief?",
    "cerca": "mandare inviare brief cliente modulo",
    "risposta": "Apri la scheda cliente e premi “Manda a brief”. Il modulo si apre in una nuova scheda."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come cambio lo stato di un cliente?",
    "cerca": "cambiare aggiornare stato fase cliente contattato brief lavorazione pubblicato",
    "risposta": "Nella scheda cliente espandi “Stato” e scegli la nuova fase. La Pipeline si aggiorna automaticamente."
  },
  {
    "categoria": "Clienti",
    "domanda": "Come aggiungo una nota?",
    "cerca": "aggiungere scrivere nota appunto commento cliente",
    "risposta": "Nella scheda cliente espandi “Note”, scrivi il testo e premi “Aggiungi nota”. Le note recenti appaiono per prime."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Che differenza c’è tra formula mensile e annuale?",
    "cerca": "differenza formula mensile annuale start setup prezzo",
    "risposta": "Start mensile costa 39 € al mese più 150 € di setup. Start annuale costa 468 € l’anno e include il setup."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Come aggiungo servizi extra all’offerta?",
    "cerca": "aggiungere servizi extra offerta upgrade modulo gallery chatbot",
    "risposta": "In “Offerta e servizi” seleziona gli upgrade desiderati. Riepilogo e prezzo si aggiornano subito."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Come imposto pagine o lingue extra?",
    "cerca": "impostare pagine lingue extra quantita multilingua",
    "risposta": "Usa meno e più accanto a Pagine extra e Multilingua. Sono previste fino a 15 pagine e 5 lingue extra."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Come aggiungo dominio e caselle email?",
    "cerca": "aggiungere dominio domini punto com caselle email posta",
    "risposta": "In “Dominio e posta” scegli “No, non ancora”, poi seleziona dominio .it, .com e/o 5 caselle email."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "A cosa serve il pacchetto sicurezza?",
    "cerca": "pacchetto sicurezza conservazione dati sospensione pagamenti",
    "risposta": "Con la formula mensile aggiunge la conservazione garantita per 12 mesi al costo una tantum mostrato nel riepilogo."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Come imposto la durata del contratto?",
    "cerca": "impostare durata contratto anni uno due tre quattro",
    "risposta": "In “Contratto e sconto” scegli da 1 a 4 anni. Il valore complessivo viene ricalcolato automaticamente."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Quali sconti posso applicare?",
    "cerca": "sconti applicare percentuale fisso prezzo concordato",
    "risposta": "Puoi scegliere sconto percentuale, fisso in euro o prezzo finale concordato. Inserisci il valore e controlla il riepilogo."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Come limito la durata di uno sconto?",
    "cerca": "limitare durata sconto primo anno anni sempre",
    "risposta": "Dopo aver impostato lo sconto scegli “Per sempre” oppure il numero di anni, senza superare la durata del contratto."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Cosa significa prezzo storico?",
    "cerca": "prezzo storico precedente personalizzato legacy catalogo attuale",
    "risposta": "È un prezzo precedente o personalizzato. Puoi mantenerlo oppure premere “Passa al catalogo attuale”."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Come viene calcolato il prossimo rinnovo?",
    "cerca": "calcolo prossimo rinnovo data attivazione mensile annuale",
    "risposta": "Inserisci la data di attivazione e scegli la formula. L’app calcola la prossima scadenza non ancora trascorsa."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Quali avvisi di rinnovo posso scegliere?",
    "cerca": "avvisi rinnovo mensilita annualita entrambe nessuno notifiche",
    "risposta": "Per un mensile puoi scegliere Nessuno, Mensilità, Annualità o Entrambe; per un annuale Nessuno o Rinnovo annuale."
  },
  {
    "categoria": "Offerte e rinnovi",
    "domanda": "Quanto prima posso ricevere un avviso?",
    "cerca": "anticipo preavviso avviso rinnovo giorni mese settimana",
    "risposta": "Quando gli avvisi sono attivi puoi scegliere 30, 7, 2 o 1 giorno prima della scadenza."
  },
  {
    "categoria": "Agenda e pipeline",
    "domanda": "A cosa serve la Pipeline?",
    "cerca": "pipeline serve fasi avanzamento clienti trattativa stato",
    "risposta": "Divide i clienti in Contattato, Brief mandato, In lavorazione e Pubblicato. Scorri le fasi e tocca un cliente per aprirlo."
  },
  {
    "categoria": "Agenda e pipeline",
    "domanda": "Posso cambiare stato direttamente dalla Pipeline?",
    "cerca": "cambiare stato direttamente pipeline menu selezione cliente",
    "risposta": "Sì. Nella card del cliente usa il menu dello stato: il cliente passa subito alla fase scelta."
  },
  {
    "categoria": "Agenda e pipeline",
    "domanda": "Come uso l’Agenda?",
    "cerca": "usare agenda appuntamenti attivita contatti rinnovi scadenze",
    "risposta": "Apri Agenda dalla barra in basso. Riunisce prossimi contatti e rinnovi; premi un’attività per aprire il cliente."
  },
  {
    "categoria": "Agenda e pipeline",
    "domanda": "Come cambio periodo nell’Agenda?",
    "cerca": "cambiare periodo agenda oggi sette giorni mese calendario giorno",
    "risposta": "Scegli Oggi, 7 giorni o Mese. Nella vista Mese puoi cambiare mese e selezionare un giorno."
  },
  {
    "categoria": "Agenda e pipeline",
    "domanda": "Dove vedo i contatti in ritardo?",
    "cerca": "contatti ritardo arretrati scaduti agenda clienti",
    "risposta": "Home ed elenco clienti segnalano i ritardi. Premi l’avviso per filtrarli; anche Agenda include gli arretrati."
  },
  {
    "categoria": "Agenda e pipeline",
    "domanda": "Dove vedo i rinnovi in scadenza?",
    "cerca": "rinnovi scadenza prossimi agenda home",
    "risposta": "I rinnovi vicini compaiono nella Home e nell’Agenda. Apri l’attività per entrare nella scheda cliente."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Come registro un pagamento?",
    "cerca": "registrare pagamento pagamenti incasso incassato vendita",
    "risposta": "Premi “Nuovo” e scegli “Registra pagamento”. Seleziona il cliente, verifica costi e quote, indica l’incasso e salva."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Posso registrare un pagamento dalla scheda cliente?",
    "cerca": "registrare pagamento dalla scheda cliente pacchetto residuo",
    "risposta": "Sì. Espandi “Pacchetto e pagamento” e premi “Registra pagamento”: il cliente sarà già selezionato."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Dove vedo totale, incassato e residuo?",
    "cerca": "totale incassato residuo cliente pagamento",
    "risposta": "Nella scheda cliente espandi “Pacchetto e pagamento”. In alto trovi Totale, Incassato, Residuo e stato."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Come registro un incasso parziale?",
    "cerca": "registrare incasso parziale importo data metodo note pagamento",
    "risposta": "In “Incasso cliente” scegli “Parziale”, inserisci importo, data ed eventuali metodo e note, poi salva."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Come registro un pagamento non ancora ricevuto?",
    "cerca": "registrare pagamento non ancora ricevuto previsto incasso",
    "risposta": "In “Incasso cliente” scegli “Non ancora”. Il pagamento viene registrato come previsto, senza importo incassato."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Come aggiungo o rimuovo un costo?",
    "cerca": "aggiungere rimuovere costo costi vendita pagamento",
    "risposta": "In “Costi” inserisci descrizione e importo e premi più. Per togliere una riga premi la ×."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Come funziona la ripartizione delle quote?",
    "cerca": "ripartizione quote partecipanti venditore referente collaboratore",
    "risposta": "Scegli chi ha venduto e come fattura ogni partecipante. L’app calcola quota teorica, rettifiche e quota finale."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Cosa significano Tutto, Misto e No nella fatturazione?",
    "cerca": "tutto misto no fatturazione fattura",
    "risposta": "Tutto è fatturazione completa, Misto permette di inserire la parte fatturata, No indica nessuna fattura."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Come modifico una quota storica?",
    "cerca": "modificare quota storica reale override ripristina automatico",
    "risposta": "Premi “Modifica” accanto a “Importo storico”, inserisci la quota reale; “Ripristina auto” torna al calcolo."
  },
  {
    "categoria": "Vendite e pagamenti",
    "domanda": "Dove vedo lo storico dei pagamenti?",
    "cerca": "storico pagamenti date importi cliente",
    "risposta": "Nella scheda cliente espandi “Pacchetto e pagamento”: sotto trovi importi, date e stato dei pagamenti."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come cambio username o foto profilo?",
    "cerca": "cambiare username foto avatar profilo immagine",
    "risposta": "Apri Profilo. Modifica lo username e salva; per la foto tocca l’avatar e scegli un’immagine JPG, PNG o WebP."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come ritaglio o rimuovo la foto profilo?",
    "cerca": "ritagliare spostare zoom rimuovere foto profilo inquadratura",
    "risposta": "In Profilo usa “Modifica inquadratura” per spostare e zoomare la foto, oppure “Rimuovi foto”."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come cambio il tema dell’app?",
    "cerca": "cambiare tema scuro chiaro dark light sistema aspetto app",
    "risposta": "In Profilo, sotto Tema, scegli Sistema, Chiaro o Scuro. La preferenza resta salvata sul dispositivo."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come attivo o disattivo le notifiche?",
    "cerca": "attivare disattivare notifiche push bloccate browser profilo",
    "risposta": "Apri Profilo e premi “Notifiche”. Se sono bloccate, riabilitale nelle impostazioni del sito o dispositivo."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come aggiorno l’app?",
    "cerca": "aggiornare aggiornamento nuova versione app pwa",
    "risposta": "Apri Profilo e premi “Aggiornamenti”. Se c’è una nuova versione usa “Aggiorna”."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come cambio account?",
    "cerca": "cambiare account personale admin amministratore collega profilo",
    "risposta": "Apri Profilo e premi “Account”. Puoi passare tra personale e admin; il collegamento admin richiede la password."
  },
  {
    "categoria": "Profilo e app",
    "domanda": "Come esco dall’account?",
    "cerca": "uscire logout disconnettere sessione account",
    "risposta": "Apri Profilo, entra in “Account” e usa “Esci da questo account”."
  },
  {
    "categoria": "Area admin",
    "domanda": "Cosa mostra la dashboard amministratore?",
    "cerca": "dashboard amministratore admin azienda venduto incassato residuo vendite clienti",
    "risposta": "Mostra venduto, media vendita, incassato, residuo, vendite attive, clienti, lavori in corso e pubblicati nel mese."
  },
  {
    "categoria": "Area admin",
    "domanda": "Come vedo i risultati di una persona?",
    "cerca": "risultati persona venditore collaboratore quote prodotta incassata residua admin",
    "risposta": "Nella dashboard admin cerca la persona. La card mostra vendite, quote prodotte, incassate e residue e avanzamento clienti."
  },
  {
    "categoria": "Area admin",
    "domanda": "Come apro i clienti di un venditore?",
    "cerca": "aprire clienti venditore persona admin elenco portafoglio",
    "risposta": "Premi la card della persona nella dashboard admin. Usa “Dashboard” in alto per tornare al riepilogo."
  },
  {
    "categoria": "Area admin",
    "domanda": "A cosa serve Agenda rete?",
    "cerca": "agenda rete admin amministratore attivita venditori rinnovi contatti",
    "risposta": "Riunisce contatti e rinnovi di tutti i venditori visibili all’amministratore e indica il venditore associato."
  }
];

function normalizzaTesto(testo = '') {
  return String(testo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function trovaRisposta(domanda, faq = FAQ_ASSISTENTE) {
  const domandaNormalizzata = normalizzaTesto(domanda);
  const corrispondenzaEsatta = faq.find(voce => normalizzaTesto(voce.domanda) === domandaNormalizzata);
  if (corrispondenzaEsatta) return corrispondenzaEsatta;

  const paroleComuni = new Set('come dove cosa quale quali quanto quando posso puoi vorrei devo fare per con una uno del della delle degli dei nel nella nelle sul sulla dalla dall dell all alla che'.split(' '));
  const parole = [...new Set(domandaNormalizzata.split(' ').filter(parola => parola.length > 2 && !paroleComuni.has(parola)))];
  let migliore = null;
  let primo = 0;
  let secondo = 0;

  for (const voce of faq) {
    const vocabolario = new Set(normalizzaTesto(`${voce.domanda} ${voce.cerca}`).split(' '));
    const punteggio = parole.reduce((totale, parola) => totale + (
      vocabolario.has(parola) ? 1 : [...vocabolario].some(candidata =>
        candidata.length >= 5 && parola.length >= 5 && candidata.slice(0, 5) === parola.slice(0, 5)
      ) ? 0.5 : 0
    ), 0);
    if (punteggio > primo) {
      secondo = primo;
      [migliore, primo] = [voce, punteggio];
    } else if (punteggio > secondo) secondo = punteggio;
  }

  // ponytail: ricerca lessicale; nei dubbi usa il fallback, ampliare i sinonimi per nuove formulazioni.
  return primo > secondo && primo > parole.length / 2 ? migliore : null;
}

const AssistenteLanding = {
  faq: FAQ_ASSISTENTE,
  rispondi(domanda) {
    return trovaRisposta(domanda)?.risposta || 'Non ho una risposta sicura per questo dubbio. Scrivi direttamente a Tomas e spiegagli cosa stavi cercando di fare.';
  }
};

globalThis.AssistenteLanding = AssistenteLanding;
if (typeof module !== 'undefined') module.exports = { FAQ_ASSISTENTE, normalizzaTesto, trovaRisposta, AssistenteLanding };
