"use client";

import { useEffect, useState } from "react";
import type { GuideFile } from "@/lib/types";

type GuideMeta = Omit<GuideFile, "content">;

export function GuidesPanel() {
  const [guides, setGuides] = useState<GuideMeta[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshList() {
    const res = await fetch("/api/guides");
    if (res.ok) setGuides(await res.json());
  }

  useEffect(() => {
    refreshList();
  }, []);

  async function scrape(target: string, refresh = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, refresh }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setUrl("");
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Guides locaux (Dofus pour les noobs)</h2>
      <p className="muted">
        Claude cherche et sauvegarde les guides tout seul pendant la génération. Tu peux aussi en ajouter à la main.
      </p>
      <div className="row">
        <input
          style={{ flex: 1, minWidth: 0 }}
          placeholder="https://www.dofuspourlesnoobs.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={() => scrape(url)} disabled={busy || !url}>
          {busy ? "Scraping…" : "Scraper"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {guides.length === 0 ? (
        <p className="muted">Aucun guide sauvegardé pour l&apos;instant.</p>
      ) : (
        <ul>
          {guides.map((g) => (
            <li key={g.slug}>
              <a href={g.url} target="_blank" rel="noreferrer">
                {g.title}
              </a>{" "}
              <span className="muted">· {new Date(g.fetchedAt).toLocaleDateString("fr-FR")}</span>{" "}
              <button onClick={() => scrape(g.url, true)} disabled={busy}>
                Rafraîchir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
