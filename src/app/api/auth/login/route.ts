import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCredentials, startSession } from "@/lib/auth";
import { jsonError, readBody } from "@/lib/api";

export const runtime = "nodejs";

const LoginSchema = z.object({ name: z.string().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = LoginSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Profil et mot de passe requis", 400);
  try {
    const profile = await checkCredentials(parsed.data.name.trim(), parsed.data.password);
    await startSession(profile.id);
    return NextResponse.json(profile);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Connexion refusée", 401);
  }
}
