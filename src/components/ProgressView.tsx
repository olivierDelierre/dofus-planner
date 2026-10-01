"use client";

import { useEffect, useState } from "react";

export interface ProgressStep {
  message: string;
  at: number;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Étapes de la génération en cours, avec un chrono. */
export function ProgressView({ startedAt, steps }: { startedAt: number; steps: ProgressStep[] }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="card" aria-live="polite">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          <span className="spinner" aria-hidden /> Génération en cours
        </h2>
        <span className="muted">{formatElapsed(now - startedAt)}</span>
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={i} className={i === steps.length - 1 ? "current" : "done"}>
            <span className="muted">{formatElapsed(s.at - startedAt)}</span> {s.message}
          </li>
        ))}
      </ol>
      <p className="muted">
        Tu peux fermer la page : le plan sera quand même enregistré dans « Mes plans ».
      </p>
    </section>
  );
}
