import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStats } from "../src/lib/builder";

const base = { vitalite: 0, sagesse: 0, force: 0, intelligence: 0, chance: 0, agilite: 0 };
const stat = (stats: { key: string; value: number | string }[], key: string) => stats.find((s) => s.key === key)?.value;

test("PA, PM et PV de base selon le niveau", () => {
  const low = computeStats(50, base, []);
  assert.equal(stat(low.stats, "pa"), 6);
  assert.equal(stat(low.stats, "pm"), 3);
  assert.equal(stat(computeStats(200, base, []).stats, "pa"), 7);
  assert.equal(stat(computeStats(200, { ...base, vitalite: 100 }, []).stats, "pv"), 55 + 5 * 199 + 100);
});

test("les bonus d'équipement s'additionnent aux points de base", () => {
  const { stats } = computeStats(200, { ...base, force: 300 }, [
    { label: "Force", value: 50 },
    { label: "Force", value: 20 },
    { label: "PA", value: 1 },
    { label: "% Critique", value: 4 },
    { label: "% Critique", value: 3 },
  ]);
  assert.equal(stat(stats, "force"), 370);
  assert.equal(stat(stats, "pa"), 8);
  assert.equal(stat(stats, "critique"), "7%");
});

test("éléments : ceux proches de la caractéristique la plus haute", () => {
  assert.deepEqual(computeStats(200, { ...base, force: 400, chance: 300, agilite: 100 }, []).elements, ["Terre", "Eau"]);
  assert.deepEqual(computeStats(200, base, []).elements, ["Neutre"]);
});
