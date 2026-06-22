"use client";

import { useEffect, useState } from "react";

import { getSettlements } from "@/lib/queries";
import PageHeader from "@/components/PageHeader";
import { getLastSettlementDetail, type SettleResult } from "@/lib/admin";
import { formatShort } from "@/lib/format";
import { Money } from "@/components/Money";
import { dayLabel } from "@/lib/day";

type Event = { time: string; lines: { name: string; delta: number }[] };

export default function HistoryPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [breakdown, setBreakdown] = useState<SettleResult["breakdown"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

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

  // VN calendar day of a settlement timestamp (for grouping older events).
  const vnDay = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };
  const older = events.slice(1); // everything except the most recent
  const olderGroups: { day: string; items: Event[] }[] = [];
  for (const e of older) {
    const day = vnDay(e.time);
    const last = olderGroups[olderGroups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else olderGroups.push({ day, items: [e] });
  }

  const EventCard = ({ e }: { e: Event }) => (
    <div className="card">
      <p className="mb-2 text-xs text-white/40">⏱ {formatShort(e.time)}</p>
      <ul className="divide-y divide-white/5">
        {e.lines.map((l) => (
          <li key={l.name} className="flex justify-between py-1.5 text-sm">
            <span className="font-medium">{l.name}</span>
            <span className={`font-bold ${l.delta > 0 ? "text-neon" : "text-red-400"}`}>
              {l.delta > 0 ? "+" : ""}
              <Money value={l.delta} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch sử chia quỹ"
        subtitle="Chi tiết lần chia gần nhất và toàn bộ các lần tất toán đã xác nhận."
        back={{ href: "/leaderboard", label: "Về Tổng kết" }}
      />

      {loading && <p className="text-white/40">Đang tải…</p>}

      {/* How the latest settled fund was divided */}
      {breakdown && breakdown.winners.length > 0 && (
        <div className="space-y-3">
          <h2 className="section-title">
            Quỹ đã chia
          </h2>
          <div className="card space-y-3">
            <p className="text-xs text-white/50">
              Tổng quỹ <b className="text-white/80"><Money value={breakdown.fund} /></b> →
              thưởng <b className="text-neon"><Money value={breakdown.winTotal} /></b> cho
              người trúng
              {breakdown.carried > 0 && (
                <>
                  , còn <b><Money value={breakdown.carried} /></b> giữ làm quỹ treo cho đợt
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
                          <Money value={w.amount} />
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-white/50">
                        {w.days.map((d, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span>
                              {d.kind === "treo" ? (
                                <>🔁 Treo {d.label} ({dayLabel(d.date)})</>
                              ) : (
                                <>🎯 {d.label ?? "Trúng tỉ số"}</>
                              )}
                            </span>
                            <span className="shrink-0 text-white/70">
                              → <Money value={d.amount} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] leading-relaxed text-white/40">
                Mỗi <b>trận trúng</b>: quỹ trận đó chia đều cho người trúng trận đó.{" "}
                <b>Quỹ treo</b>: mỗi trận không ai trúng giữ riêng, sau này chia cho
                người trúng <b>có chơi</b> trận treo đó.
              </p>
            </div>

            {breakdown.carried > 0 && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
                Người trúng không ôm hết quỹ — còn{" "}
                <b><Money value={breakdown.carried} /></b> giữ làm <b>quỹ treo</b>, cộng vào
                đợt tất toán sau.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Settlement history */}
      {events.length > 0 ? (
        <div id="lich-su-tat-toan" className="scroll-mt-24 space-y-3">
          <h2 className="section-title">
            Lịch sử tất toán
          </h2>
          {/* Most recent settlement — always expanded */}
          <EventCard e={events[0]} />

          {/* Older settlements — grouped by day, collapsed */}
          {older.length > 0 && (
            <>
              <button
                onClick={() => setShowAll((v) => !v)}
                className="btn-ghost w-full"
              >
                {showAll
                  ? "Thu gọn"
                  : `Xem thêm ${older.length} lần trước (${olderGroups.length} ngày) ▾`}
              </button>
              {showAll &&
                olderGroups.map((g) => (
                  <div key={g.day} className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                      Ngày {dayLabel(g.day)}
                    </p>
                    {g.items.map((e, i) => (
                      <EventCard key={i} e={e} />
                    ))}
                  </div>
                ))}
            </>
          )}
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
