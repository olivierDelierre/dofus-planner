import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, jsonError, readBody } from "@/lib/api";
import { assertDplnUrl, fetchDplnGuide } from "@/lib/dpln";
import { listGuides } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authed(async () => NextResponse.json(await listGuides()));

const ScrapeSchema = z.object({ url: z.string().url(), refresh: z.boolean().optional() });

export const POST = authed(async (req) => {
  const parsed = ScrapeSchema.safeParse(await readBody(req));
  if (!parsed.success) return jsonError("URL invalide", 400);
  try {
    assertDplnUrl(parsed.data.url);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "URL invalide", 400);
  }
  try {
    const { content, ...meta } = await fetchDplnGuide(parsed.data.url, { refresh: parsed.data.refresh });
    return NextResponse.json({ ...meta, length: content.length });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err), 502);
  }
});
