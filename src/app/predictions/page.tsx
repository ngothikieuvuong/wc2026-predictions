"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPredictionsByMatch } from "@/lib/queries";
import type { Match, Prediction } from "@/lib/types";
import { formatKickoff, formatShort } from "@/lib/format";
import { dayKey, dayLabel } from "@/lib/day";

type Row = { match: Match; predictions: Prediction[] };
type DayGroup = { day: string; items: Row[]; finished: boolean };

function isWinner(m: Match, p: Prediction): boolean {
  return (
    m.status === "finished" &&
    p.predicted_home === m.home_score &&
    p.predicted_away === m.away_score
  );
}

function MatchCard({ match, predictions }: Row) {
  const finished = match.status === "finished";
  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {match.team1} <span className="text-white/40">gặp</span> {match.team2}
          </p>
          <p className="text-xs text-white/50">⏱ {formatKickoff(match.kickoff_time)}</p>
        </div>
        {finished ? (
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

      <p className="text-right text-xs text-white/40">{predictions.length} lượt đoán</p>
    </section>
  );
}

function DayBlock({ group, label }: { group: DayGroup; label?: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
        {label ?? `Ngày ${dayLabel(group.day)}`}
      </h2>
      {group.items.map((r) => (
        <MatchCard key={r.match.id} {...r} />
      ))}
    </div>
  );
}

export default function PredictionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOld, setShowOld] = useState(false);

  useEffect(() => {
    (async () => {
      setRows(await getPredictionsByMatch());
      setLoading(false);
    })();
  }, []);

  // Group by game-day (rows already sorted by kickoff asc).
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const d = dayKey(r.match.kickoff_time);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(r);
  }
  const groups: DayGroup[] = [...map.entries()].map(([day, items]) => ({
    day,
    items,
    finished: items.every(
      (r) => r.match.status === "finished" && r.match.home_score != null
    ),
  }));

  const upcoming = groups
    .filter((g) => !g.finished)
    .sort((a, b) => (a.day < b.day ? -1 : 1)); // soonest first
  const finishedDesc = groups
    .filter((g) => g.finished)
    .sort((a, b) => (a.day > b.day ? -1 : 1)); // most recent first
  const justEnded = finishedDesc[0];
  const older = finishedDesc.slice(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lượt đoán của mọi người</h1>
        <p className="text-sm text-white/50">
          Trận sắp diễn ra ở trên, ngày vừa xong mờ bên dưới.
        </p>
      </div>

      {loading ? (
        <p className="text-white/40">Đang tải…</p>
      ) : groups.length === 0 ? (
        <div className="card text-center">
          <p className="text-white/50">Chưa có ai đoán.</p>
          <Link href="/predict" className="btn mt-3">
            Đoán ngay
          </Link>
        </div>
      ) : (
        <>
          {upcoming.map((g) => (
            <DayBlock key={g.day} group={g} />
          ))}

          {justEnded && (
            <div className="opacity-70">
              <DayBlock
                group={justEnded}
                label={`Vừa kết thúc · Ngày ${dayLabel(justEnded.day)}`}
              />
            </div>
          )}

          {older.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowOld((v) => !v)}
                className="text-sm font-semibold text-white/60 hover:text-white"
              >
                {showOld ? "▾" : "▸"} Các ngày trước ({older.length})
              </button>
              {showOld &&
                older.map((g) => (
                  <div key={g.day} className="opacity-70">
                    <DayBlock group={g} />
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
