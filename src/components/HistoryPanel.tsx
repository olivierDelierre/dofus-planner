"use client";

import type { PlanSummary } from "@/lib/storage";

interface Props {
  plans: PlanSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HistoryPanel({ plans, onOpen, onDelete }: Props) {
  return (
    <section className="card">
      <h2>Mes plans</h2>
      {plans.length === 0 ? (
        <p className="muted">Aucun plan généré pour l&apos;instant.</p>
      ) : (
        plans.map((p) => (
          <div className="char" key={p.id}>
            <div>
              <strong>{p.encounter}</strong> · {"★".repeat(p.stars)}
              <div className="muted">
                {new Date(p.createdAt).toLocaleString("fr-FR")} · {p.participants.join(", ")}
              </div>
            </div>
            <div className="row">
              <button onClick={() => onOpen(p.id)}>Ouvrir</button>
              <button onClick={() => confirm("Supprimer ce plan ?") && onDelete(p.id)}>Supprimer</button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
