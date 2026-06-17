"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getJackpot,
  getUpcomingByDay,
  getLatestWinners,
  getFundByDay,
  getPredictionsByMatch,
  getStats,
} from "@/lib/queries";
import { formatVND, formatKickoff } from "@/lib/format";
import { dayLabel } from "@/lib/day";
import { getLive, findLive, type LiveScore } from "@/lib/liveClient";
import { autoSync } from "@/lib/syncClient";
import MatchInfoButton from "@/components/MatchInfoButton";
import PendingWinnersBanner from "@/components/PendingWinnersBanner";
import { loseMessage, allMissMessage, winMessage } from "@/lib/tease";

export default function HomePage() {
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [fundByDay, setFundByDay] = useState<
    Awaited<ReturnType<typeof getFundByDay>>
  >([]);
  const [soon, setSoon] = useState<
    Awaited<ReturnType<typeof getUpcomingByDay>>
  >([]);
  const [winners, setWinners] = useState<
    Awaited<ReturnType<typeof getLatestWinners>>
  >([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getStats>>>([]);
  const [live, setLive] = useState<LiveScore[]>([]);
  const [predRows, setPredRows] = useState<
    Awaited<ReturnType<typeof getPredictionsByMatch>>
  >([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [j, f, s, w, lv, pr, st] = await Promise.all([
      getJackpot(),
      getFundByDay(),
      getUpcomingByDay(),
      getLatestWinners(4),
      getLive(),
      getPredictionsByMatch(),
      getStats(),
    ]);
    setJackpot(j);
    setFundByDay(f);
    setSoon(s);
    setWinners(w);
    setLive(lv);
    setPredRows(pr);
    setStats(st);
    setLoading(false);
  }

  // Match our prediction rows to FIFA live matches (team pair, order-free).
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const pairKey = (a: string, b: string) => [norm(a), norm(b)].sort().join("|");
  const predByPair = new Map(
    predRows.map((r) => [pairKey(r.match.team1, r.match.team2), r])
  );

  // For a live match, each prediction's status vs the live score. Scores only
  // go up, so a prediction is still reachable if it's ≥ the current score on
  // both sides; "exact" = currently matching; otherwise it's already gone.
  const predsForLive = (m: LiveScore) => {
    const row = predByPair.get(pairKey(m.home, m.away));
    const li = row ? findLive(live, row.match.team1, row.match.team2) : null;
    if (!row || !li) return [];
    return row.predictions
      .map((p) => {
        const reachable =
          p.predicted_home >= li.t1 && p.predicted_away >= li.t2;
        const exact = p.predicted_home === li.t1 && p.predicted_away === li.t2;
        const status = exact ? "exact" : reachable ? "possible" : "gone";
        // Distance = extra goals still needed (closest to winning = smallest).
        const dist = reachable
          ? p.predicted_home - li.t1 + (p.predicted_away - li.t2)
          : Infinity;
        return {
          id: p.id,
          name: p.player_name,
          ph: p.predicted_home,
          pa: p.predicted_away,
          status: status as "exact" | "possible" | "gone",
          dist,
        };
      })
      .sort((a, b) => a.dist - b.dist); // closest to winning first
  };

  useEffect(() => {
    loadData();
    // Pull fresh FIFA scores on load; reload if anything changed.
    autoSync().then((changed) => {
      if (changed) loadData();
    });
  }, []);

  return (
    <div className="space-y-6">
      <PendingWinnersBanner />

      {/* Live matches — with each prediction's status vs the live score */}
      {live.length > 0 && (
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-white/50">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            Đang diễn ra
          </h2>
          <div className="space-y-3">
            {live.map((m, i) => {
              const preds = predsForLive(m);
              const winners = preds.filter((p) => p.status === "exact");
              const possible = preds.filter((p) => p.status === "possible");
              const gone = preds.filter((p) => p.status === "gone");
              // Pot looks set to grow only if NOBODY can still win.
              const allGone =
                preds.length > 0 && winners.length === 0 && possible.length === 0;
              return (
                <div key={i} className="space-y-1.5">
                  <MatchInfoButton team1={m.home} team2={m.away} started>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 transition hover:border-red-500/50">
                      <div className="font-bold">
                        {m.home} <span className="text-white/40">gặp</span> {m.away}
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-mono text-lg font-extrabold">
                          {m.homeScore}–{m.awayScore}
                        </span>
                        {m.minute && (
                          <span className="text-xs font-semibold text-red-300">
                            {m.minute}
                          </span>
                        )}
                      </div>
                    </div>
                  </MatchInfoButton>

                  {winners.length > 0 && (
                    <p className="rounded-lg bg-grass/15 px-3 py-1.5 text-center text-sm font-bold text-grass">
                      {winMessage(m.home + m.away, winners.map((w) => w.name))}
                    </p>
                  )}

                  {allGone && (
                    <p className="rounded-lg bg-red-500/15 px-3 py-1.5 text-center text-sm font-bold text-red-400">
                      {allMissMessage(m.home + m.away)}
                    </p>
                  )}

                  {(possible.length > 0 || gone.length > 0) && (
                    <ul className="space-y-1 px-1">
                      {possible.map((pr) => (
                        <li
                          key={pr.id}
                          className="flex items-center justify-between gap-2 text-sm text-white/80"
                        >
                          <span>🤞 {pr.name} — còn cơ hội</span>
                          <span className="shrink-0 font-mono font-semibold">
                            {pr.ph}–{pr.pa}
                          </span>
                        </li>
                      ))}
                      {gone.map((pr) => (
                        <li
                          key={pr.id}
                          className="flex items-center justify-between gap-2 text-sm text-white/35"
                        >
                          <span>
                            {pr.name} — {loseMessage(pr.id)}
                          </span>
                          <span className="shrink-0 font-mono">
                            {pr.ph}–{pr.pa}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Jackpot */}
      <section className="card text-center">
        <p className="text-sm uppercase tracking-widest text-white/50">
          Quỹ hiện tại
        </p>
        <p className="mt-2 text-4xl font-extrabold text-neon drop-shadow sm:text-5xl">
          {loading || jackpot === null ? "…" : formatVND(jackpot)}
        </p>

        {fundByDay.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-left text-sm">
            <p className="mb-1 text-xs uppercase tracking-wider text-white/40">
              Quỹ theo ngày
            </p>
            {fundByDay.map((d) => (
              <div
                key={d.date}
                className={`flex items-baseline justify-between gap-2 ${
                  d.counted ? "" : "opacity-40"
                }`}
              >
                <span className="text-white/70">
                  {dayLabel(d.date)}{" "}
                  <span className="text-white/40">
                    ({d.participants.join(", ")})
                  </span>
                  {!d.counted && <span className="text-white/30"> · chưa tính</span>}
                </span>
                <span className="shrink-0 font-semibold">{formatVND(d.pot)}</span>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/predict"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-grass px-6 py-4 text-xl font-extrabold text-black shadow-lg shadow-grass/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          ⚽ Đoán Ngay
        </Link>
      </section>

      {/* Upcoming matches, grouped by game-day */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Trận sắp tới
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : soon.length === 0 ? (
          <p className="text-white/50">Chưa có trận nào sắp diễn ra.</p>
        ) : (
          <div className="space-y-3">
            {soon.map((g) => (
              <div key={g.day} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  Ngày {dayLabel(g.day)}
                </p>
                {g.matches.map((m) => (
                  <MatchInfoButton key={m.id} team1={m.team1} team2={m.team2}>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/25">
                      <div className="font-bold">
                        {m.team1} <span className="text-white/40">gặp</span>{" "}
                        {m.team2}
                      </div>
                      <div className="whitespace-nowrap text-sm text-white/60">
                        ⏱ {formatKickoff(m.kickoff_time)}
                      </div>
                    </div>
                  </MatchInfoButton>
                ))}
              </div>
            ))}
            <Link href="/giai" className="btn-ghost mt-2 w-full">
              📅 Xem lịch đầy đủ
            </Link>
          </div>
        )}
      </section>

      {/* Recent winners */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Danh sách đã trúng thưởng
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : winners.length === 0 ? (
          <p className="text-white/50">Chưa có ai trúng — hãy là người đầu tiên!</p>
        ) : (
          <>
            <ul className="divide-y divide-white/10">
              {winners.map((w, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div>
                    <p className="font-bold">🏆 {w.player_name}</p>
                    {w.pay_date && (
                      <p className="text-xs text-white/50">
                        Ngày {w.pay_date.slice(8, 10)}/{w.pay_date.slice(5, 7)}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-neon">{formatVND(w.amount)}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/history#lich-su-tat-toan"
              className="btn-ghost mt-3 w-full"
            >
              Xem chi tiết
            </Link>
          </>
        )}
      </section>

      {/* Profit/loss summary */}
      <section className="card">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
          Ai đang ăn / thua
        </h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : stats.filter((s) => s.chi > 0 || s.thu > 0).length === 0 ? (
          <p className="text-white/50">Chưa có dữ liệu.</p>
        ) : (
          <>
            <ul className="divide-y divide-white/10">
              {stats
                .filter((s) => s.chi > 0 || s.thu > 0)
                .map((s) => {
                  const pos = s.loiLo > 0;
                  const neg = s.loiLo < 0;
                  return (
                    <li
                      key={s.name}
                      className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span
                        className={`font-bold ${
                          pos ? "text-neon" : neg ? "text-red-400" : "text-white/50"
                        }`}
                      >
                        {pos ? "+" : ""}
                        {formatVND(s.loiLo)}
                      </span>
                    </li>
                  );
                })}
            </ul>
            <Link href="/leaderboard" className="btn-ghost mt-3 w-full">
              Xem chi tiết
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
