"use client";

import { useEffect, useState } from "react";
import type { GroupTable, BracketRound, Fixture } from "@/lib/tournament";
import { getMatchResults } from "@/lib/queries";
import { formatKickoff } from "@/lib/format";

type Results = Awaited<ReturnType<typeof getMatchResults>>;

// "15/06" / "01:00" in Vietnam time from a FIFA UTC ISO string.
function viDay(iso: string): string {
  const v = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}`;
}
function viTime(iso: string): string {
  const v = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`;
}

const TABS = [
  { key: "nhanh", label: "Lịch thi đấu" },
  { key: "ketqua", label: "Kết quả" },
  { key: "bang", label: "Bảng xếp hạng" },
] as const;

export default function GiaiTabs({
  groups,
  groupFixtures,
  rounds,
  error,
}: {
  groups: GroupTable[];
  groupFixtures: Fixture[];
  rounds: BracketRound[];
  error?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("nhanh");
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    if (tab === "ketqua" && results === null) getMatchResults().then(setResults);
  }, [tab, results]);

  // Group upcoming group-stage fixtures by day (already sorted by date).
  const fxGroups: { day: string; items: Fixture[] }[] = [];
  for (const f of groupFixtures) {
    const day = viDay(f.date);
    const last = fxGroups[fxGroups.length - 1];
    if (!last || last.day !== day) fxGroups.push({ day, items: [f] });
    else last.items.push(f);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Lịch và kết quả</h1>
        <p className="text-sm text-white/50">
          Lịch thi đấu, kết quả các trận và bảng xếp hạng.
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
          {fxGroups.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-bold">Vòng bảng — sắp tới</h3>
              {fxGroups.map((g) => (
                <div key={g.day} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    {g.day}
                  </p>
                  {g.items.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm"
                    >
                      <span className="w-11 shrink-0 text-xs text-white/40">
                        {viTime(m.date)}
                      </span>
                      <span className="flex-1 text-right font-medium">{m.home}</span>
                      <span className="text-xs text-white/40">vs</span>
                      <span className="flex-1 font-medium">{m.away}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {rounds.length > 0 && (
            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wider text-white/40">
              Vòng loại trực tiếp
            </p>
          )}
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
