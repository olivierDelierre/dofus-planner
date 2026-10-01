import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { deleteCharacter, loadTeam, updateCharacter } from "@/lib/storage";
import { CharacterInputSchema } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = authed<Ctx>(async (req, _profile, { params }) => {
  const { id } = await params;
  const parsed = CharacterInputSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Personnage invalide", 400, parsed.error.issues);
  // L'équipe est partagée : tout profil peut modifier, on conserve le créateur d'origine.
  const existing = (await loadTeam()).find((c) => c.id === id);
  if (!existing) return jsonError("Personnage introuvable", 404);
  const updated = await updateCharacter(id, { ...parsed.data, owner: existing.owner });
  return updated ? NextResponse.json(updated) : jsonError("Personnage introuvable", 404);
});

export const DELETE = authed<Ctx>(async (_req, _profile, { params }) => {
  const { id } = await params;
  return (await deleteCharacter(id)) ? NextResponse.json({ ok: true }) : jsonError("Personnage introuvable", 404);
});
