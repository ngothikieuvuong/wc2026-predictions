"use client";

import { useEffect, useState } from "react";
import { getStats, getSettlements } from "@/lib/queries";
import { getLastSettlementDetail, type SettleResult } from "@/lib/admin";
import { formatVND, formatShort } from "@/lib/format";
import PlayerHistoryModal from "@/components/PlayerHistoryModal";
import PendingWinnersBanner from "@/components/PendingWinnersBanner";

type Event = { time: string; lines: { name: string; delta: number }[] };

export default function StatsPage() {
  const [rows, setRows] = useState<
    { name: string; chi: number; thu: number; loiLo: number }[]
  >([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [breakdown, setBreakdown] = useState<SettleResult["breakdown"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [historyName, setHistoryName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [stats, settlements, detail] = await Promise.all([
        getStats(),
        getSettlements(),
        getLastSettlementDetail(), // confirmed division (null until chốt sổ)
      ]);
      setRows(stats);
      setBreakdown(detail);

      // Per-event win/loss = change in cumulative net vs the previous event.
      const evs: Event[] = [];
      settlements.forEach((s, i) => {
        const prev = new Map(
          (i > 0 ? settlements[i - 1].cum : []).map((x) => [x.name, x.value])
        );
        const lines = s.cum
          .map((x) => ({ name: x.name, delta: x.value - (prev.get(x.name) ?? 0) }))
          .filter((l) => l.delta !== 0)
          .sort((a, b) => b.delta - a.delta);
        if (lines.length) evs.push({ time: s.created_at, lines });
      });
      setEvents(evs.reverse()); // newest first
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PendingWinnersBanner />

      <div>
        <h1 className="text-2xl font-bold">Tổng kết</h1>
        <p className="text-sm text-white/50">
          Xếp từ người lời nhiều nhất đến lỗ nhiều nhất.
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-5 text-white/40">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-white/50">Chưa có dữ liệu.</p>
        ) : (
          <table className="w-full text-left text-sm sm:text-base">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-3">Người chơi</th>
                <th className="px-3 py-3 text-right">Chi</th>
                <th className="px-3 py-3 text-right">Thu</th>
                <th className="px-3 py-3 text-right">Lời/Lỗ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pos = r.loiLo > 0;
                const neg = r.loiLo < 0;
                return (
                  <tr
                    key={r.name}
                    className="border-b border-white/5 last:border-0 hover:bg-white/5"
                  >
                    <td className="px-3 py-3 font-semibold">
                      <button
                        onClick={() => setHistoryName(r.name)}
                        className="text-left underline decoration-white/20 underline-offset-2 hover:decoration-white"
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right text-white/70">
                      {formatVND(r.chi)}
                    </td>
                    <td className="px-3 py-3 text-right text-white/70">
                      {formatVND(r.thu)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-bold ${
                        pos ? "text-neon" : neg ? "text-red-400" : "text-white/50"
                      }`}
                    >
                      {pos ? "+" : ""}
                      {formatVND(r.loiLo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* How the settled fund was divided */}
      {breakdown && breakdown.winners.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
            Quỹ đã chia
          </h2>
          <div className="card space-y-3">
            <p className="text-xs text-white/50">
              Tổng quỹ <b className="text-white/80">{formatVND(breakdown.fund)}</b> →
              thưởng <b className="text-neon">{formatVND(breakdown.winTotal)}</b> cho
              người trúng
              {breakdown.carried > 0 && (
                <>
                  , còn <b>{formatVND(breakdown.carried)}</b> giữ làm quỹ treo
                </>
              )}
              .
            </p>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                🎯 Người trúng tỉ số
              </p>
              <ul className="divide-y divide-white/10">
                {breakdown.winners.map((w) => (
                  <li
                    key={w.name}
                    className="flex items-center justify-between py-1.5 text-sm"
                  >
                    <span>
                      <b>{w.name}</b>{" "}
                      <span className="text-white/40">· trúng {w.correct} tỉ số</span>
                    </span>
                    <span className="font-bold text-neon">{formatVND(w.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {breakdown.carried > 0 && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
                Còn <b>{formatVND(breakdown.carried)}</b> giữ làm <b>quỹ treo</b> —
                cộng vào đợt tất toán sau, chia theo công thức bình thường.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Settlement history */}
      {events.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
            Lịch sử tất toán
          </h2>
          {events.map((e, i) => (
            <div key={i} className="card">
              <p className="mb-2 text-xs text-white/40">
                ⏱ {formatShort(e.time)}
              </p>
              <ul className="divide-y divide-white/5">
                {e.lines.map((l) => (
                  <li key={l.name} className="flex justify-between py-1.5 text-sm">
                    <span className="font-medium">{l.name}</span>
                    <span
                      className={`font-bold ${
                        l.delta > 0 ? "text-neon" : "text-red-400"
                      }`}
                    >
                      {l.delta > 0 ? "+" : ""}
                      {formatVND(l.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {historyName && (
        <PlayerHistoryModal
          name={historyName}
          onClose={() => setHistoryName(null)}
        />
      )}
    </div>
  );
}
