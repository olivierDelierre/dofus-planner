"use client";

import { useEffect, useState } from "react";
import { elementClass } from "@/lib/classes";
import type { Character } from "@/lib/types";
import { Avatar } from "./Avatar";

// Caractéristiques mises en avant en tête de liste.
const KEY_STATS = new Set(["pa", "pm", "pv", "po", "vitalite"]);

interface Props {
  character: Character;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Fiche personnage en lecture seule (données DofusBook) + notes et actions. */
export function CharacterSheet({ character, onClose, onChanged }: Props) {
  const { profile: p } = character;
  const [notes, setNotes] = useState(character.notes ?? "");
  const [busy, setBusy] = useState<null | "refresh" | "notes" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function call(kind: NonNullable<typeof busy>, method: string, body?: unknown) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/team/${character.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      await onChanged();
      if (kind === "delete") onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const stats = [...p.stats].sort((a, b) => Number(KEY_STATS.has(b.key)) - Number(KEY_STATS.has(a.key)));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-hero">
          <Avatar profile={p} size="lg" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2>{p.name}</h2>
            <div className="muted">
              {p.className} · niveau {p.level}
            </div>
            <div className="pills">
              {p.elements.map((e) => (
                <span key={e} className={`pill ${elementClass(e)}`}>
                  {e}
                </span>
              ))}
            </div>
          </div>
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <h3>Équipement</h3>
        {p.items.length === 0 ? (
          <p className="muted">Aucun équipement.</p>
        ) : (
          <div className="slots">
            {p.items.map((item, i) => (
              <div className="slot" key={`${item.slot}-${i}`}>
                {item.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.icon} alt="" loading="lazy" />
                ) : (
                  <span className="ph">◆</span>
                )}
                <div className="label">
                  <strong>{item.name}</strong>
                  <span className="muted">
                    {item.slot}
                    {item.level ? ` · niv. ${item.level}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3>Caractéristiques</h3>
        <div className="stats">
          {stats.map((s) => (
            <div key={s.key} className={KEY_STATS.has(s.key) ? "stat key" : "stat"}>
              <span className="muted">{s.label}</span>
              <span className="v">{s.value}</span>
            </div>
          ))}
        </div>

        {p.spells.length > 0 && (
          <>
            <h3>Sorts</h3>
            <div className="slots">
              {p.spells.map((s, i) => (
                <div className="slot" key={`${s.name}-${i}`}>
                  {s.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.icon} alt="" loading="lazy" />
                  ) : (
                    <span className="ph">✦</span>
                  )}
                  <div className="label">
                    <strong>{s.name}</strong>
                    {s.level ? <span className="muted">niv. {s.level}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h3>Notes pour Claude</h3>
        <textarea
          placeholder="Rôle habituel, points faibles, habitudes de jeu…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            disabled={busy !== null || notes === (character.notes ?? "")}
            onClick={() => call("notes", "PUT", { notes })}
          >
            Enregistrer les notes
          </button>
          <button className="btn" disabled={busy !== null} onClick={() => call("refresh", "PUT", { refresh: true })}>
            {busy === "refresh" ? "Actualisation…" : "↻ Actualiser depuis DofusBook"}
          </button>
          <button
            className="btn ghost"
            disabled={busy !== null}
            onClick={() => confirm(`Retirer ${p.name} de l'équipe partagée ?`) && call("delete", "DELETE")}
          >
            Retirer
          </button>
        </div>
        <p className="muted">
          Synchronisé le {new Date(p.fetchedAt).toLocaleString("fr-FR")} ·{" "}
          <a href={character.dofusbookUrl} target="_blank" rel="noreferrer">
            Ouvrir sur DofusBook
          </a>
          {character.owner ? ` · ajouté par ${character.owner}` : ""}
        </p>
      </div>
    </div>
  );
}
