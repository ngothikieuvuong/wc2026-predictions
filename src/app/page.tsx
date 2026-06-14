"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getJackpot,
  getUpcomingSoon,
  getLatestWinner,
  getFundByDay,
} from "@/lib/queries";
import type { Match } from "@/lib/types";
import { formatVND, formatKickoff } from "@/lib/format";

export default function HomePage() {
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [fundByDay, setFundByDay] = useState<
    Awaited<ReturnType<typeof getFundByDay>>
  >([]);
  const [soon, setSoon] = useState<Match[]>([]);
  const [winner, setWinner] = useState<Awaited<
    ReturnType<typeof getLatestWinner>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function loadData() {
    const [j, f, s, w] = await Promise.all([
      getJackpot(),
      getFundByDay(),
      getUpcomingSoon(),
      getLatestWinner(),
    ]);
    setJackpot(j);
    setFundByDay(f);
    setSoon(s);
    setWinner(w);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function syncResults() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setSyncMsg(
          j.updated.length > 0
            ? `✅ Đã cập nhật ${j.updated.length} trận`
            : "✓ Không có trận mới nào kết thúc"
        );
        await loadData();
      } else {
        setSyncMsg("Lỗi: " + (j.error ?? "không rõ"));
      }
    } catch {
      setSyncMsg("Lỗi kết nối — thử lại sau.");
    }
    setSyncing(false);
  }

  return (
    <div className="space-y-6">
      {/* Jackpot */}
      <section className="card text-center">
        <p className="text-sm uppercase tracking-widest text-white/50">
          Quỹ hiện tại
        </p>
        <p className="mt-2 text-4xl font-extrabold text-neon drop-shadow sm:text-5xl">
          {loading || jackpot === null ? "…" : formatVND(jackpot)}
        </p>
        <p className="mt-2 text-xs text-white/40">
          Mỗi lượt góp 20.000₫ · người đoán trúng nhận quỹ
        </p>

        {fundByDay.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-left text-sm">
            <p className="mb-1 text-xs uppercase tracking-wider text-white/40">
              Quỹ theo ngày
            </p>
            {fundByDay.map((d) => (
              <div key={d.date} className="flex items-baseline justify-between gap-2">
                <span className="text-white/70">
                  {d.date.slice(8, 10)}/{d.date.slice(5, 7)}{" "}
                  <span className="text-white/40">
                    ({d.participants.join(", ")})
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{formatVND(d.pot)}</span>
              </div>
            ))}
          </div>
        )}
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
              Đoán ngay
            </Link>
          </div>
        )}
      </section>

      {/* Latest winner */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Người trúng gần nhất
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : winner ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">🏆 {winner.player_name}</p>
              {winner.pay_date && (
                <p className="text-sm text-white/50">
                  Ngày {winner.pay_date.slice(8, 10)}/{winner.pay_date.slice(5, 7)}
                </p>
              )}
            </div>
            <p className="text-xl font-bold text-neon">
              {formatVND(winner.amount)}
            </p>
          </div>
        ) : (
          <p className="text-white/50">Chưa có ai trúng — hãy là người đầu tiên!</p>
        )}
      </section>

      <div className="flex justify-center gap-3">
        <Link href="/predict" className="btn">
          Đoán ngay
        </Link>
        <Link href="/leaderboard" className="btn-ghost">
          Thống kê
        </Link>
      </div>

      {/* Manual results sync */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <button
          onClick={syncResults}
          disabled={syncing}
          className="btn-ghost text-sm"
        >
          {syncing ? "Đang cập nhật…" : "🔄 Cập nhật kết quả"}
        </button>
        {syncMsg && <p className="text-xs text-white/60">{syncMsg}</p>}
      </div>
    </div>
  );
}
