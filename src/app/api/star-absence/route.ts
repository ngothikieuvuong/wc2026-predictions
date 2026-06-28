import { NextResponse } from "next/server";
import { getStarAbsences } from "@/lib/scorers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Top-10 scorers/assisters of the two teams who are absent from the announced
// starting XI (suspended / benched / out). Empty until the lineup is published.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t1 = url.searchParams.get("t1") ?? "";
  const t2 = url.searchParams.get("t2") ?? "";
  if (!t1 || !t2) return NextResponse.json({ ok: false, absences: [] });
  try {
    const absences = await getStarAbsences(t1, t2);
    return NextResponse.json(
      { ok: true, absences },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, absences: [], error: (e as Error).message });
  }
}
