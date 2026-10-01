"use client";

import { useEffect, useState } from "react";
import { MODELS, type Character, type Encounter, type ModelId, type PlanRecord, type PlanStreamEvent } from "@/lib/types";
import { Avatar } from "./Avatar";
import { copyDebugReport } from "./DebugPanel";
import { PlanView } from "./PlanView";
import { ProgressView, type ProgressStep } from "./ProgressView";

// Suggestions de repli ; la liste réelle vient des guides locaux. On peut saisir n'importe quel combat.
const FALLBACK_SUGGESTIONS = ["Bandits de Cania"];

const KINDS: { id: Encounter["kind"]; label: string }[] = [
  { id: "donjon", label: "Donjon" },
  { id: "quete", label: "Quête" },
  { id: "autre", label: "Autre" },
];

interface Props {
  team: Character[];
  onUnauthorized: () => void;
  onPlanSaved: () => Promise<void>;
  onGoToTeam: () => void;
}

export function CombatTab({ team, onUnauthorized, onPlanSaved, onGoToTeam }: Props) {
  const [encounter, setEncounter] = useState<Encounter>({ name: "", kind: "donjon" });
  const [participants, setParticipants] = useState<string[]>([]);
  const [model, setModel] = useState<ModelId>("claude-opus-5-5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<PlanRecord | null>(null);
  const [progress, setProgress] = useState<{ startedAt: number; steps: ProgressStep[] } | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);

  // Noms des guides locaux (tous les donjons) pour l'autocomplétion.
  useEffect(() => {
    fetch("/api/guides")
      .then((r) => (r.ok ? r.json() : []))
      .then((guides: { title: string; label?: string }[]) => {
        const names = guides.map((g) => g.label ?? g.title);
        setSuggestions([...new Set([...names, ...FALLBACK_SUGGESTIONS])].sort((a, b) => a.localeCompare(b, "fr")));
      })
      .catch(() => undefined);
  }, []);

  // Retire de la sélection les persos supprimés par un autre profil.
  useEffect(() => {
    setParticipants((ids) => ids.filter((id) => team.some((c) => c.id === id)));
  }, [team]);

  async function generate() {
    setBusy(true);
    setError(null);
    setCurrent(null);
    setProgress({ startedAt: Date.now(), steps: [{ message: "Envoi de la demande", at: Date.now() }] });
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounter, participantIds: participants, model }),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      // Flux NDJSON : une ligne JSON par événement.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as PlanStreamEvent;
          if (event.type === "progress") {
            setProgress((p) => p && { ...p, steps: [...p.steps, { message: event.message, at: event.at }] });
          } else if (event.type === "done") {
            finished = true;
            setCurrent(event.record);
          } else {
            finished = true;
            throw new Error(event.error);
          }
        }
      }
      if (!finished) throw new Error("Connexion interrompue : le plan apparaîtra dans « Plans » s'il aboutit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
      await onPlanSaved();
    }
  }

  const toggle = (id: string) =>
    setParticipants((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  const canGenerate = encounter.name.trim() && participants.length > 0 && !busy;

  return (
    <>
      <section className="card stack">
        <h2>Quel combat ?</h2>
        <label>
          Donjon ou combat
          <input
            list="encounters"
            placeholder="Ex. : Bandits de Cania"
            value={encounter.name}
            onChange={(e) => setEncounter({ ...encounter, name: e.target.value })}
          />
          <datalist id="encounters">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <div className="segmented" role="group" aria-label="Type de combat">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={encounter.kind === k.id}
              onClick={() => setEncounter({ ...encounter, kind: k.id })}
            >
              {k.label}
            </button>
          ))}
        </div>
        <details open={!!encounter.lookup}>
          <summary>Combat introuvable ? Décris-le à Claude</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <label>
              Que doit chercher Claude ?
              <textarea
                placeholder="Ex. : le boss de la quête « … » à Pandala, niveau ~150, on ne trouve pas son nom exact"
                maxLength={1000}
                value={encounter.lookup ?? ""}
                onChange={(e) => setEncounter({ ...encounter, lookup: e.target.value || undefined })}
              />
            </label>
            <p className="muted small-note">
              Claude cherche d&apos;abord dans la base locale et sur Dofus pour les noobs, puis sur le web. Les infos
              venant d&apos;ailleurs sont marquées « non vérifié ».
            </p>
          </div>
        </details>
        <details>
          <summary>Options (niveau, guide, notes)</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <label>
              Niveau du combat
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                placeholder="Inconnu : Claude le cherche"
                value={encounter.level ?? ""}
                onChange={(e) =>
                  setEncounter({ ...encounter, level: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </label>
            <label>
              Guide Dofus pour les noobs
              <input
                inputMode="url"
                placeholder="https://www.dofuspourlesnoobs.com/…"
                value={encounter.guideUrl ?? ""}
                onChange={(e) => setEncounter({ ...encounter, guideUrl: e.target.value || undefined })}
              />
            </label>
            <label>
              Notes pour Claude
              <textarea
                placeholder="Ex. : on bloque toujours au boss…"
                value={encounter.notes ?? ""}
                onChange={(e) => setEncounter({ ...encounter, notes: e.target.value || undefined })}
              />
            </label>
          </div>
        </details>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Qui participe ?</h2>
          <span className="muted">{participants.length} sélectionné{participants.length > 1 ? "s" : ""}</span>
        </div>
        {team.length === 0 ? (
          <div className="empty">
            <span className="icon">🛡️</span>
            Aucun personnage pour l&apos;instant.
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={onGoToTeam}>
                Ajouter des personnages
              </button>
            </div>
          </div>
        ) : (
          <div className="chooser">
            {team.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={participants.includes(c.id)}
                onClick={() => toggle(c.id)}
              >
                <Avatar profile={c.profile} />
                <span className="label">
                  <strong>{c.profile.name}</strong>
                  <span className="muted">
                    {c.profile.className} {c.profile.level}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <h3>Modèle</h3>
        <div className="segmented" role="group" aria-label="Modèle Claude">
          {MODELS.map((m) => (
            <button key={m.id} type="button" aria-pressed={model === m.id} onClick={() => setModel(m.id)}>
              {m.label}
              <span className="muted" style={{ display: "block", fontSize: 11, fontWeight: 500 }}>
                {m.hint}
              </span>
            </button>
          ))}
        </div>
        <button className="btn primary block" style={{ marginTop: 16 }} onClick={generate} disabled={!canGenerate}>
          {busy ? "Analyse en cours…" : "✨ Générer le plan"}
        </button>
        {error && (
          <div className="error">
            <p style={{ margin: 0 }}>{error}</p>
            <button
              type="button"
              className="btn small"
              style={{ marginTop: 8 }}
              onClick={async () => {
                try {
                  await copyDebugReport();
                  setError(`${error}\n(Rapport de débogage copié : colle-le dans la conversation.)`);
                } catch {
                  // rapport indisponible : l'erreur reste affichée
                }
              }}
            >
              📋 Copier le rapport de debug
            </button>
          </div>
        )}
      </section>

      {progress && <ProgressView startedAt={progress.startedAt} steps={progress.steps} />}
      {current && <PlanView record={current} />}
    </>
  );
}
