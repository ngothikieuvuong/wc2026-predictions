"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSettlements } from "@/lib/queries";
import { getLastSettlementDetail, type SettleResult } from "@/lib/admin";
import { formatVND, formatShort } from "@/lib/format";
import { dayLabel } from "@/lib/day";

type Event = { time: string; lines: { name: string; delta: number }[] };

export default function HistoryPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [breakdown, setBreakdown] = useState<SettleResult["breakdown"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [settlements, detail] = await Promise.all([
        getSettlements(),
        getLastSettlementDetail(), // confirmed division (null until chốt sổ)
      ]);
      setBreakdown(detail);

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
      <div>
        <Link
          href="/leaderboard"
          className="text-sm text-white/50 transition hover:text-white"
        >
          ← Về Tổng kết
        </Link>
        <h1 className="title-lux mt-1 text-2xl">Lịch sử chia quỹ</h1>
        <p className="text-sm text-white/50">
          Chi tiết lần chia gần nhất và toàn bộ các lần tất toán đã xác nhận.
        </p>
      </div>

      {loading && <p className="text-white/40">Đang tải…</p>}

      {/* How the latest settled fund was divided */}
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
                  , còn <b>{formatVND(breakdown.carried)}</b> giữ làm quỹ treo cho đợt
                  sau
                </>
              )}
              .
            </p>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                🎯 Người trúng tỉ số — vì sao chia vậy?
              </p>
              <ul className="space-y-2">
                {breakdown.winners.map((w) => {
                  const pct = Math.round(
                    (w.correct / (breakdown.totalCorrect || 1)) * 100
                  );
                  return (
                    <li key={w.name} className="rounded-lg bg-black/20 p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          <b>{w.name}</b>{" "}
                          <span className="text-[11px] text-white/40">
                            trúng {w.correct}/{breakdown.totalCorrect} · tỉ lệ {pct}%
                          </span>
                        </span>
                        <span className="font-bold text-neon">
                          {formatVND(w.amount)}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-white/50">
                        {w.days.map((d, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span>
                              {d.kind === "win" ? (
                                <>
                                  Ngày {dayLabel(d.date)} (trúng {d.correct}/
                                  {d.totalWin}, chia theo tỉ lệ)
                                </>
                              ) : d.kind === "treo" ? (
                                <>🔁 Từ quỹ treo: {d.slots} slot</>
                              ) : (
                                <>
                                  Ngày treo {dayLabel(d.date)}: {d.slots} slot ×{" "}
                                  {d.players} người
                                </>
                              )}
                            </span>
                            <span className="shrink-0 text-white/70">
                              → {formatVND(d.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] leading-relaxed text-white/40">
                Quỹ ngày trúng chia theo <b>tỉ lệ tỉ số trúng</b>; quỹ treo & ngày treo
                chia theo <b>slot</b>
                {breakdown.scaled && (
                  <>
                    {" "}
                    rồi <b>giảm đều</b> (vì tổng vượt quỹ)
                  </>
                )}
                .
              </p>
            </div>

            {breakdown.carried > 0 && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
                Người trúng không ôm hết quỹ — còn{" "}
                <b>{formatVND(breakdown.carried)}</b> giữ làm <b>quỹ treo</b>, cộng vào
                đợt tất toán sau.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Settlement history */}
      {events.length > 0 ? (
        <div id="lich-su-tat-toan" className="scroll-mt-24 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
            Lịch sử tất toán
          </h2>
          {events.map((e, i) => (
            <div key={i} className="card">
              <p className="mb-2 text-xs text-white/40">⏱ {formatShort(e.time)}</p>
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
      ) : (
        !loading &&
        !breakdown && (
          <div className="card text-white/50">Chưa có lần chia quỹ nào.</div>
        )
      )}
    </div>
  );
}
