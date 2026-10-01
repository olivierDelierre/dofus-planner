import { gameImage } from "@/lib/assets";
import { classColor } from "@/lib/classes";
import type { Slot } from "@/lib/types";

export interface DollItem {
  name: string;
  icon?: string;
  level?: number;
}

const LEFT: Slot[] = ["Amulette", "Bouclier", "Anneau 1", "Ceinture", "Bottes"];
const RIGHT: Slot[] = ["Chapeau", "Arme", "Anneau 2", "Cape", "Familier"];
const DOFUS: Slot[] = ["Dofus 1", "Dofus 2", "Dofus 3", "Dofus 4", "Dofus 5", "Dofus 6"];

interface Props {
  items: Partial<Record<Slot, DollItem>>;
  className: string;
  symbol?: string;
  head?: string;
  title: string;
  subtitle: string;
  selected?: string | null;
  /** Éditeur : tous les emplacements sont cliquables et on peut retirer un objet. */
  editable?: boolean;
  onSlot: (slot: Slot) => void;
  onClear?: (slot: Slot) => void;
}

/** Équipement façon fiche DofusBook : colonnes d'emplacements de chaque côté, personnage au centre, Dofus en bas. */
export function Paperdoll({ items, className, symbol, head, title, subtitle, selected, editable, onSlot, onClear }: Props) {
  const cell = (slot: Slot) => {
    const it = items[slot];
    const cls = ["dslot", it ? "filled" : "", selected === slot ? "sel" : ""].join(" ").trim();
    return (
      <div key={slot} className="dslot-wrap">
        <button
          className={cls}
          disabled={!it && !editable}
          title={it ? `${it.name}${it.level ? ` (niv. ${it.level})` : ""}` : slot}
          aria-label={it ? `${slot} : ${it.name}` : `${slot} : vide`}
          onClick={() => onSlot(slot)}
        >
          {it?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gameImage(it.icon)} alt="" loading="lazy" />
          ) : (
            <span className="dslot-empty">{editable ? "＋" : ""}</span>
          )}
          <span className="dslot-label">{it ? it.name : slot}</span>
        </button>
        {editable && it && (
          <button className="dslot-x" aria-label={`Retirer ${it.name}`} onClick={() => onClear?.(slot)}>
            ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="doll">
      <div className="doll-col">{LEFT.map(cell)}</div>
      <div className="doll-center" style={{ "--c": classColor(className) } as React.CSSProperties}>
        {symbol && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="doll-art" src={gameImage(symbol)} alt="" />
        )}
        {head && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="doll-head" src={gameImage(head)} alt="" />
        )}
        <div className="doll-name">{title}</div>
        <div className="doll-sub">{subtitle}</div>
      </div>
      <div className="doll-col">{RIGHT.map(cell)}</div>
      <div className="doll-dofus">{DOFUS.map(cell)}</div>
    </div>
  );
}
