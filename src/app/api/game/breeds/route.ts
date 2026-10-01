import { NextResponse } from "next/server";
import { authed, jsonError } from "@/lib/api";
import { getBreeds } from "@/lib/gamedata";

export const runtime = "nodejs";

export const GET = authed(async () => {
  try {
    return NextResponse.json(await getBreeds());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
