import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { BuildError, buildProfile } from "@/lib/builder";
import { deleteCharacter, loadTeam, updateCharacter } from "@/lib/storage";
import { SaveCharacterSchema, UpdateNotesSchema, type Character } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Deux usages :
 * - `{ build, notes? }` : remplace le personnage (fiche recalculée) ;
 * - `{ notes }` : ne change que les notes.
 * `{ refresh: true }` recalcule la fiche à partir de la saisie enregistrée (données du jeu mises à jour).
 */
export const PUT = authed<Ctx>(async (req, _profile, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const existing = (await loadTeam()).find((c) => c.id === id);
  if (!existing) return jsonError("Personnage introuvable", 404);

  const patch: Partial<Omit<Character, "id">> = {};
  const save = SaveCharacterSchema.safeParse(body);
  const notesOnly = UpdateNotesSchema.safeParse(body);
  try {
    if (save.success) {
      patch.build = save.data.build;
      patch.profile = await buildProfile(save.data.build);
      patch.notes = save.data.notes || undefined;
    } else if (body && typeof body === "object" && (body as { refresh?: unknown }).refresh === true) {
      patch.profile = await buildProfile(existing.build);
    } else if (notesOnly.success) {
      patch.notes = notesOnly.data.notes || undefined;
    } else {
      return jsonError("Requête invalide", 400);
    }
  } catch (err) {
    if (err instanceof BuildError) return jsonError(err.message, 400);
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }

  const updated = await updateCharacter(id, async () => patch);
  return updated ? NextResponse.json(updated) : jsonError("Personnage introuvable", 404);
});

export const DELETE = authed<Ctx>(async (_req, _profile, { params }) => {
  const { id } = await params;
  return (await deleteCharacter(id)) ? NextResponse.json({ ok: true }) : jsonError("Personnage introuvable", 404);
});
