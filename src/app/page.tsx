"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { CombatTab } from "@/components/CombatTab";
import { GuidesPanel } from "@/components/GuidesPanel";
import { Login } from "@/components/Login";
import { PlansTab } from "@/components/PlansTab";
import { TeamTab } from "@/components/TeamTab";
import type { Profile } from "@/lib/auth";
import { initials } from "@/lib/classes";
import type { PlanSummary } from "@/lib/storage";
import type { Character } from "@/lib/types";

const TABS = [
  { id: "combat", label: "Combat", icon: "⚔️" },
  { id: "equipe", label: "Équipe", icon: "🛡️" },
  { id: "plans", label: "Plans", icon: "📜" },
  { id: "guides", label: "Guides", icon: "📚" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type AuthState = { status: "loading" } | { status: "out"; firstRun: boolean } | { status: "in"; profile: Profile };

function tabFromHash(): TabId {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as TabId) : "combat";
}

export default function Home() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [tab, setTab] = useState<TabId>("combat");
  const [team, setTeam] = useState<Character[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/auth/status");
    const body: { hasProfiles: boolean; profile: Profile | null } = await res.json();
    setAuth(body.profile ? { status: "in", profile: body.profile } : { status: "out", firstRun: !body.hasProfiles });
  }, []);

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/team");
    if (res.ok) setTeam(await res.json());
  }, []);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/plans");
    if (res.ok) setPlans(await res.json());
  }, []);

  useEffect(() => {
    loadStatus();
    // L'onglet est reflété dans l'URL (#equipe…) : le bouton retour et les favoris fonctionnent.
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [loadStatus]);

  useEffect(() => {
    if (auth.status !== "in") return;
    loadTeam();
    loadPlans();
  }, [auth, loadTeam, loadPlans]);

  const go = (id: TabId) => {
    window.location.hash = id;
    window.scrollTo({ top: 0 });
  };

  if (auth.status === "loading") return <div className="auth muted">Chargement…</div>;
  if (auth.status === "out") return <Login firstRun={auth.firstRun} onLoggedIn={loadStatus} />;

  const tabButtons = TABS.map((t) => (
    <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
      <span className="icon" aria-hidden>
        {t.icon}
      </span>
      {t.label}
    </button>
  ));

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⚔</span>
          <span>Dofus Planner</span>
        </div>
        <nav className="tabs" role="tablist">
          {tabButtons}
        </nav>
        <button
          className="avatar"
          style={{ width: 38, height: 38, borderRadius: 12, border: 0, cursor: "pointer", fontSize: 14 }}
          onClick={() => setAccountOpen(true)}
          aria-label={`Compte de ${auth.profile.name}`}
        >
          {initials(auth.profile.name)}
        </button>
      </header>

      <main className="app">
        {/* Les onglets restent montés : une génération en cours survit à un changement d'onglet. */}
        <div hidden={tab !== "combat"}>
          <CombatTab team={team} onUnauthorized={loadStatus} onPlanSaved={loadPlans} onGoToTeam={() => go("equipe")} />
        </div>
        <div hidden={tab !== "equipe"}>
          <TeamTab team={team} onChanged={loadTeam} />
        </div>
        <div hidden={tab !== "plans"}>
          <PlansTab plans={plans} onChanged={loadPlans} />
        </div>
        <div hidden={tab !== "guides"}>
          <GuidesPanel />
        </div>
      </main>

      <nav className="tabbar" role="tablist">
        {tabButtons}
      </nav>

      {accountOpen && (
        <AccountSheet
          profile={auth.profile}
          onClose={() => setAccountOpen(false)}
          onLoggedOut={() => {
            setAccountOpen(false);
            setAuth({ status: "out", firstRun: false });
          }}
        />
      )}
    </>
  );
}
