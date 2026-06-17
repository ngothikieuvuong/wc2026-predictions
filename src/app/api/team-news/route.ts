import { NextResponse } from "next/server";
import { getTeamNews } from "@/lib/apiFootball";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Injuries + projected lineups for a match from API-Football. Server-side so
// the API key stays secret. Called on demand only (free tier ~100 req/day).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const team1 = url.searchParams.get("team1") || "";
  const team2 = url.searchParams.get("team2") || "";
  if (!team1 || !team2)
    return NextResponse.json({ ok: false, reason: "missing-teams" });

  try {
    const data = await getTeamNews(team1, team2, Date.now());
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({
      ok: false,
      reason: msg === "missing-key" ? "no-key" : "error",
    });
  }
}
