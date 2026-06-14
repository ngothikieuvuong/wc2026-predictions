"use client";

import { useEffect, useState } from "react";
import type { GroupTable, BracketRound } from "@/lib/tournament";
import { getMatchResults } from "@/lib/queries";
import { formatKickoff } from "@/lib/format";

type Results = Awaited<ReturnType<typeof getMatchResults>>;

const TABS = [
  { key: "bang", label: "Bảng xếp hạng" },
  { key: "nhanh", label: "Nhánh đấu" },
  { key: "ketqua", label: "Kết quả" },
] as const;

export default function GiaiTabs({
  groups,
  rounds,
  error,
}: {
  groups: GroupTable[];
  rounds: BracketRound[];
  error?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("bang");
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    if (tab === "ketqua" && results === null) getMatchResults().then(setResults);
  }, [tab, results]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Giải đấu</h1>
        <p className="text-sm text-white/50">
          Bảng xếp hạng, nhánh đấu tới chung kết và kết quả các trận.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-black/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-grass text-black" : "text-white/60 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="card text-white/50">Không tải được dữ liệu giải đấu.</div>
      )}

      {/* Standings */}
      {tab === "bang" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.name} className="card p-0 overflow-hidden">
                <div className="border-b border-white/10 px-4 py-2 text-sm font-bold">
                  Bảng {g.name.replace("Group ", "")}
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Đội</th>
                      <th className="px-2 py-2 text-center font-medium">Tr</th>
                      <th className="px-2 py-2 text-center font-medium">Hiệu</th>
                      <th className="px-3 py-2 text-center font-medium">Đ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr
                        key={r.name}
                        className={`border-t border-white/5 ${i < 2 ? "bg-grass/10" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <span className="mr-2 text-white/40">{i + 1}</span>
                          {r.name}
                        </td>
                        <td className="px-2 py-2 text-center text-white/60">{r.P}</td>
                        <td className="px-2 py-2 text-center text-white/60">
                          {r.GD > 0 ? `+${r.GD}` : r.GD}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{r.Pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30">2 đội đầu mỗi bảng (xanh) đi tiếp.</p>
        </div>
      )}

      {/* Bracket */}
      {tab === "nhanh" && (
        <div className="space-y-4">
          {rounds.map((round) => (
            <div key={round.name} className="card space-y-2">
              <h3 className="font-bold">{round.name}</h3>
              <ul className="space-y-1.5">
                {round.matches.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 text-right font-medium">{m.home}</span>
                    <span className="min-w-14 text-center font-bold text-white/80">
                      {m.played ? `${m.hs}–${m.as}` : "vs"}
                    </span>
                    <span className="flex-1 font-medium">{m.away}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {tab === "ketqua" && (
        <div className="card p-0 overflow-hidden">
          {results === null ? (
            <p className="p-4 text-white/40">Đang tải…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-white/50">Chưa có trận nào kết thúc.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {results.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 text-right text-sm font-medium">
                      {m.team1}
                    </span>
                    <span className="min-w-16 text-center text-lg font-bold">
                      {m.home_score}–{m.away_score}
                    </span>
                    <span className="flex-1 text-sm font-medium">{m.team2}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/30">
                      {formatKickoff(m.kickoff_time)}
                    </span>
                    {m.winners.length > 0 && (
                      <span className="text-xs font-semibold text-neon">
                        🎯 {m.winners.join(", ")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
