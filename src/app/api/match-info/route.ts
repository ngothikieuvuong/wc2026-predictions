import { NextResponse } from "next/server";
import { getMatchInfo } from "@/lib/fifaLineup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const t1 = searchParams.get("t1") ?? "";
  const t2 = searchParams.get("t2") ?? "";
  if (!t1 || !t2) {
    return NextResponse.json({ error: "missing teams" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getMatchInfo(t1, t2));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
