// supabase/functions/check-renewals/index.ts
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface ClienteRinnovo {
  id: string;
  venditore_id: string;
  nome: string;
  data_rinnovo: string;
  giorni_preavviso_notifica: number;
  ultimo_rinnovo_notificato: string | null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function autorizzato(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  const token = auth.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payloadJson = atob(
      parts[1].replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (parts[1].length % 4)) % 4)
    );
    const payload = JSON.parse(payloadJson);
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

function giorniTra(oggi: string, data: string): number {
  const a = Date.parse(`${oggi}T00:00:00Z`);
  const b = Date.parse(`${data}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

async function clientiCandidati(oggi: string): Promise<ClienteRinnovo[]> {
  const select = [
    "id",
    "venditore_id",
    "nome",
    "data_rinnovo",
    "giorni_preavviso_notifica",
    "ultimo_rinnovo_notificato",
  ].join(",");

  const fine = new Date(Date.parse(`${oggi}T00:00:00Z`) + 30 * 86400000)
    .toISOString().slice(0, 10);

  const url = `${SUPABASE_URL}/rest/v1/clienti` +
    `?cancellato_il=is.null` +
    `&data_rinnovo=gt.${encodeURIComponent(oggi)}` +
    `&data_rinnovo=lte.${encodeURIComponent(fine)}` +
    `&select=${encodeURIComponent(select)}`;

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) throw new Error(`lettura clienti fallita: HTTP ${res.status}`);
  return await res.json();
}

async function inviaPush(c: ClienteRinnovo): Promise<boolean> {
  const giorni = Number(c.giorni_preavviso_notifica) || 7;
  const dataIt = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${c.data_rinnovo}T12:00:00Z`));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-web-push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: c.venditore_id,
      title: "Rinnovo cliente in arrivo",
      message: `${c.nome} rinnova il ${dataIt}. Mancano ${giorni} ${giorni === 1 ? "giorno" : "giorni"}.`,
      url: "./",
    }),
  });

  if (!res.ok) return false;

  const body = await res.json().catch(() => null);
  const risultati = Array.isArray(body?.results) ? body.results : [];
  return risultati.some((r: { ok?: boolean }) => r?.ok === true);
}

async function marcaNotificato(c: ClienteRinnovo): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/clienti?id=eq.${encodeURIComponent(c.id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ultimo_rinnovo_notificato: c.data_rinnovo }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!autorizzato(req)) return json({ error: "forbidden" }, 403);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "server misconfigured" }, 500);

  const oggi = new Date().toISOString().slice(0, 10);

  let candidati: ClienteRinnovo[];
  try {
    candidati = await clientiCandidati(oggi);
  } catch (err) {
    console.error(String(err));
    return json({ error: "query failed" }, 500);
  }

  const dovuti = candidati.filter((c) => {
    const preavviso = Number(c.giorni_preavviso_notifica) || 7;
    const mancanti = giorniTra(oggi, c.data_rinnovo);
    return mancanti > 0 &&
      mancanti <= preavviso &&
      c.ultimo_rinnovo_notificato !== c.data_rinnovo;
  });

  let notificati = 0;
  let falliti = 0;

  for (const cliente of dovuti) {
    try {
      const inviata = await inviaPush(cliente);
      if (!inviata) {
        falliti += 1;
        continue;
      }
      const marcato = await marcaNotificato(cliente);
      if (marcato) notificati += 1;
      else falliti += 1;
    } catch (err) {
      falliti += 1;
      console.error(`errore rinnovo cliente=${cliente.id}:`, String(err));
    }
  }

  return json({
    date: oggi,
    candidates: candidati.length,
    due: dovuti.length,
    notified: notificati,
    failed: falliti,
  });
});
