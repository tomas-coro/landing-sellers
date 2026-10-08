// supabase/functions/admin-crea-profilo/index.ts
//
// Crea un nuovo profilo venditore da pannello admin: email + password
// temporanea, l'utente la cambia al primo accesso (cambio password non
// ancora collegato lato login, vedi nota in fondo).
//
// Perche' una Edge Function e non un insert diretto dal browser: creare un
// utente richiede scrivere su auth.users, operazione possibile solo con la
// service_role key, che non puo' mai girare lato client (repo pubblica).
// La riga in public.profili NON va inserita qui: il trigger
// on_auth_user_created (vedi supabase/schema.sql) la crea da solo con
// ruolo='venditore' appena l'utente auth viene creato.
//
// Sicurezza: il controllo "chi puo' creare profili" vive qui, non nel
// browser - isAdmin in js/app.js gestisce solo la UI. Il chiamante deve
// avere una sessione valida (JWT passato da supabaseClient.functions.invoke)
// E un profilo con ruolo='admin' in DB, altrimenti 403. Il ruolo del nuovo
// profilo e' sempre 'venditore': non e' un parametro della richiesta.
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

async function utenteChiamante(authHeader: string | null): Promise<{ id: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY!, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? { id: data.id } : null;
}

async function ruoloProfilo(id: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/profili?id=eq.${encodeURIComponent(id)}&select=ruolo`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_ROLE_KEY!, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.ruolo ?? null;
}

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

  const ruolo = await ruoloProfilo(chiamante.id);
  if (ruolo !== "admin") {
    return json({ error: "forbidden" }, 403);
  }

  let body: { email?: string; password?: string; nome?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON non valido" }, 400);
  }

  const email = body.email?.trim();
  const password = body.password;
  const nome = body.nome?.trim();
  if (!email || !password || !nome) {
    return json({ error: "email, password e nome sono obbligatori" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "la password deve avere almeno 8 caratteri" }, 400);
  }

  const creaRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
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

  return json({ id: creaBody.id, email, nome });
});
