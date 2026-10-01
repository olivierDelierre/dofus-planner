/**
 * Accès aux API publiques de données Dofus 3, avec cache disque (data/cache/).
 *
 * - DofusDude (api.dofusdu.de) : équipements et panoplies.
 * - DofusDB (api.dofusdb.fr, non officiel, API "feathers") : monstres et donjons.
 *
 * Les réponses sont renvoyées à Claude sous forme de JSON allégé : on ne mappe pas
 * champ par champ pour rester robuste aux évolutions de schéma des API.
 */
import { type ClassSpell, type SpellGrade, type SpellVersion } from "./spells";
import { cachedFetchJson } from "./storage";

/** Données de jeu stables (sorts, panoplies) : cache de 60 jours. */
const LONG_TTL = 60 * 24 * 3600 * 1000;

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
  setId?: number;
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
      parent_set?: { id: number; name: string };
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
    setId: dude?.parent_set?.id,
    icon: row?.iconId ? dofusdbItemIcon(row.iconId) : (dude?.image_urls?.sd ?? ""),
    effects,
  };
}

interface DbSpell {
  id: number;
  typeId?: number;
  iconId: number;
  name: I18n;
  description: I18n;
  spellLevels?: number[];
}

interface DbSpellLevel {
  spellId: number;
  grade: number;
  minPlayerLevel?: number;
  apCost?: number;
  minRange?: number;
  range?: number;
  minCastInterval?: number;
  globalCooldown?: number;
  maxCastPerTurn?: number;
  criticalHitProbability?: number;
}

const LEVEL_FIELDS = [
  "spellId", "grade", "minPlayerLevel", "apCost", "minRange", "range", "minCastInterval",
  "globalCooldown", "maxCastPerTurn", "criticalHitProbability",
];

/** Grades (niveaux) de tous les sorts donnés, récupérés par paquets de 50 (limite de DofusDB). */
async function fetchGrades(levelIds: number[]): Promise<Map<number, SpellGrade[]>> {
  const out = new Map<number, SpellGrade[]>();
  for (let i = 0; i < levelIds.length; i += 50) {
    const params = new URLSearchParams({ $limit: "50" });
    levelIds.slice(i, i + 50).forEach((id) => params.append("id[$in][]", String(id)));
    for (const f of LEVEL_FIELDS) params.append("$select[]", f);
    const res = (await cachedFetchJson(`${DOFUSDB}/spell-levels?${params}`, LONG_TTL)) as { data?: DbSpellLevel[] };
    for (const l of res.data ?? []) {
      const list = out.get(l.spellId) ?? [];
      list.push({
        grade: l.grade,
        minLevel: l.minPlayerLevel ?? 1,
        apCost: l.apCost ?? 0,
        minRange: l.minRange ?? 0,
        range: l.range ?? 0,
        cooldown: Math.max(l.minCastInterval ?? 0, l.globalCooldown ?? 0),
        maxPerTurn: l.maxCastPerTurn ?? 0,
        crit: l.criticalHitProbability ?? 0,
      });
      out.set(l.spellId, list);
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.grade - b.grade);
  return out;
}

/**
 * Sorts d'une classe avec leur variante et leurs grades. Les niveaux sont ceux du jeu : le grade d'un
 * sort se déduit du niveau du personnage (voir `spellGrade`). Mis en cache sur disque.
 */
export async function getClassSpells(classId: number): Promise<ClassSpell[]> {
  const [breed, variants] = await Promise.all([
    cachedFetchJson(`${DOFUSDB}/breeds?id=${classId}&$select[]=breedSpellsId`, LONG_TTL) as Promise<{
      data?: { breedSpellsId?: number[] }[];
    }>,
    cachedFetchJson(`${DOFUSDB}/spell-variants?breedId=${classId}&$limit=50`, LONG_TTL) as Promise<{
      data?: { spellIds: number[]; spells: DbSpell[] }[];
    }>,
  ]);
  const order = breed.data?.[0]?.breedSpellsId ?? [];
  const pairs = new Map<number, DbSpell[]>(); // id du sort de base -> [base, variante?]
  for (const v of variants.data ?? []) {
    const baseId = v.spellIds.find((id) => order.includes(id)) ?? v.spellIds[0];
    const base = v.spells.find((s) => s.id === baseId);
    const variant = v.spells.find((s) => s.id !== baseId);
    if (base) pairs.set(baseId, variant ? [base, variant] : [base]);
  }
  const grades = await fetchGrades([...pairs.values()].flat().flatMap((s) => s.spellLevels ?? []));

  const version = (s: DbSpell): SpellVersion => ({
    id: s.id,
    name: fr(s.name),
    description: fr(s.description),
    icon: dofusdbSpellIcon(s.iconId),
    grades: grades.get(s.id) ?? [],
  });
  return order
    .filter((id) => pairs.has(id))
    .map((id) => {
      const [base, variant] = pairs.get(id)!;
      return { id, base: version(base), variant: variant ? version(variant) : null };
    });
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

// ---------- Panoplies ----------

export interface SetBonus {
  label: string;
  value: number;
  text: string;
}

export interface SetInfo {
  id: number;
  name: string;
  /** Nombre total de pièces de la panoplie. */
  size: number;
  /** Bonus cumulés selon le nombre de pièces portées (clé = nombre de pièces). */
  bonuses: Record<number, SetBonus[]>;
}


/**
 * Panoplie par identifiant. Récupérée une seule fois sur DofusDude puis relue depuis le cache disque
 * du serveur (data/cache/), donc pas de scraping à chaque calcul.
 */
export async function getSet(id: number): Promise<SetInfo | null> {
  const raw = (await cachedFetchJson(`${DOFUSDUDE}/sets/${id}`, LONG_TTL).catch(() => null)) as {
    name?: string;
    equipment_ids?: number[];
    effects?: Record<string, DudeEffect[] | null>;
  } | null;
  if (!raw?.name) return null;
  const bonuses: Record<number, SetBonus[]> = {};
  for (const [count, effects] of Object.entries(raw.effects ?? {})) {
    if (!effects) continue;
    bonuses[Number(count)] = effects
      .filter((e) => !NON_STAT.test(e.type.name))
      .map((e) => ({
        label: e.type.name,
        value: !e.ignore_int_max && e.int_maximum >= e.int_minimum ? e.int_maximum : e.int_minimum,
        text: e.formatted,
      }));
  }
  return { id, name: raw.name, size: raw.equipment_ids?.length ?? 0, bonuses };
}

/** Bonus applicable pour `count` pièces : l'entrée exacte, ou la plus haute en dessous. */
export function setBonusFor(set: Pick<SetInfo, "bonuses">, count: number): SetBonus[] {
  const keys = Object.keys(set.bonuses)
    .map(Number)
    .filter((k) => k <= count)
    .sort((a, b) => b - a);
  return keys.length ? set.bonuses[keys[0]] : [];
}
