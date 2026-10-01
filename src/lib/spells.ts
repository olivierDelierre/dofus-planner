/** Types et calculs de sorts, sans dépendance serveur (utilisable côté navigateur). */

export interface SpellGrade {
  grade: number;
  /** Niveau du personnage à partir duquel ce grade est disponible. */
  minLevel: number;
  apCost: number;
  minRange: number;
  range: number;
  /** Relance (tours entre deux lancers), 0 si aucune. */
  cooldown: number;
  maxPerTurn: number;
  crit: number;
}

export interface SpellVersion {
  id: number;
  name: string;
  description: string;
  icon: string;
  grades: SpellGrade[];
}

/** Un sort de classe : sa version de base et sa variante (absente pour certaines classes). */
export interface ClassSpell {
  id: number;
  base: SpellVersion;
  variant: SpellVersion | null;
}

/** Grade d'un sort pour un niveau de personnage : nombre de grades débloqués (0 = pas encore appris). */
export function spellGrade(grades: Pick<SpellGrade, "minLevel">[], level: number): number {
  return grades.filter((g) => g.minLevel <= level).length;
}

/** Niveau de déblocage du sort (premier grade). */
export function unlockLevel(grades: Pick<SpellGrade, "minLevel">[]): number | undefined {
  return grades.length ? Math.min(...grades.map((g) => g.minLevel)) : undefined;
}

/** Caractéristiques du sort au grade donné (grade 1 si pas encore débloqué). */
export function gradeStats(grades: SpellGrade[], grade: number): SpellGrade | undefined {
  return grades.find((g) => g.grade === Math.max(1, grade)) ?? grades[0];
}

export const rangeText = (g: Pick<SpellGrade, "minRange" | "range">) =>
  g.minRange > 0 && g.minRange !== g.range ? `${g.minRange}-${g.range}` : String(g.range);
