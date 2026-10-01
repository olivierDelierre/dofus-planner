"use client";

import { useEffect, useState } from "react";
import { gameImage, statIcon } from "@/lib/assets";
import { EFFECT_LABELS, type ItemEffect } from "@/lib/effects";

interface DefaultEffect {
  label: string;
  value: number;
  min: number;
  text: string;
}

interface Props {
  itemId: number;
  name: string;
  icon?: string;
  /** Jets déjà saisis ; absent = jets maximum du jeu. */
  current?: ItemEffect[];
  onSave: (effects: ItemEffect[] | undefined) => void;
  onClose: () => void;
}

/** Jets exacts d'un objet porté : modifier les valeurs, retirer ou ajouter un effet (FM, exo). */
export function ItemEffectsEditor({ itemId, name, icon, current, onSave, onClose }: Props) {
  const [defaults, setDefaults] = useState<DefaultEffect[] | null>(null);
  const [rows, setRows] = useState<ItemEffect[]>(current ?? []);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/game/items/${itemId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { effects: DefaultEffect[] }) => {
        if (!alive) return;
        setDefaults(d.effects);
        setRows((prev) => (current ? prev : d.effects.map((e) => ({ label: e.label, value: e.value }))));
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const rangeOf = (label: string) => {
    const d = defaults?.find((x) => x.label === label);
    return d && d.min !== d.value ? `jet ${d.min} à ${d.value}` : d ? `jet fixe ${d.value}` : "ajouté";
  };

  const set = (i: number, value: number) => setRows(rows.map((r, j) => (j === i ? { ...r, value } : r)));
  const unused = EFFECT_LABELS.filter((l) => !rows.some((r) => r.label === l));
  const isDefault =
    !!defaults && rows.length === defaults.length && rows.every((r, i) => r.label === defaults[i].label && r.value === defaults[i].value);

  return (
    <div className="sheet-backdrop picker-backdrop" onClick={onClose}>
      <div className="sheet picker" role="dialog" aria-modal="true" aria-label={`Jets de ${name}`} onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gameImage(icon)} alt="" width={36} height={36} />
            )}
            {name}
          </h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="muted small-note">
          Saisis les jets exacts de l&apos;objet (valeurs négatives possibles). Ajoute les effets obtenus en FM ou en exo.
        </p>
        {error && <p className="error">{error}</p>}
        {!defaults && !error && <p className="muted">Chargement…</p>}
        <div className="fx-list">
          {rows.map((r, i) => (
            <div className="fx-row" key={r.label}>
              <label>
                <span>
                  {statIcon("", r.label) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ico" src={statIcon("", r.label)} alt="" />
                  ) : (
                    <span className="ico ico-empty" aria-hidden />
                  )}
                  {r.label}
                </span>
                <small className="muted">{rangeOf(r.label)}</small>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={r.value}
                min={-5000}
                max={5000}
                onFocus={(e) => e.target.select()}
                onChange={(e) => set(i, Math.max(-5000, Math.min(5000, Math.trunc(Number(e.target.value) || 0))))}
              />
              <button className="btn ghost small" aria-label={`Retirer ${r.label}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Ajouter un effet">
            <option value="">＋ Ajouter un effet (FM, exo)…</option>
            {unused.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!adding}
            onClick={() => {
              setRows([...rows, { label: adding, value: 1 }]);
              setAdding("");
            }}
          >
            Ajouter
          </button>
        </div>
        <div className="editor-actions">
          <button className="btn ghost" onClick={() => defaults && setRows(defaults.map((e) => ({ label: e.label, value: e.value })))} disabled={!defaults || isDefault}>
            ↺ Jets maximum
          </button>
          <button className="btn primary" disabled={!defaults} onClick={() => onSave(isDefault ? undefined : rows)}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
