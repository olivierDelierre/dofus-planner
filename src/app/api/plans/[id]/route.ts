import { NextResponse } from "next/server";
import { authed, jsonError } from "@/lib/api";
import { deletePlan, loadPlan } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// L'historique est privé : on ne cherche que dans le dossier du profil connecté.
export const GET = authed<Ctx>(async (_req, profile, { params }) => {
  const plan = await loadPlan(profile.id, (await params).id);
  return plan ? NextResponse.json(plan) : jsonError("Plan introuvable", 404);
});

export const DELETE = authed<Ctx>(async (_req, profile, { params }) => {
  return (await deletePlan(profile.id, (await params).id))
    ? NextResponse.json({ ok: true })
    : jsonError("Plan introuvable", 404);
});
