"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPredictionsByMatch } from "@/lib/queries";
import type { Match, Prediction } from "@/lib/types";
import { formatKickoff } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dự đoán mọi người</h1>
        <p className="text-sm text-white/50">
          Tất cả lượt dự đoán của cả nhà, theo từng trận.
        </p>
      </div>

      {loading ? (
        <p className="text-white/40">Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className="card text-center">
          <p className="text-white/50">Chưa có ai dự đoán.</p>
          <Link href="/predict" className="btn mt-3">
            Dự đoán ngay
          </Link>
        </div>
      ) : (
        rows.map(({ match, predictions }) => (
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
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between py-2 ${
                      win ? "text-neon" : ""
                    }`}
                  >
                    <span className="font-medium">
                      {win && "🏆 "}
                      {p.player_name}
                    </span>
                    <span className="font-mono text-lg font-bold">
                      {p.predicted_home}–{p.predicted_away}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-right text-xs text-white/40">
              {predictions.length} lượt dự đoán
            </p>
          </section>
        ))
      )}
    </div>
  );
}
