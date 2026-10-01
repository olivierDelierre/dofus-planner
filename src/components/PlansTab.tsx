"use client";

import { useState } from "react";
import type { PlanSummary } from "@/lib/storage";
import type { PlanRecord } from "@/lib/types";
import { PlanView } from "./PlanView";

interface Props {
  plans: PlanSummary[];
  onChanged: () => Promise<void>;
}

export function PlansTab({ plans, onChanged }: Props) {
  const [open, setOpen] = useState<PlanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function show(id: string) {
    setError(null);
    const res = await fetch(`/api/plans/${encodeURIComponent(id)}`);
    if (res.ok) {
      setOpen(await res.json());
      window.scrollTo({ top: 0 });
    } else setError("Plan introuvable");
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce plan ?")) return;
    await fetch(`/api/plans/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (open?.id === id) setOpen(null);
    await onChanged();
  }

  if (open) {
    return (
      <>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn small" onClick={() => setOpen(null)}>
            ‹ Mes plans
          </button>
          <span className="muted">{new Date(open.createdAt).toLocaleString("fr-FR")}</span>
        </div>
        <PlanView record={open} />
      </>
    );
  }

  return (
    <section className="card">
      <h2>Mes plans</h2>
      {error && <p className="error">{error}</p>}
      {plans.length === 0 ? (
        <div className="empty">
          <span className="icon">📜</span>
          Les plans que tu génères sont enregistrés ici.
        </div>
      ) : (
        plans.map((p) => (
          <div className="list-item" key={p.id}>
            <button className="info btn ghost" style={{ justifyContent: "flex-start", textAlign: "left", flex: 1, padding: 0 }} onClick={() => show(p.id)}>
              <span>
                <strong style={{ color: "var(--text)" }}>{p.encounter}</strong>{" "}
                <span style={{ color: "var(--star)" }}>{"★".repeat(p.stars)}</span>
                <span className="muted" style={{ display: "block", fontWeight: 400 }}>
                  {new Date(p.createdAt).toLocaleDateString("fr-FR")} · {p.participants.join(", ")}
                </span>
              </span>
            </button>
            <button className="btn ghost small" aria-label="Supprimer" onClick={() => remove(p.id)}>
              🗑
            </button>
          </div>
        ))
      )}
    </section>
  );
}
