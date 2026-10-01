import { NextResponse } from "next/server";
import { z } from "zod";
import { changePassword } from "@/lib/auth";
import { authed, jsonError, readBody } from "@/lib/api";

export const runtime = "nodejs";

const PasswordSchema = z.object({ current: z.string().min(1), next: z.string().min(8) });

export const POST = authed(async (req, profile) => {
  const parsed = PasswordSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Le nouveau mot de passe doit faire au moins 8 caractères", 400);
  try {
    await changePassword(profile.id, parsed.data.current, parsed.data.next);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Échec", 400);
  }
});
