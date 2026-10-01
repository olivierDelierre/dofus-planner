/**
 * Pré-remplit les guides locaux depuis Dofus pour les noobs.
 *
 *   npm run scrape -- <url> [<url> ...] [--refresh]
 */
import { fetchDplnGuide } from "../src/lib/dpln";

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes("--refresh");
  const urls = args.filter((a) => !a.startsWith("--"));
  if (urls.length === 0) {
    console.error("Usage : npm run scrape -- <url dofuspourlesnoobs.com> [...] [--refresh]");
    process.exit(1);
  }

  let failed = 0;
  for (const url of urls) {
    try {
      const guide = await fetchDplnGuide(url, { refresh });
      console.log(`✓ ${guide.title} → data/guides/${guide.slug}.json (${guide.content.length} caractères)`);
    } catch (err) {
      failed++;
      console.error(`✗ ${url} : ${err instanceof Error ? err.message : err}`);
    }
    // Politesse envers le site : une requête par seconde maximum.
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.exit(failed ? 1 : 0);
}

main();
