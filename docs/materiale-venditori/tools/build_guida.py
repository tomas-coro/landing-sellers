"""Impagina la GUIDA ALL'APP (PDF 1 di 6) da screenshot veri + pallini numerati.
Uso: python3 tools/build_guida.py   ->  guida-app.html + ~/Downloads/materiale-venditori/01-guida-app.pdf
Regola: niente box-shadow/filter/rotate (vedi base.css)."""
import json, os, subprocess, html
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(QUI, '..')
IMG = os.path.join(ROOT, 'img')
WEB = os.path.join(ROOT, 'img-web')           # versioni leggere (800px) per tenere piccolo il PDF
OUT_PDF = os.path.expanduser('~/Downloads/materiale-venditori/01-guida-app.pdf')
BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
PINS = json.load(open(os.path.join(IMG, 'pins.json')))

def leggero(nome):
    os.makedirs(WEB, exist_ok=True)
    dst = os.path.join(WEB, nome + '.jpg')
    im = Image.open(os.path.join(IMG, nome + '.png')).convert('RGB')
    im = im.resize((800, round(im.height * 800 / im.width)), Image.LANCZOS)
    im.save(dst, quality=88)
    return 'img-web/' + nome + '.jpg'

def pins_da_json(nome, idx=None):
    p = PINS[nome]
    return [(q['x'], q['y']) for i, q in enumerate(p) if idx is None or i in idx]

# ogni pagina: titolo, intro, schermate [(img, [(x%,y%)])], passi [(titolo, testo)], nota opzionale
PAGINE = []
def pagina(sezione, titolo, intro, schermate, passi, nota=None):
    PAGINE.append(dict(sezione=sezione, titolo=titolo, intro=intro, schermate=schermate, passi=passi, nota=nota))

pagina('Per cominciare', "Entra nell'app",
  "L'app si apre da un link, come un sito. Una volta entrato, resti collegato: non devi rifare l'accesso ogni volta.",
  [('15-login', [(4.3, 47.6), (4.3, 58.4), (44, 68.8), (4.3, 75)])],
  [("Email", "Scrivi l'email con cui Alessandro ti ha creato l'accesso."),
   ("Password", "Scrivi la tua password. L'occhio a destra ti fa vedere cosa stai scrivendo."),
   ("Password dimenticata?", "Se non la ricordi, tocca questa scritta per sceglierne una nuova."),
   ("Entra", "Tocca il pulsante nero: si apre la tua Home.")],
  ("Consiglio", "Aggiungi l'app alla schermata del telefono: la trovi accanto alle altre app, senza cercare il link. Come fare è spiegato nella guida all'installazione, in questo stesso pacchetto."))

pagina('La base', "La Home: da qui parti sempre",
  "Appena entri vedi cosa c'è da fare oggi. La barra in basso ti porta nelle cinque aree dell'app.",
  [('01-home', [(4.3, 33), (4.3, 44.8), (4.3, 70.8), (57, 94.3), (92, 9.6)])],
  [("Gestisci quote", "Il riquadro nero ti dice quante azioni hai in sospeso sulle tue quote (da confermare, da trasferire). Il pulsante verde le apre."),
   ("Vedi agenda", "Le attività di oggi: richiami, appuntamenti, cose in ritardo. Accanto a ognuna trovi «Fatto»."),
   ("Rete vendita", "Il tuo lavoro in numeri: quanti clienti segui e quanti sono già pubblicati."),
   ("Nuovo", "Il + verde al centro è il tasto principale: da qui aggiungi clienti, registri vendite e incassi."),
   ("Il tuo profilo", "La tua iniziale in alto a destra apre il profilo e le impostazioni.")])

pagina('La base', "I tuoi numeri",
  "Scorrendo la Home trovi quattro numeri. Ti dicono a che punto sei, senza fare conti.",
  [('02-home-numeri', [(3.6, 34.5), (51.2, 34.5), (3.6, 50), (51.2, 50)])],
  [("Venduto", "Quanto hai venduto in tutto. Sotto vedi di quanto è di rete e di quanto è tuo diretto."),
   ("Generato", "La quota che hai maturato: è la cifra che ti spetta."),
   ("Incassato", "La quota che ti è già arrivata, dall'inizio dell'anno."),
   ("Media vendita", "Il valore medio di un contratto. Serve a capire se stai vendendo bene, non solo tanto.")],
  ("Generato e Incassato", "Non sono la stessa cosa: «Generato» è la quota maturata, «Incassato» è quella che ti è già arrivata."))

pagina('Cosa puoi fare', "Il tasto Nuovo",
  "Tre azioni da un solo posto. Tocca il + verde al centro della barra in basso.",
  [('07-menu-nuovo', [(3.6, 71.5), (3.6, 79.7), (3.6, 87.6)])],
  [("Nuovo cliente", "Aggiungi una nuova anagrafica: il cliente entra nella tua lista."),
   ("Registra vendita", "Per un cliente già in lista: scegli cosa vende, il prezzo e la durata del contratto."),
   ("Incassa", "Quando arriva un pagamento sulla vendita, segnalo qui.")],
  ("Ordine giusto", "Prima il cliente, poi la vendita, poi gli incassi. Il cliente puoi crearlo anche mentre registri la vendita, ma controlla prima in Clienti che non esista già."))

pagina('Cosa puoi fare', "Aggiungi un cliente",
  "Bastano pochi dati per cominciare. Il resto lo puoi completare dopo, dalla scheda del cliente.",
  [('11-nuovo-cliente', [(90, 21.6), (3.6, 62.2)])],
  [("Dati cliente", "Compila nome, referente, telefono, email e gli altri campi. Solo «Nome» è obbligatorio (ha l'asterisco)."),
   ("Salva cliente", "Tocca il pulsante nero. Dopo il salvataggio si apre subito la scheda del cliente.")],
  ("Cerca prima", "Prima di crearne uno nuovo scrivi il nome in Clienti: un cliente doppio poi va sistemato a mano."))

pagina('Cosa puoi fare', "I clienti e la loro scheda",
  "Clienti è l'elenco di tutti quelli che segui. Toccandone uno si apre la sua scheda, con tutta la storia.",
  [('03-clienti', [(4.3, 24), (4.3, 30.8), (3.6, 52.9)]), ('04-scheda', [(3.6, 36.5), (3.6, 50.5)])],
  [("Diretti o rete", "«I miei diretti» sono i tuoi clienti. «Tutta la rete» include anche quelli dei venditori sotto di te."),
   ("Cerca", "Scrivi il nome per trovare subito un cliente."),
   ("Le fasi", "I clienti sono raggruppati per fase (Contattato, Acquisito, Mandato brief...). Accanto vedi quanti sono e il valore."),
   ("Il percorso", "Nella scheda, in alto, la linea mostra le tappe del cliente. Il cerchio pieno è dove si trova ora."),
   ("Pipeline commerciale", "Tocca la fase giusta per aggiornarla. Quella scura è la fase attuale: tenerla aggiornata mantiene precisa la tua Home.")])

pagina('Cosa puoi fare', "L'agenda",
  "Tutto ciò che devi fare, per giorno. Se qualcosa è in ritardo lo vedi subito.",
  [('05-agenda', [(4.3, 20.3), (4.3, 32.9), (3.6, 43)])],
  [("Da fare oggi", "Il riquadro nero conta le attività di oggi, compresi i contatti in ritardo."),
   ("Oggi, Non completate, Mese", "Tre viste: la giornata, quello che è rimasto indietro, il calendario del mese per guardare avanti."),
   ("Un'attività", "Tocca «Fatto» quando l'hai completata.")],
  ("Un'abitudine che paga", "Apri l'agenda ogni mattina: è il modo più veloce per non dimenticare un richiamo."))

pagina('Vendite e incassi', "Registra una vendita",
  "Quattro tappe, nell'ordine: Cliente, Offerta, Ripartizione, Incasso. L'app ti guida e calcola i totali.",
  [('12-vendita-1', [(3.6, 13.9), (90, 22.5), (90, 45)]), ('12-vendita-3', [(4.3, 46), (4.3, 75.7)])],
  [("Le tappe", "In alto vedi a che punto sei. Il segno di spunta indica le tappe completate."),
   ("Cliente", "Scegli il cliente a cui vendi. «Cambia cliente» ne sceglie un altro."),
   ("Cosa stai vendendo", "Configura sito, servizi e durata. Sotto compaiono il prezzo configurato (per esempio 39,00 € al mese) e il valore del contratto."),
   ("Servizi extra", "Con + e - aggiungi pagine extra, lingue e altri servizi: il totale si aggiorna da solo."),
   ("Durata", "Imposta la durata del contratto (per esempio 1 anno). A salvataggio fatto compare una conferma.")])

pagina('Vendite e incassi', "Segna un incasso",
  "Quando il cliente paga, registralo qui. Così il tuo «Incassato» resta sempre vero.",
  [('13-incasso-a', [(4.3, 3.3), (4.3, 37.1)]), ('13-incasso-b', [(4.3, 32.3), (4.3, 52.3), (4.3, 86.5)])],
  [("Rate", "In alto trovi le rate in attesa, con importo e scadenza, e sotto quelle già incassate."),
   ("Nuovo movimento", "«Incassa ora» per un pagamento già ricevuto, «Pianifica rata» per segnare importo e scadenza di uno che aspetti."),
   ("Importo e data", "Scrivi quanto e quando. «Usa tutto il residuo» compila l'importo con quanto manca."),
   ("Metodo e note", "Scegli come ha pagato (per esempio bonifico) e aggiungi una nota se serve."),
   ("Incassa", "Tocca il pulsante nero in fondo: compare lo scontrino del pagamento.")])

pagina('La tua squadra', "Rete e profilo",
  "Se hai venditori sotto di te, li gestisci dalla Rete. Dal Profilo regoli l'app come preferisci.",
  [('09-rete', [(3.6, 19.1), (3.6, 32.6), (3.6, 47.9)]), ('08-profilo', [(92, 31.4), (4.3, 50.3)])],
  [("Aggiungi venditore", "Crei un nuovo venditore nella tua rete (se il tuo livello lo permette)."),
   ("Venduto di rete", "Il totale venduto da te e dalla tua squadra, con la parte diretta e quella di team."),
   ("Generato", "La quota maturata dalla rete e quanto ne è stato incassato."),
   ("Codice referente", "Il tuo codice personale, visibile nel profilo."),
   ("Tema", "Scegli Sistema, Chiaro o Scuro: l'app si adatta al tuo telefono.")])

def blocco_pagina(n, p):
    pin_n = 0; shots = []
    for img, pl in p['schermate']:
        pins = ''
        for x, y in pl:
            pin_n += 1
            pins += '<span class="pin" style="left:%s%%;top:%s%%">%d</span>' % (x, y, pin_n)
        shots.append('<div class="shot">%s<img src="%s" alt="">%s</div>' % ('', leggero(img), pins))
    due = len(shots) > 1
    steps = ''.join('<li><div><b>%s</b>%s</div></li>' % (html.escape(t), html.escape(d)) for t, d in p['passi'])
    nota = ''
    if p['nota']:
        nota = '<div class="box tip after"><b class="k">%s</b>%s</div>' % (html.escape(p['nota'][0]), html.escape(p['nota'][1]))
    if due:
        corpo = '<div class="screens two">%s</div><ol class="steps cols">%s</ol>' % (''.join(shots), steps)
    else:
        corpo = '<div class="body-one"><div class="screens one">%s</div><ol class="steps">%s</ol></div>' % (shots[0], steps)
    return '''<section class="page">
  <div class="run"><span><i class="dot"></i>Guida all'app</span><span>%s</span></div>
  <div class="eyebrow">%s</div><h1 class="title">%s</h1><p class="lead">%s</p>
  %s%s
  <div class="foot"><span><b>Landing Evolution</b> · Guida all'app</span><span>%d</span></div>
</section>''' % (html.escape(p['sezione']), html.escape(p['sezione']), html.escape(p['titolo']), html.escape(p['intro']), corpo, nota, n)

COVER = '''<section class="page cover">
  <div class="stripe"></div>
  <div class="inner">
    <div class="brand"><i></i>LANDING EVOLUTION</div>
    <div class="kicker">Guida all'app venditori</div>
    <h1>La tua app, <em>passo dopo passo.</em></h1>
    <p class="tagline">Come entrare, aggiungere clienti, registrare vendite e incassi. Con le schermate vere dell'app.</p>
    <div class="meta"><span>Novembre 2026</span><span>Per i venditori</span></div>
    <div class="shot peek"><img src="%s" alt=""></div>
  </div>
</section>''' % leggero('01-home')

CONTATTI = '''<section class="page">
  <div class="run"><span><i class="dot"></i>Guida all'app</span><span>Aiuto</span></div>
  <div class="eyebrow">Se ti blocchi</div><h1 class="title">I cinque gesti da ricordare</h1>
  <p class="lead">Se ti perdi, torna qui. Con questi cinque gesti fai quasi tutto.</p>
  <ol class="steps">
    <li><div><b>Apri l'agenda ogni mattina</b>Vedi cosa c'è da fare oggi e cosa è rimasto indietro.</div></li>
    <li><div><b>Cliente nuovo: tasto + e «Nuovo cliente»</b>Cerca sempre prima il nome in Clienti, per non farlo doppio.</div></li>
    <li><div><b>Aggiorna la fase del cliente</b>Dalla scheda: così la Home resta precisa.</div></li>
    <li><div><b>Vendita chiusa: «Registra vendita»</b>Scegli cliente, pacchetto, prezzo e durata.</div></li>
    <li><div><b>Pagamento ricevuto: «Incassa»</b>Così «Incassato» corrisponde a quello che hai davvero ricevuto.</div></li>
  </ol>
  <div class="box help after"><b class="k">Hai bisogno di aiuto?</b>Per qualsiasi dubbio o problema con l'app scrivi ad Alessandro, il tuo referente.</div>
  <div class="foot"><span><b>Landing Evolution</b> · Guida all'app</span><span>%d</span></div>
</section>'''

def main():
    corpo = COVER + ''.join(blocco_pagina(i + 2, p) for i, p in enumerate(PAGINE))
    corpo += CONTATTI % (len(PAGINE) + 2)
    doc = '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Guida all\'app - Landing Evolution</title><link rel="stylesheet" href="base.css"></head><body>%s</body></html>' % corpo
    path = os.path.abspath(os.path.join(ROOT, 'guida-app.html'))
    open(path, 'w').write(doc)
    os.makedirs(os.path.dirname(OUT_PDF), exist_ok=True)
    subprocess.run([BRAVE, '--headless=new', '--no-pdf-header-footer', '--print-to-pdf=' + OUT_PDF, 'file://' + path], check=True, capture_output=True, timeout=120)
    print('ok', OUT_PDF, os.path.getsize(OUT_PDF) // 1024, 'KB')

main()
