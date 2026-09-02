// js/push.js
// Registrazione dispositivo per le push notification (solo app nativa
// iOS/Android via Capacitor). Su web/GitHub Pages questo modulo non fa
// nulla: window.Capacitor non esiste o isNativePlatform() torna false.
//
// Nessuna notifica viene inviata in questa fase: solo registrazione del
// token in Supabase (tabella push_devices). Qualsiasi errore qui non deve
// mai impedire login/uso dell'app: ogni funzione cattura i propri errori.

function pushDisponibile() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
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
    }
  } catch (errore) {
    console.warn('[push] errore salvataggio token, l\'app continua normalmente:', errore);
  }
}

async function disattivaDispositiviPush(userId) {
  if (!pushDisponibile()) return;
  try {
    await window.supabaseClient
      .from('push_devices')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch (errore) {
    console.warn('[push] impossibile disattivare i dispositivi push, si procede col logout:', errore);
  }
}
