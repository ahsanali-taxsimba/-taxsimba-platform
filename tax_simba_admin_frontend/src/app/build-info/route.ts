import { NextResponse } from "next/server";

/** Deployment integrity — must match backend GIT_SHA on staging. */
export async function GET() {
  return NextResponse.json({
    service: "tax_simba_admin_frontend",
    gitSha: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_SHA || null,
    apiUrl: process.env.NEXT_PUBLIC_API_URL || null,
  });
}
