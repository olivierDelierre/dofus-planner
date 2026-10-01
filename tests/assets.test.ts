import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { classIcon, elementIcon, statIcon } from "../src/lib/assets";

const onDisk = (url: string | undefined) => url !== undefined && existsSync(`public${url}`);

test("toutes les classes ont un symbole présent", () => {
  for (const c of ["Crâ", "Xélor", "Ecaflip", "Iop", "Forgelance", "Huppermage"]) assert.ok(onDisk(classIcon(c)), c);
  assert.equal(classIcon("Inconnue"), undefined);
});

test("icônes d'éléments et de caractéristiques", () => {
  for (const e of ["Terre", "Feu", "Eau", "Air", "Neutre"] as const) assert.ok(onDisk(elementIcon(e)), e);
  assert.ok(onDisk(statIcon("pa")));
  assert.ok(onDisk(statIcon("x", "Résistance Feu")));
  assert.equal(statIcon("pv"), undefined);
});

import { effectIcon } from "../src/lib/assets";

test("icône d'un effet d'objet d'après son texte", () => {
  for (const t of ["40 Force", "3% Critique", "6 à 10 Dommages", "-30 Esquive PA", "1 PA", "5% Résistance Feu", "9 Dommages Terre", "10 Soins", "-5 Fuite", "20 Tacle"]) {
    assert.ok(existsSync(`public${effectIcon(t)}`), t);
  }
  assert.equal(effectIcon("-15 Résistance Critiques"), undefined);
});
