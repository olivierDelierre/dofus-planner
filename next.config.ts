import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome (serveur + dépendances minimales) pour l'image Docker.
  output: "standalone",
  // Les routes API lisent/écrivent dans data/ : elles tournent côté Node uniquement.
  serverExternalPackages: ["cheerio"],
};

export default nextConfig;
