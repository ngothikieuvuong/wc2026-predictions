"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJackpot, getUpcomingSoon, getLatestWinner } from "@/lib/queries";
import type { Match } from "@/lib/types";
import { formatVND, formatKickoff } from "@/lib/format";

export default function HomePage() {
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [soon, setSoon] = useState<Match[]>([]);
  const [winner, setWinner] = useState<Awaited<
    ReturnType<typeof getLatestWinner>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [j, s, w] = await Promise.all([
        getJackpot(),
        getUpcomingSoon(),
        getLatestWinner(),
      ]);
      setJackpot(j);
      setSoon(s);
      setWinner(w);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Jackpot */}
      <section className="card text-center">
        <p className="text-sm uppercase tracking-widest text-white/50">
          Hũ thưởng hiện tại
        </p>
        <p className="mt-2 text-4xl font-extrabold text-neon drop-shadow sm:text-5xl">
          {loading || jackpot === null ? "…" : formatVND(jackpot)}
        </p>
        <p className="mt-2 text-xs text-white/40">
          +20.000₫ mỗi lượt dự đoán · người thắng nhận hết
        </p>
      </section>

      {/* Upcoming matches: today & tomorrow */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Trận sắp tới
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : soon.length === 0 ? (
          <p className="text-white/50">Chưa có trận nào sắp diễn ra.</p>
        ) : (
          <div className="space-y-2">
            {soon.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="font-bold">
                  {m.team1} <span className="text-white/40">gặp</span> {m.team2}
                </div>
                <div className="whitespace-nowrap text-sm text-white/60">
                  ⏱ {formatKickoff(m.kickoff_time)}
                </div>
              </div>
            ))}
            <Link href="/predict" className="btn mt-2 w-full">
              Dự đoán ngay
            </Link>
          </div>
        )}
      </section>

      {/* Latest winner */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Người thắng gần nhất
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : winner ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">🏆 {winner.player_name}</p>
              {winner.match && (
                <p className="text-sm text-white/50">
                  {winner.match.team1} {winner.match.home_score}–
                  {winner.match.away_score} {winner.match.team2}
                </p>
              )}
            </div>
            <p className="text-xl font-bold text-neon">
              {formatVND(winner.amount)}
            </p>
          </div>
        ) : (
          <p className="text-white/50">Chưa có ai thắng — hãy là người đầu tiên!</p>
        )}
      </section>

      <div className="flex justify-center gap-3">
        <Link href="/predict" className="btn">
          Dự đoán
        </Link>
        <Link href="/leaderboard" className="btn-ghost">
          Bảng xếp hạng
        </Link>
      </div>
    </div>
  );
}
