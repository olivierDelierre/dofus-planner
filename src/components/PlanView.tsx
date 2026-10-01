import type { PlanResponse } from "@/lib/types";

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} étoiles sur 5`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}

export function PlanView({ result }: { result: PlanResponse }) {
  const { plan, baseline } = result;
  return (
    <section className="card">
      <h2>Plan : {plan.encounterSummary.name}</h2>
      <div className="row">
        <Stars n={plan.confidence.stars} />
        <span className="muted">
          (score de base {baseline.stars}/5 · modèle {result.servedBy})
        </span>
      </div>
      <p>{plan.confidence.reasoning}</p>
      <details>
        <summary>Facteurs du score de base</summary>
        <ul>
          {baseline.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </details>

      <h3>Le combat</h3>
      <p className="muted">Niveau : {plan.encounterSummary.level}</p>
      <ul>
        {plan.encounterSummary.keyMechanics.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {plan.encounterSummary.monsters.map((m) => (
        <p key={m.name}>
          <strong>{m.name}</strong> ({m.role}) · Faiblesses : {m.weaknesses} · Danger : {m.threats}
        </p>
      ))}

      <h3>Ajustements par personnage</h3>
      {plan.characters.map((c) => (
        <div key={c.name} className="char" style={{ display: "block" }}>
          <strong>{c.name}</strong> · <span className="muted">{c.role}</span>
          <ul>
            {c.changes.map((ch, i) => (
              <li key={i}>
                <strong>[{ch.category}]</strong> {ch.change}
                <div className="muted">{ch.why}</div>
              </li>
            ))}
          </ul>
          {c.keySpells.length > 0 && <p className="muted">Sorts clés : {c.keySpells.join(", ")}</p>}
        </div>
      ))}

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
          <li key={s}>{s.startsWith("http") ? <a href={s} target="_blank" rel="noreferrer">{s}</a> : s}</li>
        ))}
      </ul>
      <details>
        <summary>Notes de recherche brutes</summary>
        <pre>{result.research}</pre>
      </details>
    </section>
  );
}
