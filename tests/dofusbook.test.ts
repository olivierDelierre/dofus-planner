import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDofusbookUrl } from "../src/lib/dofusbook";

test("parseDofusbookUrl accepte les liens d'équipement (mobile et bureau)", () => {
  for (const url of [
    "https://www.dofusbook.net/mobile/fr/equipement/16088968-db/objets",
    "https://www.dofusbook.net/fr/equipement/16088968-db/caracteristiques",
    "  https://dofusbook.net/fr/equipement/16088968-db  ",
  ]) {
    const ref = parseDofusbookUrl(url);
    assert.equal(ref.id, "16088968-db");
    assert.equal(ref.url, "https://www.dofusbook.net/fr/equipement/16088968-db/objets");
  }
});

test("parseDofusbookUrl refuse les autres sites et les liens sans équipement", () => {
  assert.throws(() => parseDofusbookUrl("https://evil.example/fr/equipement/1-db"), /pas un lien DofusBook/);
  assert.throws(() => parseDofusbookUrl("https://dofusbook.net.evil.fr/fr/equipement/1-db"), /pas un lien DofusBook/);
  assert.throws(() => parseDofusbookUrl("https://www.dofusbook.net/fr/encyclopedie"), /non reconnu/);
  assert.throws(() => parseDofusbookUrl("pas une url"), /invalide/);
});
