import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { BuildError, buildProfile } from "@/lib/builder";
import { addCharacter, loadTeam } from "@/lib/storage";
import { SaveCharacterSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authed(async () => NextResponse.json(await loadTeam()));

/** Crée un personnage à partir de l'éditeur. */
export const POST = authed(async (req, profile) => {
  const parsed = SaveCharacterSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Saisie invalide", 400);
  const { build, notes } = parsed.data;
  if ((await loadTeam()).some((c) => c.profile.name.toLowerCase() === build.name.toLowerCase())) {
    return jsonError("Un personnage porte déjà ce nom dans l'équipe", 409);
  }
  try {
    const character = await addCharacter({ build, profile: await buildProfile(build), notes, owner: profile.name });
    return NextResponse.json(character, { status: 201 });
  } catch (err) {
    if (err instanceof BuildError) return jsonError(err.message, 400);
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
