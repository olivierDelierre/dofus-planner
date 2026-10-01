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

import { setBonusFor } from "../src/lib/gamedata";

test("bonus de panoplie : entrée exacte, sinon la plus haute en dessous", () => {
  const set = { bonuses: { 2: [{ label: "Force", value: 40, text: "40 Force" }], 4: [{ label: "PA", value: 1, text: "1 PA" }] } };
  assert.deepEqual(setBonusFor(set, 1), []);
  assert.equal(setBonusFor(set, 2)[0].label, "Force");
  assert.equal(setBonusFor(set, 3)[0].label, "Force");
  assert.equal(setBonusFor(set, 8)[0].label, "PA");
});

import { buildSpells } from "../src/lib/builder";
import { spellGrade } from "../src/lib/spells";
import { BuildInputSchema } from "../src/lib/types";

const g = (grade: number, minLevel: number) => ({ grade, minLevel, apCost: 3, minRange: 1, range: 4, cooldown: 0, maxPerTurn: 0, crit: 0 });
const version = (id: number, name: string, levels: number[]) => ({
  id, name, description: `${name} : description`, icon: `https://x/${id}.png`, grades: levels.map((l, i) => g(i + 1, l)),
});

test("grade d'un sort déduit du niveau du personnage", () => {
  const grades = [g(1, 1), g(2, 66), g(3, 132)];
  assert.equal(spellGrade(grades, 1), 1);
  assert.equal(spellGrade(grades, 65), 1);
  assert.equal(spellGrade(grades, 66), 2);
  assert.equal(spellGrade(grades, 131), 2);
  assert.equal(spellGrade(grades, 200), 3);
  assert.equal(spellGrade([g(1, 100)], 50), 0);
});

test("variantes : choix respecté, repli sur la base si la variante n'est pas débloquée", () => {
  const spells = [
    { id: 1, base: version(1, "Pression", [1, 66, 132]), variant: version(11, "Accumulation", [110, 177]) },
    { id: 2, base: version(2, "Bond", [10, 77]), variant: null },
  ];
  const at70 = buildSpells(spells, [{ id: 1, variant: true }], 70);
  assert.equal(at70[0].name, "Pression"); // variante verrouillée avant le niveau 110
  assert.equal(at70[0].level, 2);
  assert.equal(at70[0].alt?.name, "Accumulation");
  const at120 = buildSpells(spells, [{ id: 1, variant: true }], 120);
  assert.equal(at120[0].name, "Accumulation");
  assert.equal(at120[0].variant, true);
  assert.equal(at120[0].baseId, 1);
  assert.equal(at120[0].level, 1);
  assert.equal(at120[0].alt?.name, "Pression");
  assert.equal(buildSpells(spells, [], 5)[1].level, 0); // Bond pas encore appris
  assert.equal(buildSpells(spells, [], 5)[1].unlockedAt, 10);
});

test("anciennes saisies de sorts { id, level } toujours valides", () => {
  const input = {
    name: "A", classId: 8, gender: "m", level: 200,
    base: { vitalite: 0, sagesse: 0, force: 0, intelligence: 0, chance: 0, agilite: 0 },
    items: [], spells: [{ id: 5, level: 2 }],
  };
  const parsed = BuildInputSchema.parse(input);
  assert.equal(parsed.spells[0].variant, false);
});
