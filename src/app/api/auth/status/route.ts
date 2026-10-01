import { NextResponse } from "next/server";
import { currentProfile, hasProfiles } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasProfiles: await hasProfiles(),
    profile: await currentProfile(),
  });
}
