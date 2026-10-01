/**
 * Construction d'une fiche de personnage à partir de la saisie (classe, niveau, points, objets, sorts).
 * Les noms, icônes et effets viennent des API du jeu ; les caractéristiques totales sont calculées ici.
 */
import { getBreeds, getClassSpells, getItemDetail, getSet, setBonusFor } from "./gamedata";
import { gradeStats, rangeText, spellGrade, unlockLevel, type ClassSpell } from "./spells";
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

/**
 * Sorts du personnage : tous les sorts de la classe, en version de base ou en variante selon le choix.
 * Le grade se déduit du niveau du personnage ; une variante pas encore débloquée retombe sur la version de base.
 */
export function buildSpells(
  classSpells: ClassSpell[],
  choices: { id: number; variant?: boolean }[],
  level: number,
): CharacterProfile["spells"] {
  const wantsVariant = new Set(choices.filter((c) => c.variant).map((c) => c.id));
  return classSpells.map((cs) => {
    const useVariant = wantsVariant.has(cs.id) && !!cs.variant && spellGrade(cs.variant.grades, level) > 0;
    const chosen = useVariant ? cs.variant! : cs.base;
    const other = useVariant ? cs.base : cs.variant;
    const grade = spellGrade(chosen.grades, level);
    const stats = gradeStats(chosen.grades, grade);
    return {
      id: chosen.id,
      baseId: cs.id,
      name: chosen.name,
      level: grade,
      icon: chosen.icon,
      description: chosen.description,
      variant: useVariant,
      unlockedAt: unlockLevel(chosen.grades),
      ap: stats?.apCost,
      range: stats ? rangeText(stats) : undefined,
      cooldown: stats?.cooldown || undefined,
      alt: other
        ? { name: other.name, icon: other.icon, description: other.description, unlockedAt: unlockLevel(other.grades) }
        : undefined,
    };
  });
}

export class BuildError extends Error {}

export async function buildProfile(input: BuildInput): Promise<CharacterProfile> {
  const [breeds, spellList] = await Promise.all([getBreeds(), getClassSpells(input.classId)]);
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

  const spells = buildSpells(spellList, input.spells, input.level);

  // Panoplies : un bonus s'applique dès 2 pièces d'une même panoplie.
  const perSet = new Map<number, number>();
  for (const d of details) if (d?.setId) perSet.set(d.setId, (perSet.get(d.setId) ?? 0) + 1);
  const sets: CharacterProfile["sets"] = [];
  for (const [id, count] of perSet) {
    const set = await getSet(id);
    if (!set) continue;
    const active = setBonusFor(set, count);
    for (const b of active) bonuses.push({ label: b.label, value: b.value });
    sets.push({ id, name: set.name, count, size: set.size, bonus: active.map((b) => b.text) });
  }
  sets.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));

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
    sets,
    spells,
  };
}
