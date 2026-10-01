/**
 * Construction d'une fiche de personnage à partir de la saisie (classe, niveau, points, objets, sorts).
 * Les noms, icônes et effets viennent des API du jeu ; les caractéristiques totales sont calculées ici.
 */
import { getBreedSpells, getBreeds, getItemDetail } from "./gamedata";
import { BASE_STATS, type BaseStat, type BuildInput, type CharacterProfile } from "./types";

export interface Bonus {
  label: string;
  value: number;
}

const BASE_LABEL: Record<BaseStat, string> = {
  vitalite: "Vitalité",
  sagesse: "Sagesse",
  force: "Force",
  intelligence: "Intelligence",
  chance: "Chance",
  agilite: "Agilité",
};

const ELEMENT_OF: Partial<Record<BaseStat, CharacterProfile["elements"][number]>> = {
  force: "Terre",
  intelligence: "Feu",
  chance: "Eau",
  agilite: "Air",
};

/** Mise en forme d'une valeur : pourcentage quand le libellé commence par « % ». */
function fmt(label: string, v: number): string {
  return label.startsWith("%") ? `${v}%` : String(v);
}

const cleanLabel = (l: string) => l.replace(/^%\s*/, "").replace(/^Dommage$/, "Dommages");
const slugOf = (l: string) =>
  l
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Caractéristiques totales : base du niveau + points investis + bonus de l'équipement. */
export function computeStats(
  level: number,
  base: Record<BaseStat, number>,
  bonuses: Bonus[],
): { stats: CharacterProfile["stats"]; elements: CharacterProfile["elements"] } {
  const sum = new Map<string, { label: string; value: number }>();
  for (const b of bonuses) {
    const key = slugOf(b.label);
    const entry = sum.get(key) ?? { label: b.label, value: 0 };
    entry.value += b.value;
    sum.set(key, entry);
  }
  const bonusOf = (label: string) => sum.get(slugOf(label))?.value ?? 0;
  const total = (k: BaseStat) => base[k] + bonusOf(BASE_LABEL[k]);

  const pa = (level >= 100 ? 7 : 6) + bonusOf("PA");
  const pm = 3 + bonusOf("PM");
  const pv = 55 + 5 * (level - 1) + total("vitalite");

  const stats: CharacterProfile["stats"] = [
    { key: "pa", label: "PA", value: pa },
    { key: "pm", label: "PM", value: pm },
    { key: "pv", label: "PV", value: pv },
    { key: "po", label: "Portée", value: bonusOf("Portée") },
  ];
  for (const k of BASE_STATS) stats.push({ key: k, label: BASE_LABEL[k], value: total(k) });

  const done = new Set(["pa", "pm", "portee", ...BASE_STATS.map((k) => slugOf(BASE_LABEL[k]))]);
  const rest = [...sum.entries()]
    .filter(([key, e]) => !done.has(key) && e.value !== 0)
    .sort((a, b) => a[1].label.localeCompare(b[1].label, "fr"));
  for (const [key, e] of rest) stats.push({ key, label: cleanLabel(e.label), value: fmt(e.label, e.value) });

  // Éléments : ceux dont la caractéristique atteint au moins 60 % de la plus haute.
  const peaks = (Object.keys(ELEMENT_OF) as BaseStat[]).map((k) => [k, total(k)] as const);
  const max = Math.max(...peaks.map(([, v]) => v));
  const elements: CharacterProfile["elements"] =
    max <= 0 ? ["Neutre"] : peaks.filter(([, v]) => v >= max * 0.6).map(([k]) => ELEMENT_OF[k]!);
  return { stats, elements };
}

export class BuildError extends Error {}

export async function buildProfile(input: BuildInput): Promise<CharacterProfile> {
  const [breeds, spellList] = await Promise.all([getBreeds(), getBreedSpells(input.classId)]);
  const breed = breeds.find((b) => b.id === input.classId);
  if (!breed) throw new BuildError("Classe inconnue");

  const slots = new Set<string>();
  for (const it of input.items) {
    if (slots.has(it.slot)) throw new BuildError(`Emplacement « ${it.slot} » en double`);
    slots.add(it.slot);
  }
  const details = await Promise.all(input.items.map((it) => getItemDetail(it.itemId)));
  const items: CharacterProfile["items"] = [];
  const bonuses: Bonus[] = [];
  input.items.forEach((it, i) => {
    const d = details[i];
    if (!d) throw new BuildError(`Objet ${it.itemId} introuvable`);
    items.push({
      slot: it.slot,
      itemId: d.id,
      name: d.name,
      level: d.level || undefined,
      type: d.type || undefined,
      icon: d.icon || undefined,
      effects: d.effects.map((e) => e.text),
    });
    for (const e of d.effects) bonuses.push({ label: e.label, value: e.value });
  });

  const known = new Map(spellList.map((s) => [s.id, s]));
  const levels = new Map(input.spells.map((s) => [s.id, s.level]));
  const spells: CharacterProfile["spells"] = spellList
    .filter((s) => levels.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      level: Math.min(levels.get(s.id)!, known.get(s.id)!.maxLevel),
      icon: s.icon,
      description: s.description,
    }));

  const { stats, elements } = computeStats(input.level, input.base, bonuses);
  return {
    name: input.name,
    classId: input.classId,
    className: breed.name,
    gender: input.gender,
    level: input.level,
    classImage: breed.symbol,
    headImage: breed.heads[input.gender] || undefined,
    base: input.base,
    elements,
    items,
    stats,
    spells,
  };
}
