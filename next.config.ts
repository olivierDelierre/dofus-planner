import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les routes API lisent/écrivent dans data/ : elles tournent côté Node uniquement.
  serverExternalPackages: ["cheerio"],
};

export default nextConfig;
