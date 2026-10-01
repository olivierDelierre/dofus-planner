import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDplnUrl, extractGuide, slugFromUrl } from "../src/lib/dpln";

const HTML = `<!doctype html><html><head><title>Donjon des Bouftous - DPLN</title></head><body>
<div id="navigation"><ul><li>Accueil</li><li>Donjons</li></ul></div>
<div id="wsite-content">
  <h2>Donjon des Bouftous</h2>
  <div class="paragraph">Niveau conseillé : 30<br>Accès : Astrub</div>
  <h3>Le Bouftou Royal</h3>
  <ul><li><p>Résistant <strong>Terre</strong></p></li><li>Faible Feu</li></ul>
  <table><tr><th>Monstre</th><th>PV</th></tr><tr><td>Bouftou</td><td>120</td></tr></table>
  <img src="x.png" alt="Bouftou Royal">
  ${"<p>Texte de remplissage pour dépasser le seuil de contenu.</p>".repeat(5)}
</div>
<script>alert(1)</script>
<div class="wsite-footer">Pied de page</div>
</body></html>`;

test("extractGuide garde le contenu utile et ignore menus, scripts et pied de page", () => {
  const { title, content } = extractGuide(HTML);
  assert.equal(title, "Donjon des Bouftous - DPLN"); // pas de <h1> : repli sur <title>
  assert.match(content, /### Donjon des Bouftous/);
  assert.match(content, /Niveau conseillé : 30\nAccès : Astrub/);
  assert.match(content, /- Résistant Terre/);
  assert.match(content, /\| Bouftou \| 120 \|/);
  assert.match(content, /- Bouftou Royal/);
  assert.doesNotMatch(content, /Accueil|alert|Pied de page/);
  // Le <p> dans le <li> ne doit pas être dupliqué.
  assert.equal(content.match(/Résistant Terre/g)?.length, 1);
});

test("assertDplnUrl refuse les autres domaines", () => {
  assert.throws(() => assertDplnUrl("http://169.254.169.254/latest"));
  assert.throws(() => assertDplnUrl("https://dofuspourlesnoobs.com.evil.fr/a.html"));
  assert.throws(() => assertDplnUrl("file:///etc/passwd"));
  assert.equal(assertDplnUrl("https://www.dofuspourlesnoobs.com/a.html#x").href, "https://www.dofuspourlesnoobs.com/a.html");
});

test("slugFromUrl produit un nom de fichier sûr", () => {
  assert.equal(slugFromUrl(new URL("https://www.dofuspourlesnoobs.com/donjon-des-bouftous.html")), "donjon-des-bouftous");
  assert.equal(slugFromUrl(new URL("https://www.dofuspourlesnoobs.com/")), "index");
  assert.equal(slugFromUrl(new URL("https://www.dofuspourlesnoobs.com/%2E%2E%2Fsecret")), "2e-2e-2fsecret");
});
