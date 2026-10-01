"use client";

import { useCallback, useEffect, useState } from "react";
import { GuidesPanel } from "@/components/GuidesPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { Login } from "@/components/Login";
import { PlanView } from "@/components/PlanView";
import { ProfilePanel } from "@/components/ProfilePanel";
import { TeamEditor } from "@/components/TeamEditor";
import type { Profile } from "@/lib/auth";
import type { PlanSummary } from "@/lib/storage";
import { MODELS, type Character, type Encounter, type ModelId, type PlanRecord } from "@/lib/types";

// Simples suggestions : on peut saisir n'importe quel combat.
const SUGGESTIONS = [
  "Donjon des Bouftous",
  "Donjon des Larves",
  "Donjon des Tofus",
  "Donjon des Scarafeuilles",
  "Donjon des Champs",
  "Donjon des Forgerons",
  "Bandits de Cania",
];

type AuthState = { status: "loading" } | { status: "out"; firstRun: boolean } | { status: "in"; profile: Profile };

export default function Home() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [team, setTeam] = useState<Character[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [encounter, setEncounter] = useState<Encounter>({ name: "", kind: "donjon" });
  const [participants, setParticipants] = useState<string[]>([]);
  const [model, setModel] = useState<ModelId>("claude-opus-5-5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<PlanRecord | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/auth/status");
    const body: { hasProfiles: boolean; profile: Profile | null } = await res.json();
    setAuth(body.profile ? { status: "in", profile: body.profile } : { status: "out", firstRun: !body.hasProfiles });
  }, []);

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/team");
    if (res.ok) setTeam(await res.json());
  }, []);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/plans");
    if (res.ok) setPlans(await res.json());
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (auth.status !== "in") return;
    loadTeam();
    loadPlans();
  }, [auth, loadTeam, loadPlans]);

  // Retire de la sélection les persos supprimés par un autre profil.
  useEffect(() => {
    setParticipants((ids) => ids.filter((id) => team.some((c) => c.id === id)));
  }, [team]);

  if (auth.status === "loading") return <main className="muted">Chargement…</main>;
  if (auth.status === "out") return <Login firstRun={auth.firstRun} onLoggedIn={loadStatus} />;

  async function generate() {
    setBusy(true);
    setError(null);
    setCurrent(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encounter, participantIds: participants, model }),
      });
      const body = await res.json();
      if (res.status === 401) return loadStatus();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCurrent(body);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openPlan(id: string) {
    const res = await fetch(`/api/plans/${encodeURIComponent(id)}`);
    if (res.ok) setCurrent(await res.json());
  }

  async function deletePlan(id: string) {
    await fetch(`/api/plans/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (current?.id === id) setCurrent(null);
    await loadPlans();
  }

  const canGenerate = encounter.name.trim() && participants.length > 0 && !busy;

  return (
    <main>
      <h1>Dofus Planner</h1>
      <p className="subtitle">Prépare tes donjons et combats spéciaux Dofus 3 avec Claude.</p>

      <ProfilePanel profile={auth.profile} onLoggedOut={() => setAuth({ status: "out", firstRun: false })} />
      <TeamEditor team={team} onChanged={loadTeam} />

      <section className="card">
        <h2>Combat</h2>
        <div className="grid">
          <label>
            Donjon ou combat
            <input
              list="encounters"
              value={encounter.name}
              onChange={(e) => setEncounter({ ...encounter, name: e.target.value })}
            />
            <datalist id="encounters">
              {SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            Type
            <select
              value={encounter.kind}
              onChange={(e) => setEncounter({ ...encounter, kind: e.target.value as Encounter["kind"] })}
            >
              <option value="donjon">Donjon</option>
              <option value="quete">Combat de quête</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          <label>
            Niveau (optionnel)
            <input
              type="number"
              min={1}
              max={200}
              value={encounter.level ?? ""}
              onChange={(e) =>
                setEncounter({ ...encounter, level: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </label>
          <label>
            Guide Dofus pour les noobs (optionnel)
            <input
              placeholder="https://www.dofuspourlesnoobs.com/..."
              value={encounter.guideUrl ?? ""}
              onChange={(e) => setEncounter({ ...encounter, guideUrl: e.target.value || undefined })}
            />
          </label>
        </div>
        <label style={{ marginTop: 12 }}>
          Notes pour Claude (optionnel)
          <textarea
            placeholder="Ex. : on bloque toujours au boss, on n'a pas de soigneur…"
            value={encounter.notes ?? ""}
            onChange={(e) => setEncounter({ ...encounter, notes: e.target.value || undefined })}
          />
        </label>

        <h3>Participants</h3>
        {team.length === 0 ? (
          <p className="muted">Ajoute d&apos;abord des personnages à l&apos;équipe.</p>
        ) : (
          <div className="checks">
            {team.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={participants.includes(c.id)}
                  onChange={() =>
                    setParticipants((ids) => (ids.includes(c.id) ? ids.filter((i) => i !== c.id) : [...ids, c.id]))
                  }
                />
                {c.name} ({c.class} {c.level})
              </label>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <select value={model} onChange={(e) => setModel(e.target.value as ModelId)} style={{ width: "auto" }}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button className="primary" onClick={generate} disabled={!canGenerate}>
            {busy ? "Analyse en cours (1 à 3 min)…" : "Générer le plan"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {current && <PlanView result={current.result} />}
      <HistoryPanel plans={plans} onOpen={openPlan} onDelete={deletePlan} />
      <GuidesPanel />
    </main>
  );
}
