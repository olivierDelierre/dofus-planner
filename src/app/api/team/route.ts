import { NextResponse } from "next/server";
import { authed, jsonError, readBody } from "@/lib/api";
import { addCharacter, loadTeam } from "@/lib/storage";
import { CharacterInputSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authed(async () => NextResponse.json(await loadTeam()));

export const POST = authed(async (req, profile) => {
  const parsed = CharacterInputSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Personnage invalide", 400, parsed.error.issues);
  return NextResponse.json(await addCharacter({ ...parsed.data, owner: profile.name }), { status: 201 });
});
