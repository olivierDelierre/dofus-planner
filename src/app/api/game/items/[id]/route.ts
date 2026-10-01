import { NextResponse } from "next/server";
import { authed, jsonError } from "@/lib/api";
import { getItemDetail } from "@/lib/gamedata";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Détail d'un objet : effets avec leur fourchette de jet (min) et le jet maximum (value). */
export const GET = authed<Ctx>(async (_req, _profile, { params }) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return jsonError("Identifiant invalide", 400);
  try {
    const detail = await getItemDetail(id);
    return detail ? NextResponse.json(detail) : jsonError("Objet introuvable", 404);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
