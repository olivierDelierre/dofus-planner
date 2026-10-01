/**
 * Accès aux API publiques de données Dofus 3, avec cache disque (data/cache/).
 *
 * - DofusDude (api.dofusdu.de) : équipements et panoplies.
 * - DofusDB (api.dofusdb.fr, non officiel, API "feathers") : monstres et donjons.
 *
 * Les réponses sont renvoyées à Claude sous forme de JSON allégé : on ne mappe pas
 * champ par champ pour rester robuste aux évolutions de schéma des API.
 */
import { cachedFetchJson } from "./storage";

const DOFUSDUDE = "https://api.dofusdu.de/dofus3/v1/fr";
const DOFUSDB = "https://api.dofusdb.fr";
const MAX_RESULT_CHARS = 12_000;

/** Champs volumineux inutiles pour la stratégie. */
const DROP_KEYS = new Set([
  "img",
  "image_urls",
  "icon",
  "look",
  "drops",
  "temporisDrops",
  "gfxId",
  "createdAt",
  "updatedAt",
  "__v",
]);

/** Ne garde que la traduction française des champs i18n ({fr, en, de...}). */
function slim(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => slim(v, depth + 1));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.fr === "string" && ("en" in obj || "de" in obj)) return obj.fr;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (DROP_KEYS.has(k) || v === null || v === undefined) continue;
      out[k] = slim(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function toToolResult(data: unknown): string {
  const json = JSON.stringify(slim(data));
  return json.length > MAX_RESULT_CHARS ? json.slice(0, MAX_RESULT_CHARS) + "…(tronqué)" : json;
}

export async function searchEquipment(query: string, limit = 5): Promise<unknown> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return cachedFetchJson(`${DOFUSDUDE}/items/equipment/search?${params}`);
}

export async function searchSets(query: string, limit = 5): Promise<unknown> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return cachedFetchJson(`${DOFUSDUDE}/sets/search?${params}`);
}

function dofusdbSearch(resource: string, query: string, limit: number): Promise<unknown> {
  const params = new URLSearchParams({
    "name.fr[$search]": query,
    $limit: String(limit),
    lang: "fr",
  });
  return cachedFetchJson(`${DOFUSDB}/${resource}?${params}`);
}

export function searchMonsters(query: string, limit = 5): Promise<unknown> {
  return dofusdbSearch("monsters", query, limit);
}

export function searchDungeons(query: string, limit = 5): Promise<unknown> {
  return dofusdbSearch("dungeons", query, limit);
}
