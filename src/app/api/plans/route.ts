import { NextResponse } from "next/server";
import { authed } from "@/lib/api";
import { listPlans } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authed(async (_req, profile) => NextResponse.json(await listPlans(profile.id)));
