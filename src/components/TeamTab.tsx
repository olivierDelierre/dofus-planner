"use client";

import { useState } from "react";
import { elementClass } from "@/lib/classes";
import type { Character } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CharacterSheet } from "./CharacterSheet";

interface Props {
  team: Character[];
  onChanged: () => Promise<void>;
}

export function TeamTab({ team, onChanged }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = team.find((c) => c.id === openId) ?? null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      setUrl("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={add}>
        <h2>Ajouter un personnage</h2>
        <label>
          Lien DofusBook de l&apos;équipement
          <input
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.dofusbook.net/fr/equipement/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy || !url.trim()}>
          {busy ? "Import en cours…" : "Importer depuis DofusBook"}
        </button>
      </form>

      <section className="card">
        <div className="card-header">
          <h2>Équipe partagée</h2>
          <span className="muted">{team.length} perso{team.length > 1 ? "s" : ""}</span>
        </div>
        {team.length === 0 ? (
          <div className="empty">
            <span className="icon">🛡️</span>
            Colle un lien DofusBook ci-dessus pour ajouter ton premier personnage.
          </div>
        ) : (
          <div className="char-grid">
            {team.map((c) => (
              <button key={c.id} className="char-card" onClick={() => setOpenId(c.id)}>
                <Avatar profile={c.profile} />
                <div className="info">
                  <div className="name">{c.profile.name}</div>
                  <div className="muted">
                    {c.profile.className} · niv. {c.profile.level}
                    {c.owner ? ` · ${c.owner}` : ""}
                  </div>
                  <div className="pills">
                    {c.profile.elements.map((e) => (
                      <span key={e} className={`pill ${elementClass(e)}`}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="muted" aria-hidden>
                  ›
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {open && <CharacterSheet character={open} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </>
  );
}
