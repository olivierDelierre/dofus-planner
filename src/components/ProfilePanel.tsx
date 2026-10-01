"use client";

import { useState } from "react";
import type { Profile } from "@/lib/auth";

interface Props {
  profile: Profile;
  onLoggedOut: () => void;
}

async function post(url: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.ok ? null : ((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
}

export function ProfilePanel({ profile, onLoggedOut }: Props) {
  const [open, setOpen] = useState<"none" | "add" | "password">("none");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function show(which: typeof open) {
    setOpen(open === which ? "none" : which);
    setA("");
    setB("");
    setMessage(null);
  }

  async function submit() {
    const error =
      open === "add"
        ? await post("/api/profiles", { name: a.trim(), password: b })
        : await post("/api/auth/password", { current: a, next: b });
    if (error) return setMessage({ ok: false, text: error });
    setMessage({ ok: true, text: open === "add" ? `Profil « ${a.trim()} » créé.` : "Mot de passe modifié." });
    setA("");
    setB("");
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>
          Connecté en tant que <strong>{profile.name}</strong>
        </span>
        <div className="row">
          <button onClick={() => show("add")}>Ajouter un profil</button>
          <button onClick={() => show("password")}>Mot de passe</button>
          <button
            onClick={async () => {
              await post("/api/auth/logout");
              onLoggedOut();
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>
      {open !== "none" && (
        <div className="grid" style={{ marginTop: 12 }}>
          <label>
            {open === "add" ? "Nom du nouveau profil" : "Mot de passe actuel"}
            <input type={open === "add" ? "text" : "password"} value={a} onChange={(e) => setA(e.target.value)} />
          </label>
          <label>
            {open === "add" ? "Son mot de passe (8+ caractères)" : "Nouveau mot de passe (8+ caractères)"}
            <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
          </label>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <button className="primary" onClick={submit} disabled={!a || b.length < 8}>
              Valider
            </button>
          </div>
        </div>
      )}
      {message && <p className={message.ok ? "muted" : "error"}>{message.text}</p>}
    </div>
  );
}
