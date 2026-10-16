// Regole di "chi puo' creare chi" per admin-crea-profilo, separate dalla rete
// (niente fetch qui) cosi' si testano con node. Solo sintassi TypeScript
// cancellabile: il test la carica direttamente.
//
// Il livello viene dall'albero (profili.responsabile_id), non e' salvato:
// 1 = radice (Alessandro), 2 = suoi diretti, 3 = diretti dei lv2.
// Si crea SOLO il livello immediatamente sotto il proprio; il tetto e' lv3.
// Tomas (ruolo developer o admin) non e' un nodo dell'albero: sceglie lui il responsabile.

export const LIVELLO_MASSIMO = 3;

// Ruoli fuori dall'albero con accesso globale: scelgono loro "sotto chi".
export const ruoloPrivilegiato = (ruolo: string | null) => ruolo === "developer" || ruolo === "admin";

export type Esito =
  | { ok: true; responsabileId: string }
  | { ok: false; status: number; error: string };

// responsabileRichiesto / livelloResponsabile contano solo per i ruoli privilegiati.
export function responsabileDelNuovo(
  chiamanteId: string,
  ruolo: string | null,
  livelloChiamante: number | null,
  responsabileRichiesto: string | null,
  livelloResponsabile: number | null,
): Esito {
  if (ruoloPrivilegiato(ruolo)) {
    if (!responsabileRichiesto) {
      return { ok: false, status: 400, error: "scegli sotto chi creare il venditore" };
    }
    if (livelloResponsabile === null) {
      return { ok: false, status: 400, error: "il responsabile scelto non e' nella rete vendita" };
    }
    if (livelloResponsabile >= LIVELLO_MASSIMO) {
      return { ok: false, status: 403, error: `la rete arriva al massimo al livello ${LIVELLO_MASSIMO}` };
    }
    return { ok: true, responsabileId: responsabileRichiesto };
  }

  if (livelloChiamante === null || livelloChiamante >= LIVELLO_MASSIMO) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  // Ognuno crea solo i propri diretti: un responsabile diverso da se' e' un tentativo di aggirare la regola.
  if (responsabileRichiesto && responsabileRichiesto !== chiamanteId) {
    return { ok: false, status: 403, error: "puoi creare venditori solo sotto di te" };
  }
  return { ok: true, responsabileId: chiamanteId };
}

// Reinvio: developer/admin su chiunque, gli altri solo sui propri diretti.
export function puoReinviare(
  chiamanteId: string,
  ruolo: string | null,
  livelloChiamante: number | null,
  responsabileDelTarget: string | null,
): boolean {
  if (ruoloPrivilegiato(ruolo)) return true;
  return livelloChiamante !== null && responsabileDelTarget === chiamanteId;
}
