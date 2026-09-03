// supabase/functions/send-web-push/index.ts
//
// Invia una push Web Push (RFC 8030 + VAPID/RFC 8292) a tutte le
// subscription ATTIVE di un utente. Nessun trigger automatico collegato:
// questa e' solo la funzione di invio, va chiamata esplicitamente.
//
// Sicurezza (vedi anche audit fase precedente):
// - Invocabile SOLO con un token il cui claim "role" e' "service_role".
//   Un venditore autenticato con la sua sessione normale (role=authenticated)
//   riceve 403: non puo' usare questo endpoint per mandare notifiche
//   arbitrarie a se stesso o ad altri.
// - Legge le subscription con la service role key (bypassa RLS per design,
//   e' l'unico modo per un servizio server-to-server di leggere le
//   subscription di QUALSIASI utente), ma filtra sempre active=eq.true:
//   una subscription disattivata (logout) non riceve mai push.
// - Nessun log contiene la private key VAPID, p256dh, auth o l'endpoint
//   completo (che e' di fatto un url-capability segreto): si logga solo
//   l'id della subscription e l'host del push service (es. fcm.googleapis.com).
import * as webpush from "@negrel/webpush";

const VAPID_KEYS_JWK = Deno.env.get("VAPID_KEYS_JWK");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function hasServiceRoleCredential(authHeader: string | null): boolean {
  if (!SERVICE_ROLE_KEY || !authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice("Bearer ".length) === SERVICE_ROLE_KEY;
}

async function deactivateSubscription(id: string): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/web_push_subscriptions?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`disattivazione subscription fallita: HTTP ${res.status}`);
  }
}

async function fetchActiveSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/web_push_subscriptions` +
    `?user_id=eq.${encodeURIComponent(userId)}&active=eq.true` +
    `&select=id,endpoint,p256dh,auth`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`lettura subscription fallita: HTTP ${res.status}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  // Solo chiamate server-to-server con la service role key: nessun venditore
  // puo' invocare questa funzione con la propria sessione normale.
  if (!hasServiceRoleCredential(req.headers.get("authorization"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  if (!VAPID_KEYS_JWK || !VAPID_SUBJECT || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("configurazione mancante: verificare i secret della function");
    return new Response(JSON.stringify({ error: "server misconfigured" }), { status: 500 });
  }

  let body: { user_id?: string; title?: string; message?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON non valido" }), { status: 400 });
  }

  const { user_id, title, message } = body;
  if (!user_id || !title || !message) {
    return new Response(
      JSON.stringify({ error: "user_id, title e message sono obbligatori" }),
      { status: 400 },
    );
  }

  let subscriptions: SubscriptionRow[];
  try {
    subscriptions = await fetchActiveSubscriptions(user_id);
  } catch (err) {
    console.error("errore lettura subscription attive:", String(err));
    return new Response(JSON.stringify({ error: "query failed" }), { status: 500 });
  }

  if (subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0, results: [] }), {
      headers: { "content-type": "application/json" },
    });
  }

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(VAPID_KEYS_JWK), {
    extractable: false,
  });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: VAPID_SUBJECT,
    vapidKeys,
  });

  const payload = JSON.stringify({
    title,
    body: message,
    url: body.url || "./",
  });

  const results = await Promise.all(subscriptions.map(async (sub) => {
    let host = "endpoint-non-valido";
    try {
      host = new URL(sub.endpoint).host;
      const subscriber = appServer.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      });
      await subscriber.pushTextMessage(payload, {});
      console.log(`push ok: subscription=${sub.id} host=${host}`);
      return { id: sub.id, ok: true };
    } catch (err) {
      let gone = false;
      if (err instanceof webpush.PushMessageError && err.isGone()) {
        gone = true;
        try {
          await deactivateSubscription(sub.id);
          console.warn(`subscription scaduta disattivata: subscription=${sub.id} host=${host}`);
        } catch (cleanupErr) {
          console.error(`cleanup subscription fallito: subscription=${sub.id} - ${String(cleanupErr)}`);
        }
      }
      console.error(`push fallita: subscription=${sub.id} host=${host} - ${String(err)}`);
      return { id: sub.id, ok: false, gone };
    }
  }));

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { "content-type": "application/json" },
  });
});
