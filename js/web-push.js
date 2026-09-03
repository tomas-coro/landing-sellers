// js/web-push.js
// Web Push standard (VAPID), non Capacitor/nativo. Nessuna chiave privata
// qui: solo la VAPID public key (VAPID_PUBLIC_KEY in config.js), che per
// definizione puo' stare nel client.
//
// Stati possibili di una subscription per l'utente corrente:
//  - 'non-supportato' : browser senza Push API / Notification API
//  - 'bloccato'        : Notification.permission === 'denied'
//  - 'attivo'           : esiste gia' una PushSubscription per questo browser
//  - 'inattivo'         : supportato ma nessuna subscription attiva
window.WebPush = (function () {

  function isSupported() {
    return 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
  }

  // iOS/iPadOS: Safari espone Push API solo se la PWA e' stata aggiunta
  // alla schermata Home (modalita' standalone). navigator.standalone e'
  // l'unico modo per saperlo su iOS, matchMedia copre gli altri browser.
  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  // Converte la VAPID public key (base64url, come restituita da
  // generateVapidKeys/exportApplicationServerKey) nel formato Uint8Array
  // richiesto da pushManager.subscribe({ applicationServerKey }).
  function urlBase64ToUint8Array(base64Url) {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  async function registraSottoscrizione(subscription) {
    const json = subscription.toJSON();
    const { error } = await window.supabaseClient.rpc('register_web_push_subscription', {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth
    });
    if (error) throw error;
  }

  async function statoAttuale() {
    if (!isSupported()) return 'non-supportato';
    if (Notification.permission === 'denied') return 'bloccato';
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'inattivo';
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return 'inattivo';

    // Dopo un logout la subscription browser resta valida, ma sul DB viene
    // marcata active=false. Al login la ri-registriamo senza nuovo prompt:
    // la RPC la riattiva e gestisce anche il cambio utente sullo stesso device.
    if (Notification.permission === 'granted') {
      await registraSottoscrizione(sub);
    }
    return 'attivo';
  }

  // Avvia il flusso completo: richiesta permesso -> subscribe -> registrazione
  // su Supabase. Va chiamata SOLO da un click esplicito dell'utente, mai al
  // caricamento della pagina.
  async function attiva() {
    if (!isSupported()) {
      throw new Error('Le notifiche push non sono supportate da questo browser.');
    }
    if (isIOS() && !isStandalone()) {
      throw new Error(
        'Su iPhone/iPad le notifiche funzionano solo dopo aver aggiunto ' +
        'questa app alla schermata Home (Condividi -> Aggiungi a Home).'
      );
    }
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key non configurata (VAPID_PUBLIC_KEY in config.js).');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission; // 'denied' | 'default'

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    await registraSottoscrizione(sub);
    return 'granted';
  }

  // Disattiva realmente le notifiche su questo browser/device:
  // 1. marca la subscription inattiva su Supabase
  // 2. rimuove la PushSubscription dal browser.
  // Il permesso Notification resta invariato; una futura riattivazione
  // potra' creare una nuova subscription senza modificare i permessi browser.
  async function disattivaSottoscrizioneCorrente() {
    if (!isSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const { error } = await window.supabaseClient
      .from('web_push_subscriptions')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('endpoint', sub.endpoint);

    if (error) throw error;

    const rimossa = await sub.unsubscribe();
    if (!rimossa) {
      throw new Error('Impossibile disattivare la subscription push del browser.');
    }
  }

  return {
    isSupported,
    isIOS,
    isStandalone,
    statoAttuale,
    attiva,
    disattivaSottoscrizioneCorrente
  };
})();
