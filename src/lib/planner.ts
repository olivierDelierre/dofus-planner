/**
 * Génération du plan de combat avec Claude, en deux phases :
 *
 * 1. Recherche (tool runner) : Claude consulte les guides locaux, cherche/scrape
 *    Dofus pour les noobs et interroge les API de données. Il rend des notes factuelles.
 * 2. Synthèse (sortie structurée) : à partir des notes, de l'équipe et du score de base,
 *    Claude produit le plan au format PlanSchema.
 *
 * Séparer les deux phases garde la sortie JSON fiable même quand la recherche est longue.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat, betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fetchDplnGuide } from "./dpln";
import { searchDungeons, searchEquipment, searchMonsters, searchSets, toToolResult } from "./gamedata";
import { clampStars, baselineScore } from "./score";
import { listGuides, loadGuide } from "./storage";
import { PlanSchema, type Character, type Encounter, type ModelId, type PlanResponse } from "./types";

// Créé à la première utilisation : l'app démarre même sans clé configurée.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  return (client ??= new Anthropic());
}

// Repli serveur si un classifieur de sécurité refuse la requête (faux positifs possibles).
const FALLBACK_PARAMS = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

/** Reçoit les étapes lisibles de la génération, pour l'affichage de l'avancement. */
export type ProgressFn = (message: string) => void;

/**
 * Exécute un outil : signale l'étape, et renvoie l'erreur à Claude plutôt que de faire
 * échouer la boucle.
 */
function step<T>(progress: ProgressFn, label: (input: T) => string, fn: (input: T) => Promise<string>) {
  return async (input: T): Promise<string> => {
    progress(label(input));
    try {
      return await fn(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      progress(`⚠ ${message}`);
      return `ERREUR : ${message}`;
    }
  };
}

function makeResearchTools(progress: ProgressFn) {
  return [
    betaZodTool({
      name: "list_local_guides",
      description:
        "Liste les guides Dofus pour les noobs déjà sauvegardés en local (slug, titre, URL, date). À appeler en premier.",
      inputSchema: z.object({}),
      run: step(progress, () => "Consultation des guides locaux", async () => JSON.stringify(await listGuides())),
    }),
    betaZodTool({
      name: "read_local_guide",
      description: "Lit le contenu complet d'un guide local à partir de son slug.",
      inputSchema: z.object({ slug: z.string() }),
      run: step(
        progress,
        ({ slug }) => `Lecture du guide local « ${slug} »`,
        async ({ slug }) => {
          const guide = await loadGuide(slug);
          return guide ? `# ${guide.title}\nSource : ${guide.url}\n\n${guide.content}` : "Guide introuvable.";
        },
      ),
    }),
    betaZodTool({
      name: "fetch_dpln_guide",
      description:
        "Scrape une page de dofuspourlesnoobs.com, la sauvegarde en local pour les prochaines fois et renvoie son contenu. " +
        "Utiliser une URL trouvée via web_search ou fournie par l'utilisateur.",
      inputSchema: z.object({
        url: z.string().describe("URL complète sur dofuspourlesnoobs.com"),
        refresh: z.boolean().optional().describe("Forcer un nouveau scraping même si le guide existe en local"),
      }),
      run: step(
        progress,
        ({ url }) => `Récupération du guide ${url}`,
        async ({ url, refresh }) => {
          const guide = await fetchDplnGuide(url, { refresh });
          return `# ${guide.title}\nSource : ${guide.url} (récupéré le ${guide.fetchedAt})\n\n${guide.content}`;
        },
      ),
    }),
    betaZodTool({
      name: "search_monsters",
      description: "Cherche des monstres Dofus 3 par nom (DofusDB) : niveaux, PV, résistances, sorts.",
      inputSchema: z.object({ query: z.string() }),
      run: step(
        progress,
        ({ query }) => `Recherche du monstre « ${query} »`,
        async ({ query }) => toToolResult(await searchMonsters(query)),
      ),
    }),
    betaZodTool({
      name: "search_dungeons",
      description: "Cherche un donjon Dofus 3 par nom (DofusDB) : niveau, salles, monstres.",
      inputSchema: z.object({ query: z.string() }),
      run: step(
        progress,
        ({ query }) => `Recherche du donjon « ${query} »`,
        async ({ query }) => toToolResult(await searchDungeons(query)),
      ),
    }),
    betaZodTool({
      name: "search_equipment",
      description: "Cherche un équipement Dofus 3 par nom (DofusDude) : niveau, effets, conditions.",
      inputSchema: z.object({ query: z.string() }),
      run: step(
        progress,
        ({ query }) => `Recherche de l'équipement « ${query} »`,
        async ({ query }) => toToolResult(await searchEquipment(query)),
      ),
    }),
    betaZodTool({
      name: "search_sets",
      description: "Cherche une panoplie Dofus 3 par nom (DofusDude) : items et bonus.",
      inputSchema: z.object({ query: z.string() }),
      run: step(
        progress,
        ({ query }) => `Recherche de la panoplie « ${query} »`,
        async ({ query }) => toToolResult(await searchSets(query)),
      ),
    }),
  ];
}

const RESEARCH_SYSTEM = `Tu prépares un combat dans Dofus 3 (version Unity). Ton travail dans cette phase est uniquement de rassembler des faits fiables.

Démarche :
1. Regarde d'abord les guides locaux (list_local_guides). S'il en existe un pour ce combat, lis-le.
2. Sinon, trouve la page correspondante sur dofuspourlesnoobs.com avec web_search, puis récupère-la avec fetch_dpln_guide pour qu'elle soit sauvegardée.
3. Complète avec les API (monstres, donjon, équipements) quand c'est utile pour les résistances, PV et niveaux.

Termine par des notes de recherche en français : niveau du combat, salles, monstres et boss (résistances, sorts dangereux), mécaniques obligatoires, stratégies recommandées par le guide, et sources utilisées.
Distingue clairement ce qui vient des sources et ce que tu supposes. Si une source échoue, dis-le au lieu d'inventer.`;

const PLAN_SYSTEM = `Tu es un joueur expert de Dofus 3 qui conseille une équipe avant un combat.
Appuie-toi en priorité sur les notes de recherche fournies ; quand tu utilises tes connaissances générales du jeu, reste prudent car les sorts changent à chaque mise à jour.
Pour chaque personnage, propose des changements concrets (variantes de sorts, éléments, stuff, caractéristiques, consommables) et explique pourquoi pour CE combat. Si le personnage est déjà adapté, dis-le avec peu de changements.
Le score de confiance part du score de base fourni : écarte-t'en seulement avec une justification (mécanique punitive, équipe très adaptée, etc.).
Liste honnêtement les informations manquantes. Réponds en français.`;

function describeTeam(team: Character[]): string {
  return team
    .map((c) =>
      [
        `- ${c.name} : ${c.class} niveau ${c.level}, éléments ${c.elements.join("/") || "non précisés"}`,
        c.stuff ? `  Stuff : ${c.stuff}` : null,
        c.spells ? `  Sorts : ${c.spells}` : null,
        c.notes ? `  Notes : ${c.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

function describeEncounter(e: Encounter): string {
  return [
    `Combat : ${e.name} (${e.kind})`,
    e.level ? `Niveau indiqué par le joueur : ${e.level}` : null,
    e.guideUrl ? `Guide fourni par le joueur : ${e.guideUrl}` : null,
    e.notes ? `Notes du joueur : ${e.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function research(
  model: ModelId,
  encounter: Encounter,
  team: Character[],
  progress: ProgressFn,
): Promise<string> {
  const runner = getClient().beta.messages.toolRunner({
    model,
    max_tokens: 16000,
    max_iterations: 15,
    output_config: { effort: "medium" },
    ...FALLBACK_PARAMS,
    system: RESEARCH_SYSTEM,
    tools: [
      ...makeResearchTools(progress),
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 3,
        allowed_domains: ["dofuspourlesnoobs.com"],
      },
    ],
    messages: [
      {
        role: "user",
        content: `${describeEncounter(encounter)}\n\nÉquipe qui participera (pour orienter la recherche) :\n${describeTeam(team)}`,
      },
    ],
  });

  // Le runner ne relance pas seul un tour serveur en pause (web_search) : on le fait.
  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const query = (block.input as { query?: unknown }).query;
        progress(`Recherche web sur Dofus pour les noobs : « ${typeof query === "string" ? query : "…"} »`);
      }
    }
    if (message.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: message.content });
    }
  }
  const final = await runner.done();
  if (final.stop_reason === "refusal") throw new Error("La recherche a été refusée par le modèle.");
  return textOf(final.content) || "Aucune note de recherche produite.";
}

export async function generatePlan(
  model: ModelId,
  encounter: Encounter,
  team: Character[],
  progress: ProgressFn = () => {},
): Promise<PlanResponse> {
  const baseline = baselineScore(team, encounter);
  progress(`Score de base : ${baseline.stars}/5`);
  progress("Recherche des informations sur le combat");
  const notes = await research(model, encounter, team, progress);

  progress("Rédaction du plan et des conseils par personnage");
  const response = await getClient().beta.messages.parse({
    model,
    max_tokens: 16000,
    ...FALLBACK_PARAMS,
    output_config: { effort: "high", format: betaZodOutputFormat(PlanSchema) },
    system: PLAN_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          describeEncounter(encounter),
          `## Équipe\n${describeTeam(team)}`,
          `## Score de base : ${baseline.stars}/5\n${baseline.factors.map((f) => `- ${f}`).join("\n")}`,
          `## Notes de recherche\n${notes}`,
        ].join("\n\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("La génération du plan a été refusée par le modèle.");
  if (response.stop_reason === "max_tokens") throw new Error("Le plan a été tronqué (max_tokens atteint).");
  const plan = response.parsed_output;
  if (!plan) throw new Error("Réponse de Claude illisible (JSON invalide).");

  plan.confidence.stars = clampStars(plan.confidence.stars);
  return { plan, baseline, research: notes, model, servedBy: response.model };
}
