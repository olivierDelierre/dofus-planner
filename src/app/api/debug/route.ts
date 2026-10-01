import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, jsonError, readBody } from "@/lib/api";
import { buildReport, clearLogs, isDebugEnabled, setDebugEnabled } from "@/lib/debuglog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** État du mode debug et rapport copiable (contexte + journal, sans secrets). */
export const GET = authed(async () =>
  NextResponse.json({ enabled: await isDebugEnabled(), report: await buildReport() }),
);

const SettingSchema = z.object({ enabled: z.boolean() });

export const POST = authed(async (req) => {
  const parsed = SettingSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("Requête invalide", 400);
  await setDebugEnabled(parsed.data.enabled);
  return NextResponse.json({ enabled: parsed.data.enabled });
});

export const DELETE = authed(async () => {
  clearLogs();
  return NextResponse.json({ ok: true });
});
