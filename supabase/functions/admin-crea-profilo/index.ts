// supabase/functions/admin-crea-profilo/index.ts
//
// Crea un venditore SOTTO chi lo invita e gli spedisce la mail per scegliere la
// password. Due azioni:
//   - "invita" (default): { nome, email, responsabile_id?, redirect_to? }
//   - "reinvia": { profilo_id, redirect_to? }  (solo se non e' mai entrato)
//
// Regole (vedi regole.ts): si crea solo il livello immediatamente sotto il
// proprio, tetto lv3. Il developer/admin (Tomas) sceglie lui il responsabile.
//
// Perche' una Edge Function: creare un utente richiede scrivere su auth.users,
// possibile solo con la service_role key, che non puo' girare lato client
// (repo pubblica). Il controllo "chi puo' creare chi" vive qui, non nel browser:
// la UI in js/app-rete.js nasconde solo il pulsante.
//
// Accesso: l'utente nasce con email gia' confermata e una password casuale che
// nessuno conosce; poi parte la mail di "imposta password" (stesso canale SMTP
// e stessa schermata del recupero password). Il ruolo e' sempre 'venditore'
// (lo assegna il trigger on_auth_user_created): non e' un parametro.
import { puoReinviare, responsabileDelNuovo, ruoloPrivilegiato } from "./regole.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

const headerServizio = () => ({
  apikey: SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
});

async function utenteChiamante(authHeader: string | null): Promise<{ id: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY!, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? { id: data.id } : null;
}

async function profilo(id: string): Promise<{ ruolo: string | null; responsabile_id: string | null } | null> {
  const url = `${SUPABASE_URL}/rest/v1/profili?id=eq.${encodeURIComponent(id)}&select=ruolo,responsabile_id`;
  const res = await fetch(url, { headers: headerServizio() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function livelloRete(id: string): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/livello_rete`, {
    method: "POST",
    headers: headerServizio(),
    body: JSON.stringify({ p_id: id }),
  });
  if (!res.ok) throw new Error("livello_rete fallita: " + res.status);
  const valore = await res.json();
  return typeof valore === "number" ? valore : null;
}

// Mail "imposta la tua password". Se redirect_to non e' tra gli URL consentiti
// nelle impostazioni Auth, e' Supabase stesso a rifiutarlo.
async function inviaMailPassword(email: string, redirectTo: string | null): Promise<string | null> {
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover${query}`, {
    method: "POST",
    headers: { apikey: ANON_KEY!, "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return null;
  const corpo = await res.json().catch(() => ({}));
  console.error("invio mail fallito:", JSON.stringify(corpo));
  return corpo?.msg || corpo?.message || "invio mail non riuscito";
}

async function scriviRegistro(azione: string, creatoDa: string, profiloId: string, responsabileId: string | null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/registro_inviti`, {
    method: "POST",
    headers: headerServizio(),
    body: JSON.stringify({ azione, creato_da: creatoDa, profilo_id: profiloId, responsabile_id: responsabileId }),
  });
  // Il registro e' audit: se non si scrive lo diciamo nei log, ma non annulliamo un invito gia' valido.
  if (!res.ok) console.error("scrittura registro_inviti fallita:", res.status, await res.text());
}

function passwordCasuale(): string {
  const byte = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...byte));
}

const EMAIL_VALIDA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error("configurazione mancante: verificare i secret della function");
    return json({ error: "server misconfigured" }, 500);
  }

  const chiamante = await utenteChiamante(req.headers.get("authorization"));
  if (!chiamante) {
    return json({ error: "sessione non valida" }, 401);
  }

  const profiloChiamante = await profilo(chiamante.id);
  if (!profiloChiamante) {
    return json({ error: "forbidden" }, 403);
  }
  const ruolo = profiloChiamante.ruolo;

  let body: {
    azione?: string;
    nome?: string;
    email?: string;
    responsabile_id?: string;
    profilo_id?: string;
    redirect_to?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON non valido" }, 400);
  }
  const redirectTo = body.redirect_to?.trim() || null;

  let livelloChiamante: number | null;
  try {
    livelloChiamante = await livelloRete(chiamante.id);
  } catch (err) {
    console.error(err);
    return json({ error: "impossibile verificare il livello" }, 500);
  }

  // ----- Reinvio della mail a un diretto che non e' ancora entrato -----
  if (body.azione === "reinvia") {
    const targetId = body.profilo_id?.trim();
    if (!targetId) return json({ error: "profilo_id obbligatorio" }, 400);

    const target = await profilo(targetId);
    if (!target) return json({ error: "venditore non trovato" }, 404);
    if (!puoReinviare(chiamante.id, ruolo, livelloChiamante, target.responsabile_id)) {
      return json({ error: "forbidden" }, 403);
    }

    const utenteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetId)}`, {
      headers: headerServizio(),
    });
    if (!utenteRes.ok) return json({ error: "utente non trovato" }, 404);
    const utente = await utenteRes.json();
    if (utente.last_sign_in_at) {
      return json({ error: "ha gia' fatto accesso: usa il recupero password dal login" }, 409);
    }

    const errMail = await inviaMailPassword(utente.email, redirectTo);
    if (errMail) return json({ error: errMail }, 502);

    await scriviRegistro("reinvio", chiamante.id, targetId, target.responsabile_id);
    return json({ id: targetId, mailInviata: true });
  }

  // ----- Nuovo venditore -----
  const email = body.email?.trim().toLowerCase();
  const nome = body.nome?.trim();
  if (!email || !nome) {
    return json({ error: "nome ed email sono obbligatori" }, 400);
  }
  if (!EMAIL_VALIDA.test(email)) {
    return json({ error: "email non valida" }, 400);
  }

  let livelloResponsabile: number | null = null;
  if (ruoloPrivilegiato(ruolo) && body.responsabile_id) {
    try {
      livelloResponsabile = await livelloRete(body.responsabile_id);
    } catch (err) {
      console.error(err);
      return json({ error: "impossibile verificare il responsabile" }, 500);
    }
  }

  const esito = responsabileDelNuovo(
    chiamante.id,
    ruolo,
    livelloChiamante,
    body.responsabile_id?.trim() || null,
    livelloResponsabile,
  );
  if (!esito.ok) {
    return json({ error: esito.error }, esito.status);
  }

  const creaRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: headerServizio(),
    body: JSON.stringify({
      email,
      password: passwordCasuale(),
      email_confirm: true,
      user_metadata: { nome },
    }),
  });
  const creaBody = await creaRes.json();
  if (!creaRes.ok) {
    console.error("creazione utente fallita:", JSON.stringify(creaBody));
    const messaggio = creaBody?.msg || creaBody?.message || "creazione utente fallita";
    return json({ error: messaggio }, creaRes.status === 422 ? 409 : 500);
  }
  const nuovoId: string = creaBody.id;

  // Il trigger on_auth_user_created ha creato il profilo: lo mettiamo sotto il responsabile.
  // Se non riesce, l'utente non deve restare orfano (apparirebbe come radice dell'albero): lo togliamo.
  const sposta = await fetch(`${SUPABASE_URL}/rest/v1/profili?id=eq.${encodeURIComponent(nuovoId)}`, {
    method: "PATCH",
    headers: { ...headerServizio(), Prefer: "return=representation" },
    body: JSON.stringify({ responsabile_id: esito.responsabileId }),
  });
  const spostati = sposta.ok ? await sposta.json() : [];
  if (!sposta.ok || !Array.isArray(spostati) || spostati.length !== 1) {
    console.error("assegnazione responsabile fallita:", sposta.status);
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(nuovoId)}`, {
      method: "DELETE",
      headers: headerServizio(),
    });
    return json({ error: "creazione annullata: non sono riuscito a collocarlo nella rete" }, 500);
  }

  await scriviRegistro("invito", chiamante.id, nuovoId, esito.responsabileId);

  // Se la mail non parte l'utente esiste gia': non si annulla, il creatore usa "Reinvia".
  const errMail = await inviaMailPassword(email, redirectTo);
  return json({ id: nuovoId, email, nome, mailInviata: !errMail, errorMail: errMail });
});
