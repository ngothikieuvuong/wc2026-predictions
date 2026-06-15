import { NextResponse } from "next/server";
import { getLiveScores } from "@/lib/fifa";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live in-play scores from FIFA. No cache — always fresh on page load.
export async function GET() {
  try {
    const live = await getLiveScores();
    return NextResponse.json(
      { ok: true, live },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
