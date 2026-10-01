import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractGuide } from "../src/lib/dpln";
import { parseDungeonIndex } from "../src/lib/dpln-index";
import { scoreGuide, searchGuides } from "../src/lib/guide-search";

const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

test("extractGuide lit de vraies pages Dofus pour les noobs (contenu dans un <form> Weebly)", () => {
  for (const [file, title] of [
    ["dpln-meulou.html", /Meulou/],
    ["dpln-larves.html", /Larves/],
  ] as const) {
    const g = extractGuide(fixture(file));
    assert.match(g.title, title);
    assert.ok(g.content.length > 2000, `${file} : ${g.content.length} caractères`);
    assert.match(g.content, /Présentation des monstres/);
    assert.doesNotMatch(g.content, /akcelo|slmadshb/);
  }
});

test("parseDungeonIndex : donjons uniquement, sans doublons", () => {
  const list = parseDungeonIndex(fixture("dpln-donjons.html"));
  assert.ok(list.length > 140, String(list.length));
  const urls = list.map((d) => d.url);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.includes("https://www.dofuspourlesnoobs.com/donjon-des-larves.html"));
  assert.ok(!urls.some((u) => /songes-infinis|raids-de-guilde|les-succes-speciaux/.test(u)));
  assert.equal(list.find((d) => d.url.endsWith("/donjon-des-larves.html"))?.label, "Larves");
});

test("recherche floue de guides", () => {
  const guides = [
    { slug: "donjon-des-larves", title: "Donjon des Larves", label: "Larves" },
    { slug: "taniere-du-meulou", title: "Tanière du Meulou", label: "Tanière du Meulou" },
    { slug: "donjon-du-comte-harebourg", title: "Donjon du Comte Harebourg", label: "Comte Harebourg" },
  ];
  assert.equal(searchGuides("Donjon des larves", guides)[0].slug, "donjon-des-larves");
  assert.equal(searchGuides("taniere meulou", guides)[0].slug, "taniere-du-meulou");
  assert.equal(searchGuides("harebourg", guides)[0].slug, "donjon-du-comte-harebourg");
  assert.equal(searchGuides("Kolosso", guides).length, 0);
  assert.equal(scoreGuide("", guides[0]), 0);
});
