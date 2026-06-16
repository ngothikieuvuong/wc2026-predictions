"use client";

import { useEffect, useState } from "react";
import { getPendingWinners } from "@/lib/queries";

type Data = Awaited<ReturnType<typeof getPendingWinners>>;

// Shown on home / Mọi người / Tổng kết when someone already nailed a score on
// the active day but the day still has matches left before it can be settled.
export default function PendingWinnersBanner() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    getPendingWinners().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.waiting || data.matches.length === 0) return null;

  return (
    <section className="card border-grass/40 bg-grass/5">
      <ul className="space-y-1.5">
        {data.matches.map((m, i) => (
          <li key={i} className="text-sm">
            🎉 Chúc mừng{" "}
            <b className="text-grass">{m.winners.join(", ")}</b> đã trúng tỷ số{" "}
            <b className="font-mono">
              {m.home_score}–{m.away_score}
            </b>{" "}
            trận <b>{m.team1} - {m.team2}</b>!
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-white/60">
        Cố đoán thêm, hoặc chờ{" "}
        {data.lastMatch ? (
          <>
            trận cuối của ngày —{" "}
            <b className="text-white/80">
              {data.lastMatch.team1} - {data.lastMatch.team2}
            </b>{" "}
            — kết thúc
          </>
        ) : (
          "các trận còn lại kết thúc"
        )}{" "}
        để <b>chốt sổ ẳm quỹ</b> 💰
      </p>
    </section>
  );
}
