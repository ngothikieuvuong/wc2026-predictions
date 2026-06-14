"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPredictionsByMatch } from "@/lib/queries";
import type { Match, Prediction } from "@/lib/types";
import { formatKickoff, formatShort } from "@/lib/format";

function isWinner(m: Match, p: Prediction): boolean {
  return (
    m.status === "finished" &&
    p.predicted_home === m.home_score &&
    p.predicted_away === m.away_score
  );
}

export default function PredictionsPage() {
  const [rows, setRows] = useState<
    { match: Match; predictions: Prediction[] }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setRows(await getPredictionsByMatch());
      setLoading(false);
    })();
  }, []);

  // Show matches up to 2 days after kickoff (review window), then hide.
  const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
  const visible = rows.filter(
    (r) => new Date(r.match.kickoff_time).getTime() >= cutoff
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lượt đoán của mọi người</h1>
        <p className="text-sm text-white/50">
          Tất cả lượt đoán của cả nhà, theo từng trận.
        </p>
      </div>

      {loading ? (
        <p className="text-white/40">Đang tải…</p>
      ) : visible.length === 0 ? (
        <div className="card text-center">
          <p className="text-white/50">Chưa có lượt đoán nào gần đây.</p>
          <Link href="/predict" className="btn mt-3">
            Đoán ngay
          </Link>
        </div>
      ) : (
        visible.map(({ match, predictions }) => (
          <section key={match.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">
                  {match.team1}{" "}
                  <span className="text-white/40">gặp</span> {match.team2}
                </p>
                <p className="text-xs text-white/50">
                  ⏱ {formatKickoff(match.kickoff_time)}
                </p>
              </div>
              {match.status === "finished" ? (
                <span className="whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold">
                  KQ: {match.home_score}–{match.away_score}
                </span>
              ) : (
                <span className="whitespace-nowrap rounded-full bg-grass/20 px-2.5 py-0.5 text-xs font-semibold text-grass">
                  Sắp diễn ra
                </span>
              )}
            </div>

            <ul className="divide-y divide-white/5">
              {predictions.map((p) => {
                const win = isWinner(match, p);
                const finished = match.status === "finished";
                // Correct → red & bold; finished but wrong → dimmed; upcoming → normal.
                const tone = win
                  ? "text-red-400 font-bold"
                  : finished
                  ? "text-white/35"
                  : "";
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between gap-2 py-2 ${tone}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">
                        {win && "🎯 "}
                        {p.player_name}
                      </span>
                      <span className="block text-[11px] text-white/30">
                        đoán lúc {formatShort(p.created_at)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-lg font-bold">
                      {p.predicted_home}–{p.predicted_away}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-right text-xs text-white/40">
              {predictions.length} lượt đoán
            </p>
          </section>
        ))
      )}
    </div>
  );
}
