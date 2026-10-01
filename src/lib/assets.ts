/**
 * Icônes officielles du jeu, téléchargées dans public/game/ par scripts/fetch-assets.mjs
 * (source : DofusDB). Servies en local : pas de dépendance externe à l'affichage.
 */
import type { ELEMENTS } from "./types";

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const CLASS_SLUGS = new Set([
  "feca", "osamodas", "enutrof", "sram", "xelor", "ecaflip", "eniripsa", "iop", "cra", "sadida",
  "sacrieur", "pandawa", "roublard", "zobal", "steamer", "eliotrope", "huppermage", "ouginak", "forgelance",
]);

/** Symbole de la classe, ou undefined si la classe est inconnue. */
export function classIcon(className: string): string | undefined {
  const s = slug(className);
  return CLASS_SLUGS.has(s) ? `/game/classes/${s}.png` : undefined;
}

const ELEMENT_ICONS: Record<(typeof ELEMENTS)[number], string> = {
  Terre: "strength",
  Feu: "intelligence",
  Eau: "chance",
  Air: "agility",
  Neutre: "res_neutral",
};

export function elementIcon(element: (typeof ELEMENTS)[number]): string {
  return `/game/stats/${ELEMENT_ICONS[element]}.png`;
}

/** Libellés (normalisés) de caractéristiques vers le fichier d'icône. */
const STAT_ICONS: Record<string, string> = {
  pa: "actionPoints", pointsdaction: "actionPoints",
  pm: "movementPoints", pointsdemouvement: "movementPoints",
  pv: "", pointsdevie: "",
  po: "range", portee: "range",
  vitalite: "vitality", force: "strength", intelligence: "intelligence", chance: "chance",
  agilite: "agility", sagesse: "wisdom",
  critique: "crit", initiative: "initiative", prospection: "prospecting", soins: "heal",
  dommages: "damage", dommage: "damage", puissance: "damagesPercent", pods: "pods", renvoi: "return",
  esquivepa: "dodgeAP", esquivepm: "dodgeMP", invocation: "summonableCreaturesBoost",
  invocations: "summonableCreaturesBoost", maitrisedarme: "weaponDamage",
  resistanceterre: "res_earth", resistancefeu: "res_fire", resistanceeau: "res_water",
  resistanceair: "res_air", resistanceneutre: "res_neutral",
};

/** Icône d'une caractéristique d'après sa clé ou son libellé, si on la connaît. */
export function statIcon(key: string, label?: string): string | undefined {
  for (const candidate of [key, label ?? ""]) {
    const file = STAT_ICONS[slug(candidate)];
    if (file) return `/game/stats/${file}.png`;
  }
  return undefined;
}

/** Passe par le proxy d'images de l'app (cache disque, liste blanche) pour les icônes distantes. */
export function gameImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? url : `/api/icon?u=${encodeURIComponent(url)}`;
}
