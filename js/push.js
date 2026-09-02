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

async function registraDispositivoPush(userId) {
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
      await salvaTokenDispositivo(userId, token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] errore registrazione token:', err);
    });

    await PushNotifications.register();
  } catch (errore) {
    console.warn('[push] registrazione push fallita, l\'app continua normalmente:', errore);
  }
}

async function salvaTokenDispositivo(userId, token) {
  try {
    const piattaforma = window.Capacitor.getPlatform();
    if (piattaforma !== 'ios' && piattaforma !== 'android') return;

    const ora = new Date().toISOString();
    const { error } = await window.supabaseClient
      .from('push_devices')
      .upsert({
        user_id: userId,
        token,
        platform: piattaforma,
        updated_at: ora,
        last_seen_at: ora,
        active: true
      }, { onConflict: 'token' });

    if (error) {
      // Puo' succedere se il token esisteva gia' per un altro utente
      // (stesso dispositivo, login precedente diverso): la RLS nega
      // l'update perche' user_id non e' il proprietario del token.
      // Non e' un caso da gestire automaticamente in questa fase.
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
