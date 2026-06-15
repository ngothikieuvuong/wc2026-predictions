import { NextResponse } from "next/server";
import { fetchOdds, fetchOddsRaw, parseOdds } from "@/lib/odds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Reference odds (kèo chấp / tài xỉu) scraped from kqbd.mobi. Server-side so the
// browser doesn't hit CORS. Cached briefly at the edge since odds move slowly.
export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.has("debug");
  try {
    if (debug) {
      const { status, html } = await fetchOddsRaw();
      const lower = html.toLowerCase();
      return NextResponse.json({
        ok: true,
        status,
        len: html.length,
        rows: parseOdds(html).length,
        hasTable: html.includes("box-info-table"),
        cfChallenge:
          lower.includes("just a moment") ||
          lower.includes("checking your browser") ||
          lower.includes("cf-challenge") ||
          lower.includes("cf-browser-verification"),
        snippet: html.slice(0, 300),
      });
    }
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
