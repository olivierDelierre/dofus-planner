import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { BuildError, buildProfile } from "@/lib/builder";
import { BuildInputSchema } from "@/lib/types";

export const runtime = "nodejs";

/** Calcule la fiche (caractéristiques, effets) d'une saisie sans l'enregistrer. */
export const POST = authed(async (req) => {
  const parsed = BuildInputSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Saisie invalide", 400);
  try {
    return NextResponse.json(await buildProfile(parsed.data));
  } catch (err) {
    if (err instanceof BuildError) return jsonError(err.message, 400);
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
