const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface ClienteRinnovo {
  id: string;
  venditore_id: string;
  nome: string;
  data_attivazione: string | null;
  data_rinnovo: string | null;
  periodicita_contratto: "mensile" | "annuale" | null;
  modalita_notifica_rinnovo: "nessuna" | "mensile" | "annuale" | "entrambe" | null;
  giorni_preavviso_notifica: number;
  ultimo_rinnovo_notificato: string | null;
  ultimo_anniversario_notificato: string | null;
}

type TipoScadenza = "mensile" | "annuale";

interface ScadenzaDovuta {
  cliente: ClienteRinnovo;
  tipo: TipoScadenza;
  data: string;
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

function dataIsoUTC(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

function ultimoGiornoMeseUTC(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate();
}

function prossimoAnniversario(dataAttivazione: string, oggi: string): string | null {
  const base = dataAttivazione.split("-").map(Number);
  const ref = oggi.split("-").map(Number);

  if (base.length !== 3 || ref.length !== 3 || base.some(Number.isNaN) || ref.some(Number.isNaN)) {
    return null;
  }

  const [, meseBase, giornoBase] = base;
  const [annoOggi] = ref;
  const oggiMs = Date.parse(`${oggi}T00:00:00Z`);

  for (let anno = annoOggi; anno <= annoOggi + 2; anno += 1) {
    const giorno = Math.min(giornoBase, ultimoGiornoMeseUTC(anno, meseBase));
    const candidato = dataIsoUTC(anno, meseBase, giorno);
    const candidatoMs = Date.parse(`${candidato}T00:00:00Z`);

    if (candidatoMs > oggiMs) return candidato;
  }

  return null;
}

async function clientiCandidati(): Promise<ClienteRinnovo[]> {
  const select = [
    "id",
    "venditore_id",
    "nome",
    "data_attivazione",
    "data_rinnovo",
    "periodicita_contratto",
    "modalita_notifica_rinnovo",
    "giorni_preavviso_notifica",
    "ultimo_rinnovo_notificato",
    "ultimo_anniversario_notificato",
  ].join(",");

  const url = `${SUPABASE_URL}/rest/v1/clienti` +
    `?cancellato_il=is.null` +
    `&modalita_notifica_rinnovo=neq.nessuna` +
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

function scadenzeCliente(c: ClienteRinnovo, oggi: string): ScadenzaDovuta[] {
  const modalita = c.modalita_notifica_rinnovo;
  const preavviso = Number(c.giorni_preavviso_notifica) || 7;
  const result: ScadenzaDovuta[] = [];

  if (
    c.periodicita_contratto === "mensile" &&
    c.data_rinnovo &&
    (modalita === "mensile" || modalita === "entrambe")
  ) {
    const mancanti = giorniTra(oggi, c.data_rinnovo);

    if (
      mancanti > 0 &&
      mancanti <= preavviso &&
      c.ultimo_rinnovo_notificato !== c.data_rinnovo
    ) {
      result.push({
        cliente: c,
        tipo: "mensile",
        data: c.data_rinnovo,
      });
    }
  }

  if (
    c.data_attivazione &&
    (modalita === "annuale" || modalita === "entrambe")
  ) {
    const anniversario = prossimoAnniversario(c.data_attivazione, oggi);

    if (anniversario) {
      const mancanti = giorniTra(oggi, anniversario);

      if (
        mancanti > 0 &&
        mancanti <= preavviso &&
        c.ultimo_anniversario_notificato !== anniversario
      ) {
        result.push({
          cliente: c,
          tipo: "annuale",
          data: anniversario,
        });
      }
    }
  }

  return result;
}

async function inviaPush(scadenza: ScadenzaDovuta): Promise<boolean> {
  const c = scadenza.cliente;
  const giorni = giorniTra(new Date().toISOString().slice(0, 10), scadenza.data);

  const dataIt = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${scadenza.data}T12:00:00Z`));

  const titolo = scadenza.tipo === "mensile"
    ? "Mensilità cliente in scadenza"
    : "Rinnovo annuale cliente";

  const tipoTesto = scadenza.tipo === "mensile"
    ? "mensilità"
    : "scadenza annuale";

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-web-push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: c.venditore_id,
      title: titolo,
      message: `${c.nome}: ${tipoTesto} il ${dataIt}. Mancano ${giorni} ${giorni === 1 ? "giorno" : "giorni"}.`,
      url: "./",
    }),
  });

  if (!res.ok) return false;

  const body = await res.json().catch(() => null);
  const risultati = Array.isArray(body?.results) ? body.results : [];
  return risultati.some((r: { ok?: boolean }) => r?.ok === true);
}

async function marcaNotificato(scadenza: ScadenzaDovuta): Promise<boolean> {
  const c = scadenza.cliente;
  const url = `${SUPABASE_URL}/rest/v1/clienti?id=eq.${encodeURIComponent(c.id)}`;

  const body = scadenza.tipo === "mensile"
    ? { ultimo_rinnovo_notificato: scadenza.data }
    : { ultimo_anniversario_notificato: scadenza.data };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!autorizzato(req)) return json({ error: "forbidden" }, 403);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "server misconfigured" }, 500);
  }

  const oggi = new Date().toISOString().slice(0, 10);

  let candidati: ClienteRinnovo[];

  try {
    candidati = await clientiCandidati();
  } catch (err) {
    console.error(String(err));
    return json({ error: "query failed" }, 500);
  }

  const dovute = candidati.flatMap((c) => scadenzeCliente(c, oggi));

  let notificati = 0;
  let falliti = 0;

  for (const scadenza of dovute) {
    try {
      const inviata = await inviaPush(scadenza);

      if (!inviata) {
        falliti += 1;
        continue;
      }

      const marcato = await marcaNotificato(scadenza);

      if (marcato) notificati += 1;
      else falliti += 1;
    } catch (err) {
      falliti += 1;
      console.error(
        `errore notifica cliente=${scadenza.cliente.id} tipo=${scadenza.tipo}:`,
        String(err)
      );
    }
  }

  return json({
    date: oggi,
    candidates: candidati.length,
    due: dovute.length,
    notified: notificati,
    failed: falliti,
  });
});
