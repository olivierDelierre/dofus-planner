import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { authed, jsonError } from "@/lib/api";
import { DATA_DIR } from "@/lib/storage";

export const runtime = "nodejs";

// Liste blanche : on ne va chercher que des images des API du jeu.
const ALLOWED = new Set(["api.dofusdb.fr", "api.dofusdu.de"]);
const CACHE = path.join(DATA_DIR, "cache", "img");

/** Proxy d'images avec cache disque : l'affichage ne dépend pas de ces sites une fois l'icône vue. */
export const GET = authed(async (req) => {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return jsonError("URL invalide", 400);
  }
  if (url.protocol !== "https:" || !ALLOWED.has(url.hostname) || !/\.(png|webp|jpg)$/i.test(url.pathname)) {
    return jsonError("Image non autorisée", 400);
  }
  const file = path.join(CACHE, createHash("sha1").update(url.href).digest("hex") + ".png");
  const headers = { "Content-Type": "image/png", "Cache-Control": "private, max-age=2592000, immutable" };
  try {
    return new Response(new Uint8Array(await fs.readFile(file)), { headers });
  } catch {
    // pas en cache
  }
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
    return jsonError("Image introuvable", 404);
  }
  const body = new Uint8Array(await res.arrayBuffer());
  if (body.length > 2_000_000) return jsonError("Image trop lourde", 413);
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, body);
  return new Response(body, { headers });
});
