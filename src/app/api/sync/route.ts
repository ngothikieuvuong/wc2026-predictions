import { NextResponse } from "next/server";
import { syncFifaResults } from "@/lib/fifa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pulls finished scores from FIFA into our matches table.
// Called hourly by Vercel Cron (see vercel.json), or manually by opening the URL.
// If CRON_SECRET is set in env, Vercel sends it as a Bearer token and we enforce it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncFifaResults();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
