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
    <div className="auth">
      <div className="brand">
        <span className="brand-mark">⚔</span> Dofus Planner
      </div>
      <p className="muted" style={{ textAlign: "center", marginBottom: 24 }}>
        {firstRun ? "Premier lancement : crée ton profil." : "Prépare tes donjons avec Claude."}
      </p>
      <form className="card stack" onSubmit={submit}>
        <label>
          Profil
          <input autoComplete="username" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Mot de passe {firstRun && "(8 caractères min.)"}
          <input
            type="password"
            autoComplete={firstRun ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy || !name.trim() || !password}>
          {firstRun ? "Créer le profil" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
