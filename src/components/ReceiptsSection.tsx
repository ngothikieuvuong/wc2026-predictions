"use client";

import { useState } from "react";
import { Money } from "@/components/Money";

type Item = { name: string; amount: number; label: string; date: string | null };
type Receipt = { time: string; total: number; items: Item[] };

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function payDay(d: string | null) {
  return d ? `Ngày ${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
}

// Flat list of individual wins (newest first). Click a record to expand the full
// settlement (chốt) it belonged to. Shows 7 at first, "Xem thêm" reveals the rest.
export default function ReceiptsSection({ receipts }: { receipts: Receipt[] }) {
  const [limit, setLimit] = useState(7);
  const [open, setOpen] = useState<number | null>(null);

  // One record per payout, each carrying the settlement it came from.
  const records = receipts.flatMap((g) =>
    g.items.map((it) => ({ ...it, time: g.time, group: g }))
  );

  if (records.length === 0)
    return <p className="text-white/50">Chưa có ai trúng — hãy là người đầu tiên!</p>;

  const shown = records.slice(0, limit);
  return (
    <>
      <ul className="space-y-1.5">
        {shown.map((rec, i) => {
          const isOpen = open === i;
          return (
            <li
              key={i}
              className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="font-bold">🏆 {rec.name}</span>
                  <span className="block text-[11px] text-white/50">
                    {[payDay(rec.date), rec.label].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-bold text-neon">
                    <Money value={rec.amount} />
                  </span>
                  <span className="text-white/40">{isOpen ? "▾" : "▸"}</span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/10 bg-black/30 px-3 py-2">
                  <p className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-white/40">
                    <span>Chốt {fmt(rec.group.time)}</span>
                    <span>
                      tổng <Money value={rec.group.total} />
                    </span>
                  </p>
                  <ul className="divide-y divide-white/5">
                    {rec.group.items.map((it, j) => (
                      <li
                        key={j}
                        className="flex items-center justify-between gap-2 py-1.5 text-sm"
                      >
                        <span className="min-w-0">
                          <span
                            className={
                              it.name === rec.name ? "font-semibold text-neon" : "font-medium"
                            }
                          >
                            {it.name}
                          </span>
                          {it.label && (
                            <span className="block text-[11px] text-white/40">
                              {it.label}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-semibold">
                          <Money value={it.amount} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {records.length > limit && (
        <button
          onClick={() => setLimit((l) => l + 7)}
          className="btn-ghost mt-3 w-full"
        >
          Xem thêm ({records.length - limit})
        </button>
      )}
    </>
  );
}
