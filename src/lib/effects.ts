/** Effets d'objets modifiables à la main (jets exacts, FM, exos) : libellés et mise en forme. */

/** Libellés reconnus par le calcul des caractéristiques (mêmes noms que DofusDude). */
export const EFFECT_LABELS = [
  "Vitalité", "Sagesse", "Force", "Intelligence", "Chance", "Agilité",
  "PA", "PM", "Portée", "Invocation", "Initiative", "Prospection",
  "Puissance", "Dommage", "Dommage Neutre", "Dommage Terre", "Dommage Feu", "Dommage Eau", "Dommage Air",
  "Dommage Critiques", "Dommage Poussée", "Soin", "Renvoi",
  "% Critique", "% Dommages aux Armes",
  "% Résistance Neutre", "% Résistance Terre", "% Résistance Feu", "% Résistance Eau", "% Résistance Air",
  "Résistance Neutre", "Résistance Terre", "Résistance Feu", "Résistance Eau", "Résistance Air",
  "Résistance Critiques", "Résistance Poussée",
  "Esquive PA", "Esquive PM", "Retrait PA", "Retrait PM", "Tacle", "Fuite", "Pods",
] as const;

export interface ItemEffect {
  label: string;
  value: number;
}

/** Texte d'un effet, au format des données du jeu : « 40 Force », « 3% Critique », « -5 Fuite ». */
export function effectText(label: string, value: number): string {
  return label.startsWith("%") ? `${value}% ${label.replace(/^%\s*/, "")}` : `${value} ${label}`;
}
