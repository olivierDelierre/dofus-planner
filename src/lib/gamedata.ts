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

// ---------- Données de l'éditeur de personnage ----------

type I18n = { fr?: string } | string | undefined;
const fr = (v: I18n): string => (typeof v === "string" ? v : (v?.fr ?? ""));

/** Types d'objets DofusDB acceptés par emplacement. */
const SLOT_TYPE_IDS: Record<string, number[]> = {
  Chapeau: [16],
  Cape: [17],
  Amulette: [1],
  Anneau: [9],
  Ceinture: [10],
  Bottes: [11],
  Arme: [2, 3, 4, 5, 6, 7, 8, 19],
  Bouclier: [82],
  Familier: [18],
  Dofus: [23, 151, 217],
};

export function slotFamily(slot: string): string {
  return slot.replace(/ \d+$/, "");
}

/** Rend une recherche insensible à la casse pour un $regex (DofusDB n'accepte pas $options). */
function ciRegex(q: string): string {
  return q
    .trim()
    .slice(0, 40)
    .split("")
    .map((c) => (/[a-zA-Z]/.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
}

export interface ItemHit {
  id: number;
  name: string;
  level: number;
  icon: string;
}

export const dofusdbItemIcon = (iconId: number) => `${DOFUSDB}/img/items/${iconId}.png`;
export const dofusdbSpellIcon = (iconId: number) => `${DOFUSDB}/img/spells/sort_${iconId}.png`;

interface DbItem {
  id: number;
  iconId?: number;
  level?: number;
  name?: I18n;
}

export async function searchItems(slot: string, query: string, maxLevel?: number): Promise<ItemHit[]> {
  const typeIds = SLOT_TYPE_IDS[slotFamily(slot)];
  if (!typeIds) return [];
  const params = new URLSearchParams({ $limit: "30", "$sort[level]": "-1", "$sort[id]": "-1" });
  for (const id of typeIds) params.append("typeId[$in][]", String(id));
  for (const f of ["id", "iconId", "level", "name"]) params.append("$select[]", f);
  if (query.trim()) params.set("name.fr[$regex]", ciRegex(query));
  if (maxLevel) params.set("level[$lte]", String(maxLevel));
  const res = (await cachedFetchJson(`${DOFUSDB}/items?${params}`, 24 * 3600 * 1000)) as { data?: DbItem[] };
  return (res.data ?? []).map((i) => ({
    id: i.id,
    name: fr(i.name),
    level: i.level ?? 0,
    icon: dofusdbItemIcon(i.iconId ?? 0),
  }));
}

export interface ItemDetail extends ItemHit {
  type: string;
  /** Effets avec leur valeur retenue (maximum du jet) quand ce sont des bonus chiffrés. */
  effects: { label: string; value: number; text: string }[];
}

interface DudeEffect {
  int_minimum: number;
  int_maximum: number;
  ignore_int_max: boolean;
  type: { name: string };
  formatted: string;
}

/** Libellés DofusDude qui ne sont pas des caractéristiques. */
const NON_STAT = /^(-|échangeable|attitude|titre|apparence|compagnon|ornement|emote)/i;

export async function getItemDetail(id: number): Promise<ItemDetail | null> {
  const [dude, db] = await Promise.all([
    cachedFetchJson(`${DOFUSDUDE}/items/equipment/${id}`).catch(() => null) as Promise<{
      name: string;
      level: number;
      type: { name: string };
      image_urls?: { icon?: string; sd?: string };
      effects?: DudeEffect[];
    } | null>,
    cachedFetchJson(`${DOFUSDB}/items?id=${id}&$select[]=id&$select[]=iconId&$select[]=level&$select[]=name`).catch(
      () => null,
    ) as Promise<{ data?: DbItem[] } | null>,
  ]);
  const row = db?.data?.[0];
  if (!dude && !row) return null;
  const effects = (dude?.effects ?? [])
    .filter((e) => !NON_STAT.test(e.type.name))
    .map((e) => ({
      label: e.type.name,
      value: !e.ignore_int_max && e.int_maximum >= e.int_minimum ? e.int_maximum : e.int_minimum,
      text: e.formatted,
    }));
  return {
    id,
    name: dude?.name ?? fr(row?.name),
    level: dude?.level ?? row?.level ?? 0,
    type: dude?.type.name ?? "",
    icon: row?.iconId ? dofusdbItemIcon(row.iconId) : (dude?.image_urls?.sd ?? ""),
    effects,
  };
}

export interface SpellInfo {
  id: number;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
}

export async function getBreedSpells(classId: number): Promise<SpellInfo[]> {
  const breed = (await cachedFetchJson(`${DOFUSDB}/breeds?id=${classId}&$select[]=breedSpellsId`)) as {
    data?: { breedSpellsId?: number[] }[];
  };
  const ids = breed.data?.[0]?.breedSpellsId ?? [];
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ $limit: "60" });
  ids.forEach((id) => params.append("id[$in][]", String(id)));
  for (const f of ["id", "iconId", "name", "description", "spellLevels"]) params.append("$select[]", f);
  const res = (await cachedFetchJson(`${DOFUSDB}/spells?${params}`)) as {
    data?: { id: number; iconId: number; name: I18n; description: I18n; spellLevels?: number[] }[];
  };
  const byId = new Map((res.data ?? []).map((s) => [s.id, s]));
  // Ordre d'origine : celui de la barre de sorts de la classe.
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      id: s.id,
      name: fr(s.name),
      description: fr(s.description),
      icon: dofusdbSpellIcon(s.iconId),
      maxLevel: Math.min(6, Math.max(1, s.spellLevels?.length ?? 1)),
    }));
}

export interface BreedInfo {
  id: number;
  name: string;
  symbol: string;
  heads: { m: string; f: string };
}

export async function getBreeds(): Promise<BreedInfo[]> {
  const res = (await cachedFetchJson(`${DOFUSDB}/breeds?$limit=30&$sort[sortIndex]=1`)) as {
    data?: { id: number; name?: I18n; shortName?: I18n; heads?: { male?: string; female?: string } }[];
  };
  return (res.data ?? []).map((b) => ({
    id: b.id,
    name: fr(b.shortName) || fr(b.name),
    symbol: `${DOFUSDB}/img/breeds/symbol_${b.id}.png`,
    heads: { m: b.heads?.male ?? "", f: b.heads?.female ?? "" },
  }));
}
