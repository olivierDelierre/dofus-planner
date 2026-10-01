/**
 * Score de confiance "de base", déterministe, calculé avant l'appel à Claude.
 * Claude part de cette note et doit justifier tout écart : ça évite des étoiles
 * qui changent d'une génération à l'autre pour la même situation.
 */
import type { BaselineScore, Character, Encounter } from "./types";

// Heuristique volontairement grossière : classes réputées pour soigner ou encaisser.
const HEALERS = new Set(["Eniripsa", "Osamodas"]);
const PROTECTORS = new Set(["Féca", "Sacrieur", "Pandawa"]);

export function baselineScore(team: Character[], encounter: Encounter): BaselineScore {
  const factors: string[] = [];
  let score = 3;

  const avgLevel = team.reduce((sum, c) => sum + c.level, 0) / team.length;
  if (encounter.level) {
    const gap = avgLevel - encounter.level;
    if (gap >= 20) score = 5;
    else if (gap >= 5) score = 4;
    else if (gap >= -5) score = 3;
    else if (gap >= -15) score = 2;
    else score = 1;
    factors.push(
      `Niveau moyen ${Math.round(avgLevel)} contre niveau ${encounter.level} (écart ${gap >= 0 ? "+" : ""}${Math.round(gap)})`,
    );
  } else {
    factors.push("Niveau du combat inconnu : base 3/5");
  }

  if (encounter.kind === "donjon" && team.length < 3 && (!encounter.level || avgLevel - encounter.level < 20)) {
    score -= 1;
    factors.push(`Seulement ${team.length} personnage(s) pour un donjon`);
  }

  if (!team.some((c) => HEALERS.has(c.class))) {
    score -= 0.5;
    factors.push("Pas de classe de soin dédiée");
  }
  if (!team.some((c) => PROTECTORS.has(c.class))) {
    score -= 0.5;
    factors.push("Pas de classe de protection/tank");
  }

  const elements = new Set(team.flatMap((c) => c.elements));
  if (elements.size >= 2) {
    score += 0.5;
    factors.push(`Couverture élémentaire : ${[...elements].join(", ")}`);
  } else {
    factors.push("Un seul élément dans l'équipe : vulnérable aux résistances");
  }

  return { stars: clampStars(score), factors };
}

export function clampStars(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}
