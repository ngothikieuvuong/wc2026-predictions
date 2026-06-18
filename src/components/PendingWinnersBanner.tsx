"use client";

import { useEffect, useState } from "react";
import { getPendingWinners } from "@/lib/queries";

type Data = Awaited<ReturnType<typeof getPendingWinners>>;

// Shown on home / Mọi người / Tổng kết when someone has nailed a match's score
// that admin hasn't chốt'd yet (per-match: each winning match is settleable
// right away).
export default function PendingWinnersBanner() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    getPendingWinners().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.mode === "" || data.matches.length === 0) return null;

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

      <p className="mt-2 text-xs font-semibold text-amber-300">
        ⏳ Chờ admin <b>chốt sổ</b> trận này để ẳm quỹ 💰
      </p>
    </section>
  );
}
