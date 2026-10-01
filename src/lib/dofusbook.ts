/**
 * Import de personnages depuis DofusBook.
 *
 * Liens acceptés, par exemple :
 *   https://www.dofusbook.net/fr/equipement/16088968-db/objets
 *   https://www.dofusbook.net/mobile/fr/equipement/16088968-db/objets
 *   https://d-bk.net/fr/d/16088968  (lien court, suivi par redirection)
 */
import type { DofusbookProfile } from "./types";

const ALLOWED_HOSTS = new Set(["dofusbook.net", "www.dofusbook.net", "d-bk.net", "www.d-bk.net"]);

export interface DofusbookRef {
  /** Identifiant du stuff, ex. "16088968-db". */
  id: string;
  /** URL canonique de la page du stuff. */
  url: string;
}

export function assertDofusbookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Lien invalide");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Lien invalide");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error("Ce n'est pas un lien DofusBook (dofusbook.net ou d-bk.net)");
  return url;
}

/** Extrait l'identifiant d'un lien de page "equipement". */
export function parseDofusbookUrl(raw: string): DofusbookRef {
  const url = assertDofusbookUrl(raw);
  const match = url.pathname.match(/\/equipement\/([A-Za-z0-9-]+)/);
  if (!match) throw new Error("Lien DofusBook non reconnu : utilise le lien d'un équipement (…/equipement/<id>/…)");
  const id = match[1];
  return { id, url: `https://www.dofusbook.net/fr/equipement/${id}/objets` };
}

/**
 * Récupère la fiche d'un stuff DofusBook.
 *
 * À implémenter une fois le format réel de DofusBook inspecté : le site est une application
 * web qui charge ses données via une API interne non documentée.
 */
export async function fetchDofusbookProfile(raw: string): Promise<DofusbookProfile> {
  const ref = parseDofusbookUrl(raw);
  throw new Error(
    `Import DofusBook pas encore disponible (stuff ${ref.id}) : le format de DofusBook doit d'abord être inspecté.`,
  );
}
