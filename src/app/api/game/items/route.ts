import { NextResponse } from "next/server";
import { authed, jsonError } from "@/lib/api";
import { searchItems } from "@/lib/gamedata";
import { SLOTS } from "@/lib/types";

export const runtime = "nodejs";

/** Recherche d'objets pour un emplacement : ?slot=Chapeau&q=coiffe&maxLevel=100 */
export const GET = authed(async (req) => {
  const url = new URL(req.url);
  const slot = url.searchParams.get("slot") ?? "";
  if (!(SLOTS as readonly string[]).includes(slot)) return jsonError("Emplacement inconnu", 400);
  const maxLevel = Number(url.searchParams.get("maxLevel")) || undefined;
  try {
    return NextResponse.json(await searchItems(slot, url.searchParams.get("q") ?? "", maxLevel));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
