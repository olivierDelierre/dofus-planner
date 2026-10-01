/**
 * Scraper "Dofus pour les noobs" (dofuspourlesnoobs.com).
 *
 * Extraction volontairement générique (titres, paragraphes, listes, tableaux) plutôt que
 * basée sur des sélecteurs précis : la mise en page du site peut changer, le texte reste.
 * Les guides sont sauvegardés dans data/guides/<slug>.json et réutilisés par Claude.
 */
import * as cheerio from "cheerio";
import { loadGuide, saveGuide, toSlug } from "./storage";
import type { GuideFile } from "./types";

const ALLOWED_HOSTS = new Set(["dofuspourlesnoobs.com", "www.dofuspourlesnoobs.com"]);
const MAX_CONTENT_CHARS = 60_000;

export function assertDplnUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("URL invalide");
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Seules les pages de dofuspourlesnoobs.com peuvent être scrapées");
  }
  url.hash = "";
  return url;
}

export function slugFromUrl(url: URL): string {
  const last = url.pathname.replace(/\/+$/, "").split("/").pop() || "index";
  return toSlug(last.replace(/\.html?$/, ""));
}

const BLOCKS = "h1, h2, h3, h4, h5, p, li, tr, div.paragraph, blockquote";

/** Convertit le HTML d'une page en texte Markdown léger. */
export function extractGuide(html: string): { title: string; content: string } {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, nav, header, footer, form, svg").remove();
  // Menus et barres latérales courants (Weebly / WordPress)
  $("#navigation, .wsite-menu-default, .wsite-footer, .sidebar, #sidebar, .menu, .cookie").remove();

  const title =
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").text().trim() ||
    "Sans titre";

  const root = ["#wsite-content", "main", "article", ".content", "#content", "body"]
    .map((sel) => $(sel).first())
    .find((el) => el.length > 0 && el.text().trim().length > 200) ?? $("body");

  const lines: string[] = [];
  root.find(BLOCKS).each((_, el) => {
    const $el = $(el);
    // Évite les doublons quand un bloc est imbriqué dans un autre bloc retenu.
    if ($el.parents(BLOCKS).length > 0) return;
    $el.find("br").replaceWith("\n");

    const tag = el.tagName.toLowerCase();
    if (tag === "tr") {
      const cells = $el
        .find("th, td")
        .map((__, c) => $(c).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);
      if (cells.length) lines.push(`| ${cells.join(" | ")} |`);
      return;
    }

    const text = $el
      .text()
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    if (!text) return;

    if (/^h[1-5]$/.test(tag)) lines.push(`\n${"#".repeat(Number(tag[1]) + 1)} ${text}`);
    else if (tag === "li") lines.push(`- ${text}`);
    else lines.push(text);
  });

  // Images : le texte alternatif contient parfois le nom d'un monstre ou d'un sort.
  const alts = new Set(
    root
      .find("img[alt]")
      .map((_, img) => $(img).attr("alt")?.trim())
      .get()
      .filter((a): a is string => !!a && a.length > 2),
  );
  if (alts.size) lines.push(`\n## Images (texte alternatif)\n${[...alts].map((a) => `- ${a}`).join("\n")}`);

  const content = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_CONTENT_CHARS);
  return { title, content };
}

/**
 * Récupère un guide : depuis le disque si déjà scrapé (sauf refresh), sinon depuis le site.
 */
export async function fetchDplnGuide(rawUrl: string, opts: { refresh?: boolean } = {}): Promise<GuideFile> {
  const url = assertDplnUrl(rawUrl);
  const slug = slugFromUrl(url);

  if (!opts.refresh) {
    const existing = await loadGuide(slug);
    if (existing) return existing;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "dofus-planner/0.1 (outil personnel de préparation de combats)",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url.href}`);

  const { title, content } = extractGuide(await res.text());
  if (content.length < 100) throw new Error(`Contenu quasi vide sur ${url.href} : la page a peut-être changé de structure`);

  const guide: GuideFile = { slug, url: url.href, title, fetchedAt: new Date().toISOString(), content };
  await saveGuide(guide);
  return guide;
}
