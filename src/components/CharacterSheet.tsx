"use client";

import { useEffect, useState } from "react";
import { elementIcon, gameImage } from "@/lib/assets";
import { elementClass } from "@/lib/classes";
import { type Character } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CharacterEditor } from "./CharacterEditor";
import { EffectText } from "./EffectText";
import { Paperdoll } from "./Paperdoll";
import { SetsList } from "./SetsList";
import { StatsGrid } from "./StatsGrid";

interface Props {
  character: Character;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Fiche personnage : équipement, caractéristiques et sorts avec leurs icônes. */
export function CharacterSheet({ character, onClose, onChanged }: Props) {
  const { profile: p } = character;
  const [notes, setNotes] = useState(character.notes ?? "");
  const [busy, setBusy] = useState<null | "refresh" | "notes" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, editing]);

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

  const bySlot = new Map(p.items.map((i) => [i.slot, i]));
  const key = (k: string) => p.stats.find((s) => s.key === k)?.value;
  const shownDetail = detail ? bySlot.get(detail) : undefined;

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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="ico" src={elementIcon(e)} alt="" />
                  {e}
                </span>
              ))}
            </div>
          </div>
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="vitals">
          {(
            [
              ["pa", "PA", "actionPoints"],
              ["pm", "PM", "movementPoints"],
              ["pv", "PV", ""],
              ["po", "PO", "range"],
            ] as const
          ).map(([k, label, icon]) => (
            <div key={k} className="vital">
              {icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/game/stats/${icon}.png`} alt="" />
              )}
              <b>{key(k) ?? 0}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="cols">
          <div>
        <h3>Équipement</h3>
        <Paperdoll
          items={Object.fromEntries(p.items.map((i) => [i.slot, { name: i.name, icon: i.icon, level: i.level, custom: i.custom }]))}
          className={p.className}
          symbol={p.classImage}
          head={p.headImage}
          title={p.name}
          subtitle={`${p.className} · niv. ${p.level}`}
          selected={detail}
          onSlot={(slot) => setDetail(detail === slot ? null : slot)}
        />
        {shownDetail && (
          <div className="detail">
            <strong>
              {shownDetail.name}
              {shownDetail.level ? ` · niv. ${shownDetail.level}` : ""}
              {shownDetail.custom ? " · jets personnalisés" : ""}
            </strong>
            <ul>
              {shownDetail.effects.map((e, i) => (
                <li key={i}>
                  <EffectText text={e} />
                </li>
              ))}
            </ul>
          </div>
        )}

          </div>
          <div>
        <SetsList sets={p.sets} />
        <h3>Caractéristiques</h3>
        <StatsGrid stats={p.stats} />

        {p.spells.length > 0 && (
          <>
            <h3>Sorts</h3>
            <div className="spell-icons">
              {p.spells.map((s) => (
                <button
                  key={s.baseId ?? s.id}
                  className={s.level === 0 ? "spell-icon locked" : "spell-icon"}
                  onClick={() => setDetail(detail === `spell:${s.id}` ? null : `spell:${s.id}`)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gameImage(s.icon)} alt={s.name} loading="lazy" />
                  {s.level ? <b>{s.level}</b> : null}
                  {s.variant && <i className="variant-tag">V</i>}
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
            {detail?.startsWith("spell:") &&
              (() => {
                const s = p.spells.find((x) => `spell:${x.id}` === detail);
                if (!s) return null;
                const facts = [
                  s.ap !== undefined ? `${s.ap} PA` : null,
                  s.range ? `portée ${s.range}` : null,
                  s.cooldown ? `relance ${s.cooldown} tour${s.cooldown > 1 ? "s" : ""}` : null,
                ].filter(Boolean);
                return (
                  <div className="detail">
                    <strong>
                      {s.name}
                      {s.variant ? " · variante" : ""}
                      {s.level ? ` · niveau ${s.level}` : s.unlockedAt ? ` · débloqué au niveau ${s.unlockedAt}` : ""}
                    </strong>
                    {facts.length > 0 && <p>{facts.join(" · ")}</p>}
                    <p>{s.description}</p>
                    {s.alt && (
                      <p>
                        <em>{s.variant ? "Version de base" : "Variante"} : </em>
                        {s.alt.name}
                        {s.alt.description ? ` — ${s.alt.description}` : ""}
                      </p>
                    )}
                  </div>
                );
              })()}
          </>
        )}
          </div>
        </div>

        <h3>Notes pour Claude</h3>
        <textarea
          placeholder="Rôle habituel, points faibles, habitudes de jeu…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy !== null} onClick={() => setEditing(true)}>
            ✎ Modifier
          </button>
          <button
            className="btn"
            disabled={busy !== null || notes === (character.notes ?? "")}
            onClick={() => call("notes", "PUT", { notes })}
          >
            Enregistrer les notes
          </button>
          <button className="btn" disabled={busy !== null} onClick={() => call("refresh", "PUT", { refresh: true })}>
            {busy === "refresh" ? "Recalcul…" : "↻ Actualiser"}
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
          Données du jeu via DofusDB et DofusDude{character.owner ? ` · créé par ${character.owner}` : ""}
        </p>
      </div>
      {editing && <CharacterEditor existing={character} onClose={() => setEditing(false)} onSaved={onChanged} />}
    </div>
  );
}
