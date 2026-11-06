"""Scatta 'Incassa' a tre altezze di scroll (13-incasso-a/b/c) con dati finti."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from scatta import apri
from fixtures import FIXTURES
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img')
D = "Alpine.$data(document.getElementById('app'))"
with sync_playwright() as p:
    b, pg, log, errs = apri(p, FIXTURES)
    pg.goto('http://localhost:8878/index.html'); pg.wait_for_timeout(3500)
    pg.evaluate("()=>{const d=%s; d.apriEconomia('incasso'); }" % D); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{const d=%s; d.selezionaClienteEconomia(d.clienti[0]); }" % D); pg.wait_for_timeout(2000)
    for nome, dy in [('a', 0), ('b', 430), ('c', 480)]:
        pg.mouse.move(200, 300); pg.mouse.wheel(0, dy); pg.wait_for_timeout(800)
        pg.screenshot(path=OUT + '/13-incasso-%s.png' % nome)
    print(errs[:2]); b.close()
