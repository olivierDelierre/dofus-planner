import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dofus Planner",
  description: "Prépare tes donjons et combats spéciaux Dofus 3 avec Claude",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
