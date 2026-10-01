import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { authed, jsonError, readBody } from "@/lib/api";
import { generatePlan } from "@/lib/planner";
import { loadTeam, savePlan } from "@/lib/storage";
import { PlanRequestSchema, type PlanRecord, type PlanStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Recherche + synthèse peuvent prendre plusieurs minutes.
export const maxDuration = 600;

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Clé API Anthropic absente ou invalide (ANTHROPIC_API_KEY)";
  if (err instanceof Anthropic.RateLimitError) return "Limite de requêtes Anthropic atteinte, réessaie plus tard";
  if (err instanceof Anthropic.APIError) return `Erreur API Anthropic ${err.status ?? ""} : ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Réponse en flux NDJSON (une ligne JSON par événement) : étapes d'avancement,
 * puis le plan final ou une erreur. Les erreurs de validation restent en JSON classique.
 */
export const POST = authed(async (req, profile) => {
  const parsed = PlanRequestSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Requête invalide", 400, parsed.error.issues);
  const { encounter, participantIds, model } = parsed.data;

  const env = process.env;
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN && !env.ANTHROPIC_PROFILE) {
    return jsonError("Clé API Anthropic non configurée : ajoute ANTHROPIC_API_KEY dans .env.local puis relance l'app", 500);
  }

  const team = (await loadTeam()).filter((c) => participantIds.includes(c.id));
  if (team.length === 0) return jsonError("Aucun personnage sélectionné n'existe dans l'équipe", 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Si le navigateur se déconnecte, la génération continue et le plan arrive dans l'historique.
      let open = true;
      const send = (event: PlanStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };

      try {
        const result = await generatePlan(model, encounter, team, (message) =>
          send({ type: "progress", message, at: Date.now() }),
        );
        const record: PlanRecord = {
          id: `${Date.now()}-${randomUUID().slice(0, 8)}`,
          profileId: profile.id,
          createdAt: new Date().toISOString(),
          encounter,
          participants: team,
          result,
        };
        await savePlan(record);
        send({ type: "done", record });
      } catch (err) {
        send({ type: "error", error: describeError(err) });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Empêche la mise en tampon par un éventuel reverse proxy (nginx).
      "X-Accel-Buffering": "no",
    },
  });
});
