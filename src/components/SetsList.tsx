import { EffectText } from "./EffectText";
import type { CharacterProfile } from "@/lib/types";

/** Panoplies portées, avec le bonus actif pour le nombre de pièces équipées. */
export function SetsList({ sets }: { sets: CharacterProfile["sets"] }) {
  if (sets.length === 0) return null;
  return (
    <>
      <h3>Panoplies</h3>
      <div className="sets">
        {sets.map((s) => (
          <div key={s.id} className={s.bonus.length ? "set on" : "set"}>
            <div className="set-head">
              <strong>{s.name}</strong>
              <span className="set-count">
                {s.count}/{s.size}
              </span>
            </div>
            {s.bonus.length > 0 ? (
              <ul>
                {s.bonus.map((b, i) => (
                  <li key={i}>
                    <EffectText text={b} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Pas encore de bonus (2 pièces minimum).</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
