"use client";

import { useState } from "react";
import { CLASSES, ELEMENTS, type Character } from "@/lib/types";

const EMPTY: Omit<Character, "id"> = {
  name: "",
  class: "Iop",
  level: 200,
  elements: [],
  stuff: "",
  spells: "",
  notes: "",
};

interface Props {
  team: Character[];
  /** Recharge l'équipe depuis le serveur après une modification. */
  onChanged: () => Promise<void>;
}

export function TeamEditor({ team, onChanged }: Props) {
  const [draft, setDraft] = useState<Omit<Character, "id">>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      return false;
    }
    await onChanged();
    return true;
  }

  async function submit() {
    if (!draft.name.trim()) return;
    const { owner: _owner, ...clean } = { ...draft, name: draft.name.trim() };
    const ok = editingId
      ? await call(`/api/team/${editingId}`, "PUT", clean)
      : await call("/api/team", "POST", clean);
    if (ok) {
      setDraft(EMPTY);
      setEditingId(null);
    }
  }

  function edit(c: Character) {
    const { id, ...rest } = c;
    setDraft({ ...EMPTY, ...rest });
    setEditingId(id);
  }

  async function remove(c: Character) {
    if (confirm(`Supprimer ${c.name} de l'équipe partagée ?`)) await call(`/api/team/${c.id}`, "DELETE");
  }

  function toggleElement(el: (typeof ELEMENTS)[number]) {
    setDraft((d) => ({
      ...d,
      elements: d.elements.includes(el) ? d.elements.filter((e) => e !== el) : [...d.elements, el],
    }));
  }

  return (
    <section className="card">
      <h2>Équipe (partagée)</h2>
      <div className="grid">
        <label>
          Nom
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label>
          Classe
          <select
            value={draft.class}
            onChange={(e) => setDraft({ ...draft, class: e.target.value as Character["class"] })}
          >
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Niveau
          <input
            type="number"
            min={1}
            max={200}
            value={draft.level}
            onChange={(e) => setDraft({ ...draft, level: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
      </div>
      <h3>Éléments</h3>
      <div className="checks">
        {ELEMENTS.map((el) => (
          <label key={el}>
            <input type="checkbox" checked={draft.elements.includes(el)} onChange={() => toggleElement(el)} />
            {el}
          </label>
        ))}
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        <label>
          Stuff (optionnel)
          <textarea
            placeholder="Panoplie, items clés, PA/PM, résistances…"
            value={draft.stuff}
            onChange={(e) => setDraft({ ...draft, stuff: e.target.value })}
          />
        </label>
        <label>
          Sorts choisis (optionnel)
          <textarea
            placeholder="Variantes de sorts actuellement équipées…"
            value={draft.spells}
            onChange={(e) => setDraft({ ...draft, spells: e.target.value })}
          />
        </label>
        <label>
          Notes
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={submit} disabled={!draft.name.trim()}>
          {editingId ? "Enregistrer" : "Ajouter le personnage"}
        </button>
        {editingId && (
          <button
            onClick={() => {
              setDraft(EMPTY);
              setEditingId(null);
            }}
          >
            Annuler
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      {team.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {team.map((c) => (
            <div className="char" key={c.id}>
              <div>
                <strong>{c.name}</strong> · {c.class} {c.level}
                <div className="muted">
                  {c.elements.join(", ") || "Éléments non précisés"}
                  {c.owner ? ` · ajouté par ${c.owner}` : ""}
                </div>
              </div>
              <div className="row">
                <button onClick={() => edit(c)}>Modifier</button>
                <button onClick={() => remove(c)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
