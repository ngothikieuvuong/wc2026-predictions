"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJackpot, getNextMatch, getLatestWinner } from "@/lib/queries";
import type { Match } from "@/lib/types";
import { formatVND, formatKickoff } from "@/lib/format";

export default function HomePage() {
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [next, setNext] = useState<Match | null>(null);
  const [winner, setWinner] = useState<Awaited<
    ReturnType<typeof getLatestWinner>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [j, n, w] = await Promise.all([
        getJackpot(),
        getNextMatch(),
        getLatestWinner(),
      ]);
      setJackpot(j);
      setNext(n);
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

      {/* Next match */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Trận kế tiếp
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : next ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center gap-4 text-2xl font-bold">
              <span>{next.team1}</span>
              <span className="text-white/40">gặp</span>
              <span>{next.team2}</span>
            </div>
            <p className="text-white/60">⏱ {formatKickoff(next.kickoff_time)}</p>
            <Link href="/predict" className="btn mt-1">
              Dự đoán ngay
            </Link>
          </div>
        ) : (
          <p className="text-white/50">Chưa có trận nào sắp diễn ra.</p>
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
