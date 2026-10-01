import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { fetchDofusbookProfile, parseDofusbookUrl } from "@/lib/dofusbook";
import { addCharacter, loadTeam } from "@/lib/storage";
import { AddCharacterSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authed(async () => NextResponse.json(await loadTeam()));

/** Ajoute un personnage à partir d'un lien DofusBook. */
export const POST = authed(async (req, profile) => {
  const parsed = AddCharacterSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Lien DofusBook requis", 400);

  let ref;
  try {
    ref = parseDofusbookUrl(parsed.data.url);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Lien invalide", 400);
  }
  if ((await loadTeam()).some((c) => c.profile.sourceId === ref.id)) {
    return jsonError("Ce personnage est déjà dans l'équipe", 409);
  }

  try {
    const dofusbook = await fetchDofusbookProfile(ref.url);
    const character = await addCharacter({
      dofusbookUrl: ref.url,
      profile: dofusbook,
      notes: parsed.data.notes,
      owner: profile.name,
    });
    return NextResponse.json(character, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
