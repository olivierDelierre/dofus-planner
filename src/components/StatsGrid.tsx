import { statIcon } from "@/lib/assets";
import type { CharacterProfile } from "@/lib/types";

/** Caractéristiques mises en avant en tête de liste. */
const KEY_STATS = new Set(["pa", "pm", "pv", "po"]);

/** Liste de caractéristiques façon panneau du jeu : icône, valeur verte, nom. */
export function StatsGrid({ stats }: { stats: CharacterProfile["stats"] }) {
  const sorted = [...stats].sort((a, b) => Number(KEY_STATS.has(b.key)) - Number(KEY_STATS.has(a.key)));
  return (
    <div className="stats">
      {sorted.map((s) => {
        const icon = statIcon(s.key, s.label);
        return (
          <div key={s.key} className={KEY_STATS.has(s.key) ? "stat key" : "stat"}>
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ico" src={icon} alt="" />
            ) : (
              <span className="ico ico-empty" aria-hidden />
            )}
            <span className="v">{s.value}</span>
            <span className="n">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
