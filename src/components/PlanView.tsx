import type { PlanRecord } from "@/lib/types";
import { Avatar } from "./Avatar";

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} étoiles sur 5`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}

export function PlanView({ record }: { record: PlanRecord }) {
  const { plan, baseline } = record.result;
  // Associe les conseils aux persos pour afficher leur avatar.
  const byName = new Map(record.participants.map((c) => [c.profile.name.toLowerCase(), c]));

  return (
    <section className="card">
      <h2>{plan.encounterSummary.name}</h2>
      <div className="confidence">
        <Stars n={plan.confidence.stars} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div>{plan.confidence.reasoning}</div>
          <details>
            <summary>
              Score de base {baseline.stars}/5 · {record.result.servedBy}
            </summary>
            <ul>
              {baseline.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <h3>Le combat</h3>
      <p className="muted">Niveau : {plan.encounterSummary.level}</p>
      <ul>
        {plan.encounterSummary.keyMechanics.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {plan.encounterSummary.monsters.map((m) => (
        <div key={m.name} className="change" style={{ borderLeftColor: "var(--danger)" }}>
          <strong>{m.name}</strong> <span className="muted">· {m.role}</span>
          <div>Faiblesses : {m.weaknesses}</div>
          <div className="muted">Danger : {m.threats}</div>
        </div>
      ))}

      <h3>Ajustements par personnage</h3>
      {plan.characters.map((c) => {
        const character = byName.get(c.name.toLowerCase());
        return (
          <div key={c.name} style={{ marginBottom: 16 }}>
            <div className="row">
              {character && <Avatar profile={character.profile} />}
              <div>
                <strong>{c.name}</strong>
                <div className="muted">{c.role}</div>
              </div>
            </div>
            {c.changes.map((ch, i) => (
              <div key={i} className="change">
                <div className="tag">{ch.category}</div>
                <div>{ch.change}</div>
                <div className="muted">{ch.why}</div>
              </div>
            ))}
            {c.keySpells.length > 0 && <p className="muted">Sorts clés : {c.keySpells.join(", ")}</p>}
          </div>
        );
      })}

      <h3>Stratégie</h3>
      <p>{plan.strategy.overview}</p>
      <h3>Préparation</h3>
      <ul>
        {plan.strategy.preparation.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <h3>Placement</h3>
      <p>{plan.strategy.placement}</p>
      {plan.strategy.phases.map((ph) => (
        <div key={ph.title}>
          <h3>{ph.title}</h3>
          <ol>
            {ph.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ))}
      <h3>Dangers</h3>
      <ul>
        {plan.strategy.dangers.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>

      {plan.missingInfo.length > 0 && (
        <>
          <h3>Infos manquantes ou incertaines</h3>
          <ul>
            {plan.missingInfo.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
      <h3>Sources</h3>
      <ul>
        {plan.sources.map((s) => (
          <li key={s} style={{ overflowWrap: "anywhere" }}>
            {s.startsWith("http") ? (
              <a href={s} target="_blank" rel="noreferrer">
                {s}
              </a>
            ) : (
              s
            )}
          </li>
        ))}
      </ul>
      <details>
        <summary>Notes de recherche brutes</summary>
        <pre>{record.result.research}</pre>
      </details>
    </section>
  );
}
