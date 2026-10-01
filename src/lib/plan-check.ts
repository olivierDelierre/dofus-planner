/**
 * Contrôle automatique d'un plan : Claude peut recommander un sort ou une variante que le personnage
 * ne peut pas encore utiliser. On détecte ces cas d'après les niveaux de déblocage connus et on les
 * signale dans le plan (le conseil reste visible, mais marqué comme à vérifier).
 */
import { normalize } from "./guide-search";
import type { Character, PlanResponse } from "./types";

type Plan = PlanResponse["plan"];

const wordIn = (haystack: string, name: string) =>
  new RegExp(`(^| )${normalize(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);

export function levelWarnings(plan: Plan, team: Character[]): string[] {
  const warnings: string[] = [];
  for (const c of plan.characters) {
    const member = team.find((t) => normalize(t.profile.name) === normalize(c.name));
    if (!member) continue;
    const level = member.profile.level;
    const text = normalize(
      [...c.changes.map((ch) => `${ch.change} ${ch.why}`), ...c.keySpells].join(" . "),
    );
    const locked: { name: string; at: number }[] = [];
    for (const s of member.profile.spells) {
      if (s.level === 0 && s.unlockedAt && s.unlockedAt > level) locked.push({ name: s.name, at: s.unlockedAt });
      if (s.alt?.unlockedAt && s.alt.unlockedAt > level) locked.push({ name: s.alt.name, at: s.alt.unlockedAt });
    }
    for (const l of locked) {
      if (wordIn(text, l.name)) {
        warnings.push(
          `⚠ ${c.name} (niv. ${level}) : « ${l.name} » est cité dans le plan mais n'est débloqué qu'au niveau ${l.at} : conseil non applicable pour l'instant.`,
        );
      }
    }
  }
  return [...new Set(warnings)];
}
