"use client";

import { useEffect, useState } from "react";

/** Copie le rapport de débogage (contexte + journal) dans le presse-papiers ; renvoie le texte. */
export async function copyDebugReport(): Promise<string> {
  const res = await fetch("/api/debug");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { report } = (await res.json()) as { report: string };
  try {
    await navigator.clipboard.writeText(report);
  } catch {
    // Presse-papiers indisponible (HTTP hors localhost) : le texte est affiché pour copie manuelle.
  }
  return report;
}

/** Mode debug : interrupteur, rapport copiable, remise à zéro du journal. */
export function DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/debug")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEnabled(d.enabled))
      .catch(() => undefined);
  }, []);

  async function toggle(next: boolean) {
    setEnabled(next);
    await fetch("/api/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
  }

  async function copy() {
    setNote(null);
    try {
      const text = await copyDebugReport();
      setReport(text);
      setNote("Rapport copié. Colle-le dans la conversation (ou copie-le depuis la zone ci-dessous).");
    } catch (err) {
      setNote(`Impossible de lire le rapport : ${err instanceof Error ? err.message : err}`);
    }
  }

  async function clear() {
    await fetch("/api/debug", { method: "DELETE" });
    setReport(null);
    setNote("Journal vidé.");
  }

  return (
    <section className="debug-panel">
      <h3>Débogage</h3>
      <label className="switch-row">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        <span>
          Mode debug (traces détaillées)
          <small className="muted"> : appels aux API, outils de Claude, étapes de génération. Les erreurs sont toujours journalisées.</small>
        </span>
      </label>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={copy}>
          📋 Copier le rapport
        </button>
        <button className="btn ghost" onClick={clear}>
          Vider le journal
        </button>
      </div>
      {note && <p className="muted small-note">{note}</p>}
      {report && <textarea className="debug-report" readOnly value={report} onFocus={(e) => e.currentTarget.select()} />}
    </section>
  );
}
