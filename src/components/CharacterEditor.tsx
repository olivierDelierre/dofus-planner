"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gameImage, statIcon } from "@/lib/assets";
import { classColor } from "@/lib/classes";
import {
  BASE_STATS,
  SLOTS,
  type BaseStat,
  type BuildInput,
  type Character,
  type CharacterProfile,
  type Slot,
} from "@/lib/types";
import { ItemPicker, type ItemHit } from "./ItemPicker";
import { Paperdoll } from "./Paperdoll";
import { StatsGrid } from "./StatsGrid";

interface Breed {
  id: number;
  name: string;
  symbol: string;
  heads: { m: string; f: string };
}
interface SpellInfo {
  id: number;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
}
type Picked = { itemId: number; name: string; icon: string; level: number };

const BASE_LABEL: Record<BaseStat, string> = {
  vitalite: "Vitalité",
  sagesse: "Sagesse",
  force: "Force",
  intelligence: "Intelligence",
  chance: "Chance",
  agilite: "Agilité",
};
const EMPTY_BASE = Object.fromEntries(BASE_STATS.map((k) => [k, 0])) as Record<BaseStat, number>;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
  return res.json();
}

interface Props {
  /** Personnage à modifier ; absent pour une création. */
  existing?: Character;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function CharacterEditor({ existing, onClose, onSaved }: Props) {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [spellList, setSpellList] = useState<SpellInfo[]>([]);
  const [name, setName] = useState(existing?.build.name ?? "");
  const [classId, setClassId] = useState<number | null>(existing?.build.classId ?? null);
  const [gender, setGender] = useState<"m" | "f">(existing?.build.gender ?? "m");
  const [level, setLevel] = useState(existing?.build.level ?? 200);
  const [base, setBase] = useState<Record<BaseStat, number>>(existing?.build.base ?? EMPTY_BASE);
  const [items, setItems] = useState<Partial<Record<Slot, Picked>>>(() =>
    Object.fromEntries(
      (existing?.profile.items ?? []).map((i) => [
        i.slot,
        { itemId: i.itemId, name: i.name, icon: i.icon ?? "", level: i.level ?? 0 },
      ]),
    ),
  );
  const [spellLevels, setSpellLevels] = useState<Record<number, number>>(
    Object.fromEntries((existing?.build.spells ?? []).map((s) => [s.id, s.level])),
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [picking, setPicking] = useState<Slot | null>(null);
  const [preview, setPreview] = useState<CharacterProfile | null>(existing?.profile ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fresh = useRef(!existing);

  useEffect(() => {
    getJson<Breed[]>("/api/game/breeds").then(setBreeds, (e) => setError(String(e.message ?? e)));
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (classId === null) return;
    let alive = true;
    getJson<SpellInfo[]>(`/api/game/spells?classId=${classId}`).then(
      (list) => {
        if (!alive) return;
        setSpellList(list);
        // Nouvelle classe choisie : tous les sorts au niveau 1 pour partir d'une base.
        if (fresh.current) setSpellLevels(Object.fromEntries(list.map((s) => [s.id, 1])));
        fresh.current = false;
      },
      (e) => alive && setError(String(e.message ?? e)),
    );
    return () => {
      alive = false;
    };
  }, [classId]);

  const build: BuildInput | null = useMemo(() => {
    if (classId === null) return null;
    return {
      name: name.trim() || "Aperçu",
      classId,
      gender,
      level,
      base,
      items: SLOTS.flatMap((slot) => (items[slot] ? [{ slot, itemId: items[slot]!.itemId }] : [])),
      spells: Object.entries(spellLevels)
        .filter(([, l]) => l > 0)
        .map(([id, l]) => ({ id: Number(id), level: l })),
    };
  }, [name, classId, gender, level, base, items, spellLevels]);

  // Aperçu des caractéristiques calculées côté serveur (après une courte pause de saisie).
  useEffect(() => {
    if (!build) return;
    let alive = true;
    const timer = setTimeout(() => {
      getJson<CharacterProfile>("/api/game/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(build),
      }).then(
        (p) => alive && setPreview(p),
        () => undefined,
      );
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [build]);

  const breed = breeds.find((b) => b.id === classId);
  const canSave = !!build && name.trim().length > 0 && !saving;

  async function save() {
    if (!build) return;
    setSaving(true);
    setError(null);
    try {
      await getJson(existing ? `/api/team/${existing.id}` : "/api/team", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ build: { ...build, name: name.trim() }, notes: notes.trim() || undefined }),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet editor" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <h2>{existing ? `Modifier ${existing.profile.name}` : "Nouveau personnage"}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="cols editor-cols">
          <div>
        <h3>Identité</h3>
        <label>
          Nom
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Nom du personnage" />
        </label>

        <div className="class-grid" role="radiogroup" aria-label="Classe">
          {breeds.map((b) => (
            <button
              key={b.id}
              role="radio"
              aria-checked={b.id === classId}
              className={b.id === classId ? "class-opt on" : "class-opt"}
              style={{ "--c": classColor(b.name) } as React.CSSProperties}
              onClick={() => {
                if (b.id !== classId) {
                  fresh.current = true;
                  setSpellLevels({});
                  setClassId(b.id);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gameImage(b.symbol)} alt="" loading="lazy" />
              <span>{b.name}</span>
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="seg" role="radiogroup" aria-label="Genre">
            {(["m", "f"] as const).map((g) => (
              <button key={g} role="radio" aria-checked={gender === g} className={gender === g ? "on" : ""} onClick={() => setGender(g)}>
                {breed?.heads[g] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gameImage(breed.heads[g])} alt="" />
                )}
                {g === "m" ? "Masculin" : "Féminin"}
              </button>
            ))}
          </div>
          <label className="inline">
            Niveau
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={level}
              onChange={(e) => setLevel(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
              style={{ width: 80 }}
            />
          </label>
        </div>

        <h3>Caractéristiques de base</h3>
        <p className="muted small-note">Points investis (capital + parchemins), sans l&apos;équipement.</p>
        <div className="base-grid">
          {BASE_STATS.map((k) => (
            <label key={k} className="base-field">
              <span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ico" src={statIcon(k, BASE_LABEL[k]) ?? statIcon(k)} alt="" />
                {BASE_LABEL[k]}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                value={base[k]}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setBase({ ...base, [k]: Math.min(2000, Math.max(0, Number(e.target.value) || 0)) })}
              />
            </label>
          ))}
        </div>

        <h3>Équipement</h3>
        <Paperdoll
          editable
          items={items}
          className={breed?.name ?? ""}
          symbol={breed?.symbol}
          head={breed?.heads[gender]}
          title={name.trim() || "Nouveau personnage"}
          subtitle={breed ? `${breed.name} · niv. ${level}` : "Choisis une classe"}
          onSlot={setPicking}
          onClear={(slot) => setItems(({ [slot]: _removed, ...rest }) => rest)}
        />

          </div>
          <div>
        <h3>Sorts</h3>
        {classId === null ? (
          <p className="muted">Choisis d&apos;abord une classe.</p>
        ) : spellList.length === 0 ? (
          <p className="muted">Chargement des sorts…</p>
        ) : (
          <div className="spells">
            {spellList.map((s) => {
              const lv = spellLevels[s.id] ?? 0;
              return (
                <div key={s.id} className={lv > 0 ? "spell on" : "spell"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gameImage(s.icon)} alt="" loading="lazy" title={s.description} />
                  <span className="spell-name">{s.name}</span>
                  <div className="stepper">
                    <button aria-label={`Baisser ${s.name}`} disabled={lv <= 0} onClick={() => setSpellLevels({ ...spellLevels, [s.id]: lv - 1 })}>
                      −
                    </button>
                    <b>{lv || "—"}</b>
                    <button aria-label={`Monter ${s.name}`} disabled={lv >= s.maxLevel} onClick={() => setSpellLevels({ ...spellLevels, [s.id]: lv + 1 })}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {preview && (
          <>
            <h3>Caractéristiques totales</h3>
            <StatsGrid stats={preview.stats} />
            <p className="muted small-note">PV et PA de base estimés d&apos;après le niveau ; bonus d&apos;équipement au jet maximum.</p>
          </>
        )}

          </div>
        </div>

        <h3>Notes pour Claude</h3>
        <textarea placeholder="Rôle habituel, points faibles, habitudes de jeu…" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <p className="error">{error}</p>}
        <div className="editor-actions">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn primary" disabled={!canSave} onClick={save}>
            {saving ? "Enregistrement…" : existing ? "Enregistrer" : "Créer le personnage"}
          </button>
        </div>
      </div>

      {picking && (
        <ItemPicker
          slot={picking}
          maxLevel={level}
          onClose={() => setPicking(null)}
          onPick={(h: ItemHit) => {
            setItems({ ...items, [picking]: { itemId: h.id, name: h.name, icon: h.icon, level: h.level } });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
