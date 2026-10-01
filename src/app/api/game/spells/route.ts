import { NextResponse } from "next/server";
import { authed, jsonError } from "@/lib/api";
import { getClassSpells } from "@/lib/gamedata";

export const runtime = "nodejs";

/** Sorts d'une classe : ?classId=8 */
export const GET = authed(async (req) => {
  const classId = Number(new URL(req.url).searchParams.get("classId"));
  if (!Number.isInteger(classId)) return jsonError("Classe requise", 400);
  try {
    return NextResponse.json(await getClassSpells(classId));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
