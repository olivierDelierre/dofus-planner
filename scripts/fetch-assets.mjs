#!/usr/bin/env node
/**
 * Télécharge les icônes officielles du jeu (via DofusDB) dans public/game/.
 * Les fichiers sont versionnés : à relancer seulement pour les mettre à jour.
 *   node scripts/fetch-assets.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/game");
const CLASSES = {
  1: "feca", 2: "osamodas", 3: "enutrof", 4: "sram", 5: "xelor", 6: "ecaflip", 7: "eniripsa",
  8: "iop", 9: "cra", 10: "sadida", 11: "sacrieur", 12: "pandawa", 13: "roublard", 14: "zobal",
  15: "steamer", 16: "eliotrope", 17: "huppermage", 18: "ouginak", 20: "forgelance",
};
const STATS = [
  "strength", "intelligence", "chance", "agility", "vitality", "wisdom", "actionPoints", "movementPoints",
  "range", "crit", "initiative", "prospecting", "heal", "damage", "damagesPercent", "pods", "return",
  "dodgeAP", "dodgeMP", "summonableCreaturesBoost", "weaponDamage", "res_neutral", "res_earth", "res_fire", "res_water", "res_air",
];

async function get(url, file) {
  const res = await fetch(url);
  if (!res.ok) return console.warn(`✗ ${res.status} ${url}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
}

for (const [id, slug] of Object.entries(CLASSES))
  await get(`https://api.dofusdb.fr/img/breeds/symbol_${id}.png`, `${OUT}/classes/${slug}.png`);
for (const s of STATS) await get(`https://dofusdb.fr/icons/characteristics/tx_${s}.png`, `${OUT}/stats/${s}.png`);
