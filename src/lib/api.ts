import { NextResponse } from "next/server";
import { requireProfile, UnauthorizedError, type Profile } from "./auth";

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

/** Enveloppe une route qui exige un profil connecté. */
export function authed<Ctx>(handler: (req: Request, profile: Profile, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, await requireProfile(), ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) return jsonError("Non connecté", 401);
      throw err;
    }
  };
}

export async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
