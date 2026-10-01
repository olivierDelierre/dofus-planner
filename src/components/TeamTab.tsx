"use client";

import { useState } from "react";
import { elementIcon } from "@/lib/assets";
import { elementClass } from "@/lib/classes";
import type { Character } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CharacterEditor } from "./CharacterEditor";
import { CharacterSheet } from "./CharacterSheet";

interface Props {
  team: Character[];
  onChanged: () => Promise<void>;
}

export function TeamTab({ team, onChanged }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const open = team.find((c) => c.id === openId) ?? null;

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>Équipe partagée</h2>
          <button className="btn primary small" onClick={() => setCreating(true)}>
            ＋ Nouveau personnage
          </button>
        </div>
        {team.length === 0 ? (
          <div className="empty">
            <span className="icon">🛡️</span>
            Crée ton premier personnage : classe, caractéristiques, équipement et sorts.
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="ico" src={elementIcon(e)} alt="" />
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

      {creating && <CharacterEditor onClose={() => setCreating(false)} onSaved={onChanged} />}
      {open && <CharacterSheet character={open} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </>
  );
}
