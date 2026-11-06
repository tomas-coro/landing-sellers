"""Screenshot dell'app VERA con dati finti.
L'app gira da http://localhost:8878; le chiamate a Supabase vengono intercettate
(nessun dato reale esce o entra) e rispondono con i dati inventati di fixtures.py.
Uso: python3 scatta.py <cartella_output> [probe]"""
import sys, json, time, re
from playwright.sync_api import sync_playwright

REF = 'mptbmhqnsvpiflzjzbea'
UID = '00000000-0000-4000-8000-000000000001'
BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"

def sessione_finta():
    t = int(time.time()) + 36000
    user = {"id": UID, "aud": "authenticated", "role": "authenticated",
            "email": "demo@example.com", "app_metadata": {}, "user_metadata": {},
            "created_at": "2026-01-01T00:00:00Z"}
    return {"access_token": "fake.jwt.token", "token_type": "bearer", "expires_in": 36000,
            "expires_at": t, "refresh_token": "fake", "user": user}, user

def rispondi(route, fixtures, log):
    req = route.request
    url = req.url
    m = re.search(r'/rest/v1/([a-z_]+)', url)
    r = re.search(r'/rpc/([a-z_]+)', url)
    if '/auth/v1/user' in url:
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(sessione_finta()[1]))
    if '/auth/v1/' in url:
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(sessione_finta()[0]))
    if '/functions/v1/' in url or '/storage/v1/' in url:
        return route.fulfill(status=200, content_type='application/json', body='{}')
    if r:
        nome = r.group(1); log.add('rpc:' + nome)
        dati = fixtures['rpc'].get(nome, [])
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(dati))
    if m:
        tab = m.group(1); log.add(tab)
        dati = fixtures['tabelle'].get(tab, [])
        # filtri semplici della query (col=eq.valore / col=in.(a,b)) cosi' le ricerche per id o ruolo rispondono giuste
        from urllib.parse import urlparse, parse_qsl
        for col, val in parse_qsl(urlparse(url).query):
            if val.startswith('eq.') and dati and col in dati[0]:
                dati = [r for r in dati if str(r.get(col)) == val[3:]]
            elif val.startswith('in.(') and dati and col in dati[0]:
                ok = [x.strip('"') for x in val[4:-1].split(',')]
                dati = [r for r in dati if str(r.get(col)) in ok]
        accept = req.headers.get('accept', '')
        if 'vnd.pgrst.object' in accept:
            dati = dati[0] if dati else None
            if dati is None:
                return route.fulfill(status=406, content_type='application/json', body='{"message":"no rows"}')
        if req.method in ('POST', 'PATCH', 'DELETE'):
            return route.fulfill(status=201, content_type='application/json', body=json.dumps(dati))
        return route.fulfill(status=200, content_type='application/json',
                             headers={'content-range': '0-%d/%d' % (max(len(dati)-1, 0), len(dati)) if isinstance(dati, list) else '0-0/1'},
                             body=json.dumps(dati))
    route.fulfill(status=200, content_type='application/json', body='{}')

def apri(p, fixtures, w=390, h=844):
    b = p.chromium.launch(executable_path=BRAVE, headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='it-IT')
    sess, _ = sessione_finta()
    ctx.add_init_script("localStorage.setItem('sb-%s-auth-token', %s); localStorage.setItem('le-active-account-slot','personale');" % (REF, json.dumps(json.dumps(sess))))
    log = set()
    ctx.route('**/*.supabase.co/**', lambda route: rispondi(route, fixtures, log))
    ctx.route('**/fonts.googleapis.com/**', lambda r: r.continue_())
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    return b, pg, log, errs

if __name__ == '__main__':
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    from fixtures import FIXTURES
    out = sys.argv[1]
    with sync_playwright() as p:
        b, pg, log, errs = apri(p, FIXTURES)
        pg.goto('http://localhost:8878/index.html'); pg.wait_for_timeout(3500)
        print(pg.evaluate("()=>{const d=Alpine.$data(document.getElementById('app'));return d.view+' | '+d.profilo.nome}"))
        print(sorted(log)); print(errs[:4])
        pg.screenshot(path=out + '/probe.png')
        b.close()
