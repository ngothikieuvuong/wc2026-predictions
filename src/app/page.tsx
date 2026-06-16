"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getJackpot,
  getUpcomingByDay,
  getLatestWinner,
  getFundByDay,
  getPredictionsByMatch,
} from "@/lib/queries";
import { formatVND, formatKickoff } from "@/lib/format";
import { dayLabel } from "@/lib/day";
import { getLive, findLive, type LiveScore } from "@/lib/liveClient";
import { autoSync } from "@/lib/syncClient";
import MatchInfoButton from "@/components/MatchInfoButton";

export default function HomePage() {
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [fundByDay, setFundByDay] = useState<
    Awaited<ReturnType<typeof getFundByDay>>
  >([]);
  const [soon, setSoon] = useState<
    Awaited<ReturnType<typeof getUpcomingByDay>>
  >([]);
  const [winner, setWinner] = useState<Awaited<
    ReturnType<typeof getLatestWinner>
  > | null>(null);
  const [live, setLive] = useState<LiveScore[]>([]);
  const [predRows, setPredRows] = useState<
    Awaited<ReturnType<typeof getPredictionsByMatch>>
  >([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [j, f, s, w, lv, pr] = await Promise.all([
      getJackpot(),
      getFundByDay(),
      getUpcomingByDay(),
      getLatestWinner(),
      getLive(),
      getPredictionsByMatch(),
    ]);
    setJackpot(j);
    setFundByDay(f);
    setSoon(s);
    setWinner(w);
    setLive(lv);
    setPredRows(pr);
    setLoading(false);
  }

  // Predictions whose score currently equals the live score of an in-play match.
  const nearHits: {
    name: string;
    team1: string;
    team2: string;
    ph: number;
    pa: number;
    minute: string;
  }[] = [];
  for (const { match, predictions } of predRows) {
    const li = findLive(live, match.team1, match.team2);
    if (!li) continue;
    for (const p of predictions) {
      if (p.predicted_home === li.t1 && p.predicted_away === li.t2) {
        nearHits.push({
          name: p.player_name,
          team1: match.team1,
          team2: match.team2,
          ph: p.predicted_home,
          pa: p.predicted_away,
          minute: li.minute,
        });
      }
    }
  }

  useEffect(() => {
    loadData();
    // Pull fresh FIFA scores on load; reload if anything changed.
    autoSync().then((changed) => {
      if (changed) loadData();
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Predictions currently matching the live score */}
      {nearHits.length > 0 && (
        <section className="card border-grass/40 bg-grass/5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-grass">
            <span className="h-2 w-2 animate-pulse rounded-full bg-grass" />
            Đang trùng tỉ số
          </h2>
          <ul className="space-y-2">
            {nearHits.map((h, i) => (
              <li key={i}>
                <p className="font-semibold text-grass">
                  Chúc mừng {h.name}, gần trúng rồi 😃
                </p>
                <p className="text-xs text-white/50">
                  {h.team1} <b className="text-white/80">{h.ph}–{h.pa}</b> {h.team2}
                  {h.minute ? ` · ${h.minute}` : ""}
                </p>
              </li>
            ))}
          </ul>
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
        <p className="mt-2 text-xs text-white/40">
          Mỗi lượt góp 20.000₫ · người đoán trúng nhận quỹ
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
      </section>

      {/* Live matches */}
      {live.length > 0 && (
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-white/50">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            Đang diễn ra
          </h2>
          <div className="space-y-2">
            {live.map((m, i) => (
              <MatchInfoButton
                key={i}
                team1={m.home}
                team2={m.away}
                started
              >
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
            ))}
          </div>
        </section>
      )}

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
    </div>
  );
}
