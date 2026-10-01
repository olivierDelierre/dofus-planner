/**
 * Scrape tous les donjons de Dofus pour les noobs dans data/guides/ (reprise possible : les guides
 * déjà présents sont conservés).
 *
 *   npm run scrape:dungeons [-- --refresh]
 */
import { syncDungeons } from "../src/lib/dpln-index";

async function main() {
  const refresh = process.argv.includes("--refresh");
  const summary = await syncDungeons({
    refresh,
    progress: (message, done, total) => console.log(`[${done}/${total}] ${message}`),
  });
  console.log(
    `\nTerminé : ${summary.fetched} récupérés, ${summary.skipped} déjà en base, ${summary.failed.length} erreurs, sur ${summary.total} donjons.`,
  );
  if (summary.short.length) console.log(`Guides très courts (à relire) : ${summary.short.join(", ")}`);
  for (const f of summary.failed) console.error(`✗ ${f.url} : ${f.error}`);
  process.exit(summary.failed.length ? 1 : 0);
}

main();
