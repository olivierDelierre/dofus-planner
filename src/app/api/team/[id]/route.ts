import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { fetchDofusbookProfile } from "@/lib/dofusbook";
import { deleteCharacter, loadTeam, updateCharacter } from "@/lib/storage";
import { UpdateCharacterSchema, type Character } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Met à jour les notes et/ou resynchronise la fiche depuis DofusBook. */
export const PUT = authed<Ctx>(async (req, _profile, { params }) => {
  const { id } = await params;
  const parsed = UpdateCharacterSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Requête invalide", 400);

  const existing = (await loadTeam()).find((c) => c.id === id);
  if (!existing) return jsonError("Personnage introuvable", 404);

  const patch: Partial<Omit<Character, "id">> = {};
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes || undefined;
  if (parsed.data.refresh) {
    // Téléchargement hors du verrou du fichier d'équipe.
    try {
      patch.profile = await fetchDofusbookProfile(existing.dofusbookUrl);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : String(err), 502);
    }
  }

  const updated = await updateCharacter(id, async () => patch);
  return updated ? NextResponse.json(updated) : jsonError("Personnage introuvable", 404);
});

export const DELETE = authed<Ctx>(async (_req, _profile, { params }) => {
  const { id } = await params;
  return (await deleteCharacter(id)) ? NextResponse.json({ ok: true }) : jsonError("Personnage introuvable", 404);
});
