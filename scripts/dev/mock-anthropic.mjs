/**
 * Faux serveur Anthropic pour tester la génération sans clé API ni coût.
 *
 *   node scripts/dev/mock-anthropic.mjs        # écoute sur :4010
 *   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:4010 npm start
 *
 * Phase recherche : 1er appel -> tool_use (list_local_guides + search_monsters), 2e appel -> notes.
 * Phase plan (requête avec output_config.format) -> JSON de plan fixe (stars: 7 pour tester le bornage).
 * Chaque réponse attend 1,5 s pour voir l'avancement en direct.
 */
import http from "node:http";

const plan = {
  encounterSummary: { name: "Bandits de Cania", level: "60", keyMechanics: ["Tuer les bandits un par un"], monsters: [{ name: "Bandit", role: "dégâts", weaknesses: "Feu", threats: "Gros coups au CàC" }] },
  characters: [{ name: "Iopette", role: "dégâts", changes: [{ category: "sort", change: "Prendre Colère", why: "Burst" }], keySpells: ["Colère"] }],
  strategy: { overview: "Focus", preparation: ["Pain"], placement: "Derrière", phases: [{ title: "Tour 1", steps: ["Boost"] }], dangers: ["Lignes de vue"] },
  confidence: { stars: 7, reasoning: "Très au-dessus" },
  missingInfo: [],
  sources: ["mock"],
};

const msg = (content, stop_reason) => ({
  id: "msg_" + Math.random().toString(36).slice(2), type: "message", role: "assistant", model: "mock-model",
  content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
});

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const p = JSON.parse(body);
    console.log("REQ", req.url, "beta:", req.headers["anthropic-beta"], "fallbacks:", JSON.stringify(p.fallbacks), "format:", !!p.output_config?.format, "msgs:", p.messages.length);
    let out;
    if (p.output_config?.format) out = msg([{ type: "text", text: JSON.stringify(plan) }], "end_turn");
    else if (p.messages.length === 1) out = msg([{ type: "tool_use", id: "toolu_1", name: "list_local_guides", input: {} }, { type: "tool_use", id: "toolu_2", name: "search_monsters", input: { query: "Bandit" } }], "tool_use");
    else out = msg([{ type: "text", text: "Notes : bandits niveau 60." }], "end_turn");
    setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out)); }, 1500);
  });
}).listen(4010, () => console.log("mock up"));
