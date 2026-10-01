/** Recherche floue dans les guides locaux (sans accents ni casse, mots vides ignorés). */

const STOP = new Set(["donjon", "de", "du", "des", "la", "le", "les", "l", "d", "un", "une", "au", "aux", "et", "en", "sur"]);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (text: string) => normalize(text).split(" ").filter((t) => t && !STOP.has(t));

export interface Searchable {
  slug: string;
  title: string;
  label?: string;
}

/** Score 0..1 : part des mots de la requête retrouvés (mot entier ou début de mot) dans le guide. */
export function scoreGuide(query: string, guide: Searchable): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const hay = tokens(`${guide.label ?? ""} ${guide.title} ${guide.slug.replace(/-/g, " ")}`);
  let hits = 0;
  for (const t of q) {
    if (hay.some((h) => h === t)) hits += 1;
    else if (t.length >= 4 && hay.some((h) => h.startsWith(t) || (h.length >= 4 && t.startsWith(h)))) hits += 0.7;
  }
  return hits / q.length;
}

export function searchGuides<T extends Searchable>(query: string, guides: T[], limit = 5): T[] {
  return guides
    .map((g) => ({ g, s: scoreGuide(query, g) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s || a.g.title.localeCompare(b.g.title, "fr"))
    .slice(0, limit)
    .map((x) => x.g);
}
