"use client";

import { useState } from "react";
import { Money } from "@/components/Money";

type Row = {
  name: string;
  predictions: number;
  correct: number;
  rate: number;
  winCount: number;
  won: number;
  best: number;
};
type Key = "name" | "predictions" | "correct" | "rate" | "won";

// Per-person accuracy + winnings table, sortable by clicking a column header.
export default function HitRateTable({ rows }: { rows: Row[] }) {
  const [key, setKey] = useState<Key>("correct");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  if (rows.length === 0)
    return <p className="text-white/50">Chưa có dữ liệu.</p>;

  const sorted = [...rows].sort((a, b) => {
    const d =
      key === "name"
        ? a.name.localeCompare(b.name, "vi")
        : (a[key] as number) - (b[key] as number);
    return dir === "asc" ? d : -d;
  });

  const click = (k: Key) => {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir(k === "name" ? "asc" : "desc"); // numbers default high→low
    }
  };
  const arrow = (k: Key) => (key === k ? (dir === "asc" ? " ▲" : " ▼") : "");

  const Th = ({
    k,
    label,
    align,
  }: {
    k: Key;
    label: string;
    align: "left" | "center" | "right";
  }) => (
    <th
      className={`font-medium ${
        align === "left"
          ? "py-1.5 pr-2 text-left"
          : align === "right"
          ? "pl-1 text-right"
          : "px-1 text-center"
      }`}
    >
      <button
        onClick={() => click(k)}
        className={`whitespace-nowrap transition hover:text-white ${
          key === k ? "text-white/80" : ""
        }`}
      >
        {label}
        {arrow(k)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-white/40">
            <Th k="name" label="Người" align="left" />
            <Th k="predictions" label="Đoán" align="center" />
            <Th k="correct" label="Trúng" align="center" />
            <Th k="rate" label="Tỉ lệ" align="center" />
            <Th k="won" label="Tiền trúng" align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sorted.map((r) => (
            <tr key={r.name}>
              <td className="py-2 pr-2 font-semibold">{r.name}</td>
              <td className="px-1 text-center text-white/60">{r.predictions}</td>
              <td className="px-1 text-center font-bold text-neon">{r.correct}</td>
              <td className="px-1 text-center text-white/70">
                {Math.round(r.rate * 100)}%
              </td>
              <td className="pl-1 text-right">
                <span className="font-semibold text-neon">
                  <Money value={r.won} />
                </span>
                {r.winCount > 0 && (
                  <span className="block text-[10px] text-white/40">
                    {r.winCount} lần · cao nhất <Money value={r.best} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
