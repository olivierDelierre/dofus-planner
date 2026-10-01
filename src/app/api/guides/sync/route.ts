import { z } from "zod";
import { authed, jsonError, readBody } from "@/lib/api";
import { syncDungeons } from "@/lib/dpln-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SyncSchema = z.object({ refresh: z.boolean().optional() });

let running = false;

/**
 * Synchronise les guides de donjons depuis Dofus pour les noobs (≈ 3 min, 1 requête/s).
 * Flux NDJSON : { type: "progress", message, done, total } puis { type: "done", ...résumé } ou { type: "error" }.
 */
export const POST = authed(async (req) => {
  const parsed = SyncSchema.safeParse((await readBody(req)) ?? {});
  if (!parsed.success) return jsonError("Requête invalide", 400);
  if (running) return jsonError("Une synchronisation est déjà en cours", 409);
  running = true;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        const summary = await syncDungeons({
          refresh: parsed.data.refresh,
          progress: (message, done, total) => send({ type: "progress", message, done, total }),
        });
        send({ type: "done", ...summary });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        running = false;
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
});
