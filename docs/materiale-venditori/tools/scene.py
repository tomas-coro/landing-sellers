"""Scatta le schermate della guida in img/ e salva le posizioni dei pallini in img/pins.json.
Uso: python3 scene.py [nome ...]   (serve `python3 -m http.server 8878` nella cartella del progetto)
Ogni scena: js di apertura, testo da portare in vista (opzionale), pallini = [(testo/selettore, lato)]
lato: 'l' sinistra, 'r' destra, 't' sopra, 'c' centro dell'elemento."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from scatta import apri
from fixtures import FIXTURES, cid, S1
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img')
D = "Alpine.$data(document.getElementById('app'))"
T = lambda t: "text=" + t
SCENE = {
  '01-home': ("d.vaiHome()", None, [(T('Gestisci quote'), 'c'), (T('Vedi agenda'), 'c'), (T('Rete vendita'), 'l'), ('.mobile-tabbar-add', 'r'), ('.profile-trigger', 'l')]),
  '02-home-numeri': ("d.vaiHome()", 'Media vendita', [(T('Venduto'), 'l'), (T('Generato'), 'l'), (T('Incassato'), 'l'), (T('Media vendita'), 'l')]),
  '03-clienti': ("d.apriClienti()", None, [('input[type=search]', 'r'), (T('Tutta la rete'), 'c'), (T('Contattato'), 'l')]),
  '04-scheda': ("d.apriScheda('%s')" % cid(1), None, [(T('Pipeline commerciale'), 'l'), (T('Mandato brief'), 'c'), ('.profile-trigger', 'l')]),
  '05-agenda': ("d.apriAgenda()", None, [(T('Oggi'), 'c'), (T('Mese'), 'c'), (T('Dentista Sorrisi'), 'l')]),
  '06-pipeline': ("d.apriPipeline()", None, [(T('Fase corrente'), 'l')]),
  '07-menu-nuovo': ("d.vaiHome(); d.menuAzioneAperto = true", None, [(T('Nuovo cliente'), 'l'), (T('Registra vendita'), 'l'), (T('Incassa'), 'l')]),
  '08-profilo': ("d.apriProfilo()", None, [(T('Sistema'), 'c'), (T('Codice referente'), 'l')]),
  '09-rete': ("d.apriRete()", None, [(T('Aggiungi venditore'), 'c'), (T('Venduto di rete'), 'l'), (T('Generato'), 'l')]),
  '10-incassi': ("d.view='incassato'", None, [(T('La tua quota incassata'), 'l'), (T('Vendite'), 'c')]),
  '11-nuovo-cliente': ("d.vaiNuovoCliente()", None, []),
  '12-vendita': ("d.apriEconomia('vendita')", None, []),
  '13-incasso': ("d.apriEconomia('incasso')", None, []),
  '14-scheda-venditore': ("d.apriSchedaVenditore('%s')" % S1, None, []),
  '15-login': ("", None, []),
}
if __name__ == '__main__':
    want = sys.argv[1:] or list(SCENE)
    os.makedirs(OUT, exist_ok=True)
    pins = {}
    with sync_playwright() as p:
        b, pg, log, errs = apri(p, FIXTURES)
        pg.goto('http://localhost:8878/index.html'); pg.wait_for_timeout(3500)
        for n in want:
            js, vedi, pl = SCENE[n]
            try:
                if n == '15-login':   # senza sessione: schermata di accesso vera
                    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, locale='it-IT')
                    pg2 = ctx.new_page(); pg2.goto('http://localhost:8878/index.html'); pg2.wait_for_timeout(3000)
                    pg2.screenshot(path=os.path.join(OUT, n + '.png')); print('ok', n); ctx.close(); continue
                pg.evaluate("async()=>{const d=%s; d.menuAzioneAperto=false; %s; }" % (D, js)); pg.wait_for_timeout(1500)
                if vedi:
                    pg.locator(T(vedi)).filter(visible=True).first.scroll_into_view_if_needed(); pg.evaluate("()=>window.scrollBy(0,-60)")
                pg.wait_for_timeout(500)
                pg.screenshot(path=os.path.join(OUT, n + '.png'))
                lista = []
                for sel, lato in pl:
                    bb = pg.locator(sel).filter(visible=True).first.bounding_box()
                    if not bb: print('  manca', sel); continue
                    x = {'l': bb['x'], 'r': bb['x'] + bb['width'], 'c': bb['x'] + bb['width']/2, 't': bb['x'] + bb['width']/2}[lato]
                    y = bb['y'] if lato == 't' else bb['y'] + bb['height']/2
                    lista.append({'x': round(x/390*100, 2), 'y': round(y/844*100, 2), 'sel': sel})
                pins[n] = lista
                print('ok', n, pg.evaluate("()=>%s.view" % D), len(lista), 'pin')
            except Exception as e:
                print('ERR', n, str(e)[:140])
        b.close()
    pj = os.path.join(OUT, 'pins.json'); old = json.load(open(pj)) if os.path.exists(pj) else {}
    old.update(pins); json.dump(old, open(pj, 'w'), indent=1)
