import assert from "node:assert/strict";
import { test } from "node:test";
import { baselineScore } from "../src/lib/score";
import type { DofusbookProfile } from "../src/lib/types";

type Member = Pick<DofusbookProfile, "className" | "level" | "elements">;
const char = (c: Partial<Member> & { name?: string }): Member => ({
  className: "Iop",
  level: 200,
  elements: ["Terre"],
  ...c,
});

test("équipe complète bien plus haut niveau : 5 étoiles", () => {
  const team = [
    char({ name: "a", className: "Eniripsa", elements: ["Feu"] }),
    char({ name: "b", className: "Féca" }),
    char({ name: "c" }),
  ];
  assert.equal(baselineScore(team, { name: "D", kind: "donjon", level: 100 }).stars, 5);
});

test("perso seul sous-niveau : 1 étoile", () => {
  const team = [char({ level: 50 })];
  assert.equal(baselineScore(team, { name: "D", kind: "donjon", level: 120 }).stars, 1);
});

test("niveau inconnu : base 3, ajustée par la composition", () => {
  const team = [char({ name: "a", className: "Eniripsa", elements: ["Feu"] }), char({ name: "b", className: "Sacrieur" })];
  const score = baselineScore(team, { name: "Q", kind: "quete" });
  assert.ok(score.stars >= 3);
  assert.ok(score.factors.some((f) => f.includes("inconnu")));
});
