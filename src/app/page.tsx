"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getJackpot,
  getUpcomingByDay,
  getLatestWinners,
  getFundByMatch,
  getPredictionsByMatch,
  getStats,
} from "@/lib/queries";
import { formatKickoff } from "@/lib/format";
import { Money } from "@/components/Money";
import { dayLabel } from "@/lib/day";
import { getLive, findLive, type LiveScore } from "@/lib/liveClient";
import { autoSync } from "@/lib/syncClient";
import LiveBar from "@/components/LiveBar";
import { useRefresh } from "@/components/Refresh";
import MatchInfoButton from "@/components/MatchInfoButton";
import PendingWinnersBanner from "@/components/PendingWinnersBanner";
import JustWonBanner from "@/components/JustWonBanner";
import StarAlert from "@/components/StarAlert";
import { loseMessage, allMissMessage, winMessage } from "@/lib/tease";

export default function HomePage() {
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [fundByMatch, setFundByMatch] = useState<
    Awaited<ReturnType<typeof getFundByMatch>>
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
  // Pin a compact "Quỹ hiện tại" bar under the tabs once the big one scrolls off.
  const jackpotRef = useRef<HTMLElement>(null);
  const loadSeq = useRef(0); // ignore stale loads that resolve out of order
  const [showFundBar, setShowFundBar] = useState(false);

  useEffect(() => {
    const el = jackpotRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShowFundBar(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading]);

  async function loadData() {
    const seq = ++loadSeq.current;
    const [j, f, s, w, lv, pr, st] = await Promise.all([
      getJackpot(),
      getFundByMatch(),
      getUpcomingByDay(),
      getLatestWinners(4),
      getLive(),
      getPredictionsByMatch(),
      getStats(),
    ]);
    if (seq !== loadSeq.current) return; // a newer refresh superseded this one
    setJackpot(j);
    setFundByMatch(f);
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

  // Re-fetch when the global "Cập nhật tỉ số" button is tapped.
  const { tick } = useRefresh();
  useEffect(() => {
    if (tick) loadData();
  }, [tick]);

  return (
    <div className="space-y-6">
      {/* Live score bar — freezes under the nav on scroll */}
      <LiveBar live={live} />

      {/* Compact fund bar pinned under the tabs while scrolling (below live bar) */}
      <div
        className={`fixed inset-x-0 z-20 transition-all duration-300 ${
          showFundBar
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        style={{ top: "calc(var(--nav-h) + var(--live-h, 0px))" }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <div className="bar-bg flex items-center justify-between rounded-b-xl border border-t-0 border-white/10 px-4 py-1.5 shadow-lux backdrop-blur-xl">
            <span className="text-[11px] uppercase tracking-wider text-white/50">
              Quỹ hiện tại
            </span>
            <span className="text-sm font-bold text-neon">
              {jackpot === null ? "…" : <Money value={jackpot} />}
            </span>
          </div>
        </div>
      </div>

      <PendingWinnersBanner />
      <JustWonBanner />

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
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-red-500/30 bg-red-500/5"
                >
                  <MatchInfoButton team1={m.home} team2={m.away} started>
                    <div className="px-4 py-3 transition hover:bg-red-500/10">
                      <div className="flex items-center justify-between gap-3">
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

                      {((m.homeGoals?.length ?? 0) + (m.awayGoals?.length ?? 0)) > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-3 border-t border-white/10 pt-2 text-[11px] leading-tight text-white/55">
                          <div className="space-y-0.5">
                            {(m.homeGoals ?? []).map((g, k) => (
                              <p key={k} className="truncate">
                                ⚽ {g.player} {g.minute}
                                {g.note ? ` (${g.note})` : ""}
                              </p>
                            ))}
                          </div>
                          <div className="space-y-0.5 text-right">
                            {(m.awayGoals ?? []).map((g, k) => (
                              <p key={k} className="truncate">
                                {g.player} {g.minute}
                                {g.note ? ` (${g.note})` : ""} ⚽
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </MatchInfoButton>

                  {(winners.length > 0 ||
                    allGone ||
                    possible.length > 0 ||
                    gone.length > 0) && (
                    <div className="space-y-1.5 border-t border-white/10 px-3 py-2.5">
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
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Jackpot — the centerpiece */}
      <section
        ref={jackpotRef}
        className="card relative overflow-hidden text-center shadow-gold ring-1 ring-gold/20"
      >
        {/* soft golden spotlight behind the number */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-10 h-40 bg-[radial-gradient(closest-side,rgba(233,201,124,0.18),transparent)]"
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/80">
          🏆 Tổng quỹ hiện tại
        </p>
        <p className="relative mt-2 bg-gradient-to-b from-white via-neon to-grass bg-clip-text text-5xl font-extrabold tracking-tight text-transparent drop-shadow-[0_2px_16px_rgba(255,255,255,0.18)] sm:text-6xl">
          {loading || jackpot === null ? "…" : <Money value={jackpot} />}
        </p>

        {fundByMatch.length > 0 && (
          <div className="relative mt-5 space-y-3 text-left text-sm">
            <hr className="divider-lux" />
            <p className="section-title pt-1">Quỹ theo trận</p>
            {fundByMatch.map((g) => (
              <div
                key={g.date}
                className={`rounded-xl border border-white/10 bg-black/20 p-3 ${
                  g.counted ? "" : "opacity-40"
                }`}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Ngày {dayLabel(g.date)}
                    {!g.counted && (
                      <span className="text-white/30"> · chưa tính</span>
                    )}
                  </span>
                </div>

                <ul className="space-y-0.5">
                  {g.matches.map((m, i) => (
                    <li
                      key={i}
                      className={`flex items-baseline justify-between gap-2 border-b border-white/5 py-1 last:border-0 ${
                        m.treo ? "rounded-lg bg-amber-400/5 px-1.5" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={m.treo ? "text-amber-300/90" : "text-white/80"}>
                          {m.team1 ? (
                            <>
                              {m.team1} <span className="text-white/30">–</span>{" "}
                              {m.team2}
                            </>
                          ) : (
                            "Quỹ treo trước"
                          )}
                        </span>
                        <span className="block text-[11px] text-white/40">
                          {m.participants.join(", ") || "—"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-1.5">
                        {m.treo && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-amber-300/80">
                            treo
                          </span>
                        )}
                        <span
                          className={`font-semibold ${m.treo ? "text-amber-300" : ""}`}
                        >
                          <Money value={m.pot} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/predict"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl accent-grad px-6 py-4 text-xl font-extrabold shadow-glow transition hover:brightness-110 active:scale-[0.98]"
        >
          ⚽ Đoán Ngay
        </Link>
      </section>

      {/* Upcoming matches, grouped by game-day */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="section-title">Trận sắp tới</h2>
          <Link
            href="/giai"
            className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            Xem lịch đầy đủ
          </Link>
        </div>
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
                  <div key={m.id} className="space-y-1.5">
                  <MatchInfoButton team1={m.team1} team2={m.team2}>
                    <div
                      className={`relative flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                        m.is_open
                          ? "border-grass/30 bg-grass/[0.06] hover:border-grass/50"
                          : "border-white/10 bg-black/20 hover:border-white/25"
                      }`}
                    >
                      {m.is_open && (
                        <span
                          title="Đang mở đoán"
                          className="absolute -right-1.5 -top-2 text-base drop-shadow"
                        >
                          🔥
                        </span>
                      )}
                      <div className="font-bold">
                        {m.team1} <span className="text-white/40">gặp</span>{" "}
                        {m.team2}
                      </div>
                      <div className="whitespace-nowrap text-sm text-white/60">
                        {m.match_no ? (
                          <span className="text-gold/70">Trận {m.match_no} · </span>
                        ) : null}
                        ⏱ {formatKickoff(m.kickoff_time)}
                      </div>
                    </div>
                  </MatchInfoButton>
                  {m.is_open && <StarAlert team1={m.team1} team2={m.team2} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent winners */}
      <section className="card">
        <h2 className="mb-3 section-title">
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
                  <p className="font-bold text-neon"><Money value={w.amount} /></p>
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
        <h2 className="mb-3 section-title">
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
                        <Money value={s.loiLo} />
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
