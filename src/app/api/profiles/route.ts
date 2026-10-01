import { NextResponse } from "next/server";
import { z } from "zod";
import { createProfile, currentProfile, hasProfiles, listProfiles, startSession } from "@/lib/auth";
import { authed, jsonError, readBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authed(async () => NextResponse.json(await listProfiles()));

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  password: z.string().min(8),
});

/**
 * Création de profil :
 * - libre tant qu'aucun profil n'existe (premier lancement), et on connecte directement ;
 * - ensuite, seul un profil connecté peut en créer un autre (ex. pour sa femme).
 */
export async function POST(req: Request) {
  const firstRun = !(await hasProfiles());
  if (!firstRun && !(await currentProfile())) return jsonError("Non connecté", 401);

  const parsed = CreateSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Nom requis et mot de passe d'au moins 8 caractères", 400);

  try {
    const profile = await createProfile(parsed.data.name, parsed.data.password);
    if (firstRun) await startSession(profile.id);
    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Échec", 409);
  }
}
