"use client";

import { useEffect, useState } from "react";
import { gameImage } from "@/lib/assets";

export interface ItemHit {
  id: number;
  name: string;
  level: number;
  icon: string;
}

interface Props {
  slot: string;
  maxLevel: number;
  onPick: (item: ItemHit) => void;
  onClose: () => void;
}

/** Recherche d'un objet pour un emplacement (liste triée du plus haut niveau au plus bas). */
export function ItemPicker({ slot, maxLevel, onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ItemHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHits(null);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slot, q, maxLevel: String(maxLevel) });
        const res = await fetch(`/api/game/items?${params}`);
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
        const data: ItemHit[] = await res.json();
        if (alive) {
          setHits(data);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    }, q ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slot, q, maxLevel]);

  return (
    <div className="sheet-backdrop picker-backdrop" onClick={onClose}>
      <div className="sheet picker" role="dialog" aria-modal="true" aria-label={`Choisir : ${slot}`} onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <h2>{slot}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <input autoFocus placeholder="Rechercher par nom…" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="muted small-note">Jusqu&apos;au niveau {maxLevel}, du plus haut au plus bas.</p>
        {error && <p className="error">{error}</p>}
        {hits === null && !error && <p className="muted">Chargement…</p>}
        {hits?.length === 0 && <p className="muted">Aucun résultat.</p>}
        <div className="picker-list">
          {hits?.map((h) => (
            <button key={h.id} className="pick" onClick={() => onPick(h)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gameImage(h.icon)} alt="" loading="lazy" />
              <span className="pick-name">{h.name}</span>
              <span className="lvl">niv. {h.level}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
