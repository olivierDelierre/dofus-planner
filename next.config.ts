import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/** Identifiant de version affiché dans le menu Compte : commit git, sinon date du build (image Docker sans .git). */
function buildId(): string {
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  try {
    const hash = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return `${hash} · ${date}`;
  } catch {
    return date;
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId() },
  // Build autonome (serveur + dépendances minimales) pour l'image Docker.
  output: "standalone",
  // Les routes API lisent/écrivent dans data/ : elles tournent côté Node uniquement.
  serverExternalPackages: ["cheerio"],
};

export default nextConfig;
