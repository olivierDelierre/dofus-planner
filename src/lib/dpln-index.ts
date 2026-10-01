/**
 * Index des donjons de Dofus pour les noobs : la page /donjons.html liste tous les guides de donjons.
 * On les scrape une fois dans data/guides/ pour que Claude lise la base locale sans parser le site.
 */
import * as cheerio from "cheerio";
import { fetchDplnGuide, slugFromUrl } from "./dpln";
import type { GuideFile } from "./types";

const BASE = "https://www.dofuspourlesnoobs.com";
const INDEX_URL = `${BASE}/donjons.html`;

/** Pages listées sur /donjons.html qui ne sont pas des guides de donjon. */
const NOT_DUNGEONS = new Set([
  "songes-infinis",
  "epreuves-de-songe",
  "les-succes-speciaux",
  "expeditions-de-guilde",
  "raids-de-guilde",
]);

export interface DungeonRef {
  url: string;
  label: string;
}

/** Extrait les donjons de la page d'index (pur, testable avec une fixture). */
export function parseDungeonIndex(html: string): DungeonRef[] {
  const $ = cheerio.load(html);
  const found = new Map<string, DungeonRef>();
  $("#wsite-content a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (!/^\/[^#?]+\.html$/.test(href)) return;
    const url = new URL(href, BASE);
    if (NOT_DUNGEONS.has(slugFromUrl(url))) return;
    const label = $(a).text().replace(/\s+/g, " ").trim();
    if (!found.has(url.href)) found.set(url.href, { url: url.href, label });
    else if (label && !found.get(url.href)!.label) found.get(url.href)!.label = label;
  });
  return [...found.values()];
}

export async function fetchDungeonIndex(): Promise<DungeonRef[]> {
  const res = await fetch(INDEX_URL, {
    headers: { "User-Agent": "dofus-planner/0.1 (outil personnel de préparation de combats)", Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${INDEX_URL}`);
  const dungeons = parseDungeonIndex(await res.text());
  if (dungeons.length < 50) throw new Error(`Index des donjons suspect (${dungeons.length} liens) : la page a peut-être changé`);
  return dungeons;
}

export interface SyncSummary {
  total: number;
  fetched: number;
  skipped: number;
  failed: { url: string; error: string }[];
  short: string[];
}

/** Guides plus courts que ça : page vide ou « à venir », signalés pour relecture. */
export const SHORT_GUIDE = 500;

/**
 * Scrape les donjons manquants (les guides existants sont conservés sauf `refresh`).
 * Une requête par seconde maximum, par politesse envers le site.
 */
export async function syncDungeons(
  opts: { refresh?: boolean; progress?: (message: string, done: number, total: number) => void; delayMs?: number } = {},
): Promise<SyncSummary> {
  const { refresh = false, progress = () => {}, delayMs = 1000 } = opts;
  const dungeons = await fetchDungeonIndex();
  const summary: SyncSummary = { total: dungeons.length, fetched: 0, skipped: 0, failed: [], short: [] };
  const { loadGuide } = await import("./storage");

  for (const [i, d] of dungeons.entries()) {
    const existing = refresh ? null : await loadGuide(slugFromUrl(new URL(d.url)));
    try {
      let guide: GuideFile;
      if (existing) {
        guide = await fetchDplnGuide(d.url, { kind: "donjon", label: d.label });
        summary.skipped++;
        progress(`Déjà en base : ${d.label}`, i + 1, dungeons.length);
      } else {
        guide = await fetchDplnGuide(d.url, { refresh: true, kind: "donjon", label: d.label });
        summary.fetched++;
        progress(`Récupéré : ${d.label}`, i + 1, dungeons.length);
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (guide.content.length < SHORT_GUIDE) summary.short.push(d.label || d.url);
    } catch (err) {
      summary.failed.push({ url: d.url, error: err instanceof Error ? err.message : String(err) });
      progress(`⚠ ${d.label} : ${err instanceof Error ? err.message : err}`, i + 1, dungeons.length);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return summary;
}
