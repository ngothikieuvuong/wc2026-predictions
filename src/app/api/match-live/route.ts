import { NextResponse } from "next/server";
import { getMatchLive } from "@/lib/fifaLineup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live detail (score, minute, goals, cards, possession) for one match.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const t1 = searchParams.get("t1") ?? "";
  const t2 = searchParams.get("t2") ?? "";
  if (!t1 || !t2) {
    return NextResponse.json({ found: false }, { status: 400 });
  }
  try {
    return NextResponse.json(await getMatchLive(t1, t2), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
