"""Dati INVENTATI per gli screenshot della guida. Nessun dato reale."""
from datetime import date, timedelta
UID = '00000000-0000-4000-8000-000000000001'   # il venditore della demo (Lv2)
BOSS = '00000000-0000-4000-8000-000000000002'  # il suo responsabile (Lv1)
S1 = '00000000-0000-4000-8000-000000000003'    # sotto di lui (Lv3)
S2 = '00000000-0000-4000-8000-000000000004'
ADMIN = '00000000-0000-4000-8000-0000000000aa'
oggi = date(2026, 11, 3)
def gg(n): return (oggi + timedelta(days=n)).isoformat()
def ts(n, h=10): return gg(n) + 'T%02d:00:00+00:00' % h
def cid(n): return '10000000-0000-4000-8000-%012d' % n
def vid(n): return '20000000-0000-4000-8000-%012d' % n
def pid(n): return '30000000-0000-4000-8000-%012d' % n

def cliente(n, nome, ref, stato, pross, cre, **kw):
    d = {'id': cid(n), 'venditore_id': UID, 'nome': nome, 'referente': ref, 'telefono': '333 123 45%02d' % n,
         'email': ref.split()[0].lower() + '@esempio.it', 'piva': '0123456789%d' % n, 'iban': '', 'sito_url': '',
         'importo_abbonamento': 0, 'nome_pacchetto': 'Start annuale', 'note_prezzo': '', 'data_rinnovo': None,
         'stato': stato, 'prossimo_contatto': pross, 'creato_il': cre, 'pubblicato_il': None, 'cancellato_il': None}
    d.update(kw); return d

CLIENTI = [
  cliente(1, 'Pizzeria Da Rosa', 'Rosa Bellini', 'acquisito', ts(1, 15), ts(-9), importo_abbonamento=468, data_rinnovo=gg(340)),
  cliente(2, 'Studio Legale Neri', 'Paolo Neri', 'brief_mandato', ts(3, 11), ts(-12), importo_abbonamento=468),
  cliente(3, 'Fitness Box', 'Anna Colombo', 'completato', None, ts(-40), importo_abbonamento=468, data_rinnovo=gg(12)),
  cliente(4, 'Officina Verdi', 'Marco Verdi', 'contattato', ts(0, 17), ts(-2)),
  cliente(5, 'Bar Centrale', 'Elena Ricci', 'vinto', ts(5, 9), ts(-20), importo_abbonamento=39, nome_pacchetto='Start mensile', data_rinnovo=gg(8)),
  cliente(6, 'Dentista Sorrisi', 'Dott. Gatti', 'contattato', ts(-2, 10), ts(-6)),
]
VENDITE = []; VP = []; PAG = []; PP = []
def vendita(n, c, importo, servizio, creato):
    VENDITE.append({'id': vid(n), 'cliente_id': cid(c), 'venditore_id': UID, 'admin_id': ADMIN, 'creato_da': UID,
                    'servizio': servizio, 'descrizione': '', 'importo_vendita': importo, 'stato': 'attiva',
                    'creato_il': creato, 'data_vendita': creato[:10]})
    VP.append({'vendita_id': vid(n), 'profilo_id': UID, 'ruolo': 'venditore', 'fa_fattura': True,
               'modalita_fatturazione': 'tutto', 'importo_fatturato': importo, 'quota_base': round(importo*.35, 2),
               'quota_calcolata': round(importo*.35, 2), 'quota_effettiva': round(importo*.35, 2),
               'quota_finale': round(importo*.35, 2), 'quota_override': False, 'note_quota': '', 'saldato': False,
               'data_saldo': None})
vendita(1, 1, 1450, 'Sito Start + dominio', ts(-9))
vendita(2, 3, 1200, 'Sito Start annuale', ts(-40))
vendita(3, 5, 1830, 'Sito Pro + 4 pagine', ts(-20))
vendita(4, 2, 980, 'Sito Start', ts(-12))
def pag(n, v, imp, stato, scad, dp):
    PAG.append({'id': pid(n), 'vendita_id': vid(v), 'incassato_da': UID if stato == 'incassato' else None, 'creato_da': UID,
                'importo': imp, 'stato': stato, 'data_scadenza': scad, 'data_pagamento': dp, 'metodo': 'bonifico',
                'note': '', 'creato_il': ts(-9)})
    if stato == 'incassato':
        PP.append({'pagamenti': {'vendita_id': vid(v), 'stato': 'incassato', 'data_pagamento': dp}, 'pagamento_id': pid(n), 'profilo_id': UID, 'ruolo': 'venditore', 'quota_effettiva': round(imp*.35, 2),
                   'importo': round(imp*.35, 2), 'saldato': True, 'ricevuta_il': ts(-5)})
pag(1, 1, 700, 'incassato', gg(-9), gg(-9)); pag(2, 1, 750, 'previsto', gg(20), None)
pag(3, 2, 1200, 'incassato', gg(-40), gg(-38))
pag(4, 3, 900, 'incassato', gg(-20), gg(-19)); pag(5, 3, 930, 'previsto', gg(10), None)
pag(6, 4, 490, 'incassato', gg(-12), gg(-10)); pag(7, 4, 490, 'previsto', gg(18), None)

FIXTURES = {
  'tabelle': {
    'profili': [{'id': UID, 'nome': 'Marco Ferri', 'username': 'Marco', 'ruolo': 'venditore', 'avatar_url': '',
                 'codice_referente': 'MF01', 'ruolo_economico': 'collaboratore', 'responsabile_id': BOSS},
                {'id': ADMIN, 'nome': 'Alessandro', 'username': 'Alessandro', 'ruolo': 'admin', 'avatar_url': '',
                 'codice_referente': 'AL01', 'ruolo_economico': 'referente', 'responsabile_id': None}],
    'clienti': CLIENTI, 'vendite': VENDITE, 'vendita_partecipanti': VP, 'pagamenti': PAG,
    'pagamento_partecipanti': PP, 'costi_vendita': [], 'note': [], 'attivita_clienti': [],
  },
  'rpc': {
    'rete_vendita_albero': [
      {'id': BOSS, 'nome': 'Giulia Neri', 'responsabile_id': None, 'livello': 1},
      {'id': UID, 'nome': 'Marco Ferri', 'responsabile_id': BOSS, 'livello': 2},
      {'id': S1, 'nome': 'Sara Conti', 'responsabile_id': UID, 'livello': 3},
      {'id': S2, 'nome': 'Luca Bassi', 'responsabile_id': UID, 'livello': 3}],
    'venditori_team_corrente': [],
    'get_partecipanti_economici': [
      {'id': ADMIN, 'nome': 'Alessandro', 'ruolo': 'admin', 'ruolo_economico': 'referente', 'username': 'Alessandro'},
      {'id': '00000000-0000-4000-8000-0000000000bb', 'nome': 'Tomas', 'ruolo': 'developer', 'ruolo_economico': 'produzione', 'username': 'Tomas'},
      {'id': UID, 'nome': 'Marco Ferri', 'ruolo': 'venditore', 'ruolo_economico': 'collaboratore', 'username': 'Marco'}],
  }
}
