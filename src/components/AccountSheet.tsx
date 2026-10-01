"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/auth";

type Theme = "dark" | "light";

async function post(url: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.ok ? null : ((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

interface Props {
  profile: Profile;
  onClose: () => void;
  onLoggedOut: () => void;
}

export function AccountSheet({ profile, onClose, onLoggedOut }: Props) {
  const [mode, setMode] = useState<"none" | "add" | "password">("none");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => setTheme(readTheme()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Stockage indisponible (navigation privée) : le thème vaut pour la session.
    }
    setTheme(next);
  }

  function show(next: typeof mode) {
    setMode(mode === next ? "none" : next);
    setA("");
    setB("");
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const error =
      mode === "add"
        ? await post("/api/profiles", { name: a.trim(), password: b })
        : await post("/api/auth/password", { current: a, next: b });
    if (error) return setMessage({ ok: false, text: error });
    setMessage({ ok: true, text: mode === "add" ? `Profil « ${a.trim()} » créé.` : "Mot de passe modifié." });
    setA("");
    setB("");
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Compte" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <h2>Compte</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p>
          Connecté en tant que <strong>{profile.name}</strong>
        </p>

        <h3>Thème</h3>
        <div className="segmented" role="group" aria-label="Thème">
          <button aria-pressed={theme === "dark"} onClick={() => applyTheme("dark")}>
            🌙 Sombre
          </button>
          <button aria-pressed={theme === "light"} onClick={() => applyTheme("light")}>
            ☀️ Clair
          </button>
        </div>

        <h3>Profils</h3>
        <div className="row">
          <button className="btn" onClick={() => show("add")}>
            Ajouter un profil
          </button>
          <button className="btn" onClick={() => show("password")}>
            Changer mon mot de passe
          </button>
        </div>
        {mode !== "none" && (
          <form className="stack" style={{ marginTop: 12 }} onSubmit={submit}>
            <label>
              {mode === "add" ? "Nom du nouveau profil" : "Mot de passe actuel"}
              <input
                type={mode === "add" ? "text" : "password"}
                autoComplete={mode === "add" ? "off" : "current-password"}
                value={a}
                onChange={(e) => setA(e.target.value)}
              />
            </label>
            <label>
              {mode === "add" ? "Son mot de passe (8 caractères min.)" : "Nouveau mot de passe (8 caractères min.)"}
              <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
            </label>
            <button className="btn primary" disabled={!a || b.length < 8}>
              Valider
            </button>
          </form>
        )}
        {message && <p className={message.ok ? "muted" : "error"}>{message.text}</p>}

        <button
          className="btn block"
          style={{ marginTop: 24 }}
          onClick={async () => {
            await post("/api/auth/logout");
            onLoggedOut();
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
