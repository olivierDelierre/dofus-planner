"use client";

import { useEffect, useState } from "react";
import type { GuideFile } from "@/lib/types";

type GuideMeta = Omit<GuideFile, "content">;

export function GuidesPanel() {
  const [guides, setGuides] = useState<GuideMeta[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sync, setSync] = useState<{ message: string; done: number; total: number } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

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

  /** Synchronise les donjons manquants (flux NDJSON de progression). */
  async function syncDungeons(refresh = false) {
    setBusy(true);
    setError(null);
    setSyncResult(null);
    setSync({ message: "Lecture de l'index des donjons…", done: 0, total: 0 });
    try {
      const res = await fetch("/api/guides/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter((l) => l.trim())) {
          const ev = JSON.parse(line);
          if (ev.type === "progress") setSync({ message: ev.message, done: ev.done, total: ev.total });
          else if (ev.type === "error") throw new Error(ev.error);
          else if (ev.type === "done") {
            setSyncResult(
              `${ev.fetched} récupérés, ${ev.skipped} déjà en base, ${ev.failed.length} erreur(s)` +
                (ev.short.length ? ` · très courts : ${ev.short.join(", ")}` : ""),
            );
          }
        }
      }
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setSync(null);
    }
  }

  const shown = guides.filter((g) => `${g.label ?? ""} ${g.title}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const dungeonCount = guides.filter((g) => g.kind === "donjon").length;

  return (
    <section className="card">
      <h2>Guides Dofus pour les noobs</h2>
      <p className="muted">
        {guides.length} guides en base ({dungeonCount} donjons). Claude les lit directement ; il sauvegarde aussi
        tout seul ceux qu&apos;il va chercher. Tu peux en ajouter à la main.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => syncDungeons(false)} disabled={busy}>
          {sync ? `Synchronisation ${sync.done}/${sync.total}…` : "⬇ Synchroniser les donjons"}
        </button>
      </div>
      {sync && <p className="muted small-note">{sync.message}</p>}
      {syncResult && <p className="muted small-note">✓ {syncResult}</p>}
      <div className="stack">
        <input
          inputMode="url"
          placeholder="https://www.dofuspourlesnoobs.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn primary block" onClick={() => scrape(url)} disabled={busy || !url}>
          {busy ? "Récupération…" : "Récupérer le guide"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {guides.length > 8 && (
        <input
          type="search"
          placeholder="Filtrer les guides…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ marginTop: 12 }}
        />
      )}
      {guides.length === 0 ? (
        <div className="empty">
          <span className="icon">📚</span>
          Aucun guide sauvegardé pour l&apos;instant.
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {shown.map((g) => (
            <div className="list-item" key={g.slug}>
              <div className="info">
                <a href={g.url} target="_blank" rel="noreferrer">
                  {g.label ?? g.title}
                </a>
                <div className="muted">Récupéré le {new Date(g.fetchedAt).toLocaleDateString("fr-FR")}</div>
              </div>
              <button className="btn small" onClick={() => scrape(g.url, true)} disabled={busy} aria-label="Rafraîchir">
                ↻
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
