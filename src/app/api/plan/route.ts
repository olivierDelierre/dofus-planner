import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { generatePlan } from "@/lib/planner";
import { loadTeam, savePlan } from "@/lib/storage";
import { PlanRequestSchema, type PlanRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Recherche + synthèse peuvent prendre plusieurs minutes.
export const maxDuration = 600;

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

  try {
    const result = await generatePlan(model, encounter, team);
    const record: PlanRecord = {
      id: `${Date.now()}-${randomUUID().slice(0, 8)}`,
      profileId: profile.id,
      createdAt: new Date().toISOString(),
      encounter,
      participants: team,
      result,
    };
    await savePlan(record);
    return NextResponse.json(record);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return jsonError("Clé API Anthropic absente ou invalide (ANTHROPIC_API_KEY)", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return jsonError("Limite de requêtes Anthropic atteinte, réessaie plus tard", 429);
    }
    if (err instanceof Anthropic.APIError) {
      return jsonError(`Erreur API Anthropic ${err.status} : ${err.message}`, 502);
    }
    return jsonError(err instanceof Error ? err.message : String(err), 500);
  }
});
