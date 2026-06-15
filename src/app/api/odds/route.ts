import { NextResponse } from "next/server";
import { fetchOdds } from "@/lib/odds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Reference odds (kèo chấp / tài xỉu) scraped from kqbd.mobi. Server-side so the
// browser doesn't hit CORS. Cached briefly at the edge since odds move slowly.
export async function GET() {
  try {
    const odds = await fetchOdds();
    return NextResponse.json(
      { ok: true, odds },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
