"use client";

import { useState } from "react";

interface Props {
  firstRun: boolean;
  onLoggedIn: () => Promise<void>;
}

export function Login({ firstRun, onLoggedIn }: Props) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(firstRun ? "/api/profiles" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      await onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Dofus Planner</h1>
      <p className="subtitle">
        {firstRun ? "Premier lancement : crée ton profil." : "Connecte-toi à ton profil."}
      </p>
      <form className="card" onSubmit={submit}>
        <label>
          Profil
          <input autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ marginTop: 12 }}>
          Mot de passe {firstRun && "(8 caractères minimum)"}
          <input
            type="password"
            autoComplete={firstRun ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={busy || !name.trim() || !password}>
            {firstRun ? "Créer le profil" : "Se connecter"}
          </button>
        </div>
      </form>
    </main>
  );
}
