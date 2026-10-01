/**
 * Faux serveur Anthropic pour tester la génération sans clé API ni coût.
 *
 *   node scripts/dev/mock-anthropic.mjs        # écoute sur :4010
 *   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:4010 npm start
 *
 * Phase recherche : 1er appel -> tool_use (find_local_guides + read_local_guide + get_class_spells), 2e appel -> notes.
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
    const last = p.messages[p.messages.length - 1];
    if (p.messages.length === 1) console.log("PROMPT", typeof last.content === "string" ? last.content.slice(0, 600) : "", "| web_search:", JSON.stringify(p.tools?.find((t) => t.name === "web_search")));
    if (p.messages.length === 1 && typeof last.content === "string") {
      const i = last.content.indexOf("Sorts (");
      if (i >= 0) console.log("SORTS", last.content.slice(i, i + 700));
    }
    if (Array.isArray(last.content)) for (const b of last.content) if (b.type === "tool_result") console.log("TOOL_RESULT", JSON.stringify(b.content).slice(0, 160));
    console.log("REQ", req.url, "beta:", req.headers["anthropic-beta"], "fallbacks:", JSON.stringify(p.fallbacks), "format:", !!p.output_config?.format, "msgs:", p.messages.length);
    let out;
    if (p.output_config?.format) out = msg([{ type: "text", text: JSON.stringify(plan) }], "end_turn");
    else if (p.messages.length === 1) out = msg([{ type: "tool_use", id: "toolu_1", name: "find_local_guides", input: { query: "Donjon des Larves" } }, { type: "tool_use", id: "toolu_2", name: "read_local_guide", input: { slug: "donjon-des-larves" } }, { type: "tool_use", id: "toolu_3", name: "get_class_spells", input: { className: "Iop" } }], "tool_use");
    else out = msg([{ type: "text", text: "Notes : bandits niveau 60." }], "end_turn");
    setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out)); }, 1500);
  });
}).listen(4010, () => console.log("mock up"));
