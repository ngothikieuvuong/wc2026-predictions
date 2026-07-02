"use client";

import { useState } from "react";
import { Money } from "@/components/Money";

type Receipt = {
  time: string;
  total: number;
  items: { name: string; amount: number; label: string }[];
};

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Recent wins preview + an expandable list of each settlement (lần chốt); each
// settlement row expands to who received what.
export default function ReceiptsSection({ receipts }: { receipts: Receipt[] }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  if (receipts.length === 0)
    return <p className="text-white/50">Chưa có ai trúng — hãy là người đầu tiên!</p>;

  const latest = receipts[0];
  return (
    <>
      {/* Most recent settlement's winners */}
      <ul className="divide-y divide-white/10">
        {latest.items.slice(0, 5).map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="font-bold">🏆 {it.name}</p>
              {it.label && <p className="truncate text-xs text-white/50">{it.label}</p>}
            </div>
            <p className="shrink-0 font-bold text-neon">
              <Money value={it.amount} />
            </p>
          </li>
        ))}
      </ul>

      <button onClick={() => setShowAll((v) => !v)} className="btn-ghost mt-3 w-full">
        {showAll ? "Ẩn bớt ▴" : `Xem chi tiết (${receipts.length} lần chốt) ▾`}
      </button>

      {showAll && (
        <ul className="mt-3 space-y-1.5">
          {receipts.map((r, i) => (
            <li
              key={i}
              className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
            >
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/5"
              >
                <span className="text-sm">
                  <span className="font-semibold">Chốt {fmt(r.time)}</span>
                  <span className="block text-[11px] text-white/40">
                    {r.items.length} lượt nhận
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold text-neon">
                    <Money value={r.total} />
                  </span>
                  <span className="text-white/40">{open.has(i) ? "▾" : "▸"}</span>
                </span>
              </button>
              {open.has(i) && (
                <ul className="divide-y divide-white/5 border-t border-white/10 px-3">
                  {r.items.map((it, j) => (
                    <li
                      key={j}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{it.name}</span>
                        {it.label && (
                          <span className="block text-[11px] text-white/40">
                            {it.label}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-neon">
                        <Money value={it.amount} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
