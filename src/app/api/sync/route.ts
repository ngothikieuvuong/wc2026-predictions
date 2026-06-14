import { NextResponse } from "next/server";
import { syncFifaResults } from "@/lib/fifa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pulls finished scores from FIFA into our matches table.
// Triggered by the "Cập nhật kết quả" button on the home page (or by opening
// this URL directly). Only fills scores + marks finished — no payout.
export async function GET() {
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
