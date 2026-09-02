// js/push.js
// Registrazione dispositivo per le push notification (solo app nativa
// iOS/Android via Capacitor). Su web/GitHub Pages questo modulo non fa
// nulla: window.Capacitor non esiste o isNativePlatform() torna false.
//
// Nessuna notifica viene inviata in questa fase: solo registrazione del
// token in Supabase (tabella push_devices). Qualsiasi errore qui non deve
// mai impedire login/uso dell'app: ogni funzione cattura i propri errori.

// Il token push del dispositivo corrente viene tenuto anche in
// localStorage: non e' un dato sensibile (di per se' non autentica
// nessuno, serve solo a instradare una notifica) ed e' persistente nella
// WebView di Capacitor, che e' tutto cio' che serve per sapere, al
// logout, QUALE riga di push_devices disattivare senza toccare gli altri
// dispositivi dello stesso utente.
const CHIAVE_TOKEN_PUSH_LOCALE = 'push_token_dispositivo';

function pushDisponibile() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function salvaTokenPushLocale(token) {
  try {
    window.localStorage.setItem(CHIAVE_TOKEN_PUSH_LOCALE, token);
  } catch (errore) {
    console.warn('[push] impossibile salvare il token in locale:', errore);
  }
}

function leggiTokenPushLocale() {
  try {
    return window.localStorage.getItem(CHIAVE_TOKEN_PUSH_LOCALE);
  } catch (errore) {
    console.warn('[push] impossibile leggere il token locale:', errore);
    return null;
  }
}

function rimuoviTokenPushLocale() {
  try {
    window.localStorage.removeItem(CHIAVE_TOKEN_PUSH_LOCALE);
  } catch (errore) {
    console.warn('[push] impossibile rimuovere il token locale:', errore);
  }
}

async function registraDispositivoPush() {
  if (!pushDisponibile()) return;

  const PushNotifications = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
  if (!PushNotifications) {
    console.warn('[push] plugin PushNotifications non disponibile');
    return;
  }

  try {
    const permessoAttuale = await PushNotifications.checkPermissions();
    let stato = permessoAttuale.receive;
    if (stato === 'prompt' || stato === 'prompt-with-rationale') {
      const richiesto = await PushNotifications.requestPermissions();
      stato = richiesto.receive;
    }
    if (stato !== 'granted') {
      console.warn('[push] permesso notifiche negato dall\'utente');
      return;
    }

    PushNotifications.addListener('registration', async (token) => {
      await salvaTokenDispositivo(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] errore registrazione token:', err);
    });

    await PushNotifications.register();
  } catch (errore) {
    console.warn('[push] registrazione push fallita, l\'app continua normalmente:', errore);
  }
}

async function salvaTokenDispositivo(token) {
  try {
    const piattaforma = window.Capacitor.getPlatform();
    if (piattaforma !== 'ios' && piattaforma !== 'android') return;

    // Passa dalla RPC register_push_device invece di un upsert diretto
    // sulla tabella: la RPC ricava l'utente da auth.uid() lato server e
    // riassegna in sicurezza il token se apparteneva a un altro utente
    // sullo stesso dispositivo (es. A fa logout, B fa login). Nessun
    // user_id viene passato dal client: la RPC non lo accetta.
    const { error } = await window.supabaseClient.rpc('register_push_device', {
      p_token: token,
      p_platform: piattaforma
    });

    if (error) {
      console.warn('[push] impossibile salvare il token dispositivo:', error.message);
      return;
    }

    // Sovrascrive sempre la chiave: se il token e' cambiato (rotazione),
    // il dispositivo corrente ricorda solo l'ultimo. Nessun duplicato in
    // locale per costruzione (una sola chiave).
    salvaTokenPushLocale(token);
  } catch (errore) {
    console.warn('[push] errore salvataggio token, l\'app continua normalmente:', errore);
  }
}

async function disattivaDispositiviPush(userId) {
  if (!pushDisponibile()) return;

  const tokenLocale = leggiTokenPushLocale();
  if (!tokenLocale) return;

  try {
    // Disattiva SOLO la riga del token di questo dispositivo, non tutte
    // le righe dell'utente: A puo' avere altri device (Android, un altro
    // iPhone) che devono continuare a ricevere notifiche dopo questo
    // logout. La RLS (user_id = auth.uid()) resta comunque a protezione
    // di questo update diretto.
    const { error } = await window.supabaseClient
      .from('push_devices')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('token', tokenLocale)
      .eq('user_id', userId);

    if (error) {
      console.warn('[push] impossibile disattivare il dispositivo push corrente:', error.message);
    }
  } catch (errore) {
    console.warn('[push] impossibile disattivare il dispositivo push corrente, si procede col logout:', errore);
  }
}
