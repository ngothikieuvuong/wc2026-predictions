"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getPlayerHistory } from "@/lib/queries";
import { formatKickoff } from "@/lib/format";

type History = Awaited<ReturnType<typeof getPlayerHistory>>;

export default function PlayerHistoryModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<History | null>(null);

  useEffect(() => {
    let alive = true;
    getPlayerHistory(name).then((d) => alive && setRows(d));
    return () => {
      alive = false;
    };
  }, [name]);

  const wins = rows?.filter((r) => r.win).length ?? 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            Lịch sử của {name}
            {rows && (
              <span className="ml-2 text-sm font-normal text-white/40">
                {rows.length} lượt · {wins} trúng
              </span>
            )}
          </h2>
          <button
            className="text-2xl leading-none text-white/50 hover:text-white"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {rows === null ? (
          <p className="text-sm text-white/40">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/50">Chưa có lượt đoán nào.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-3 py-2.5 ${
                  r.win ? "font-bold text-red-400" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {r.win && "🎯 "}
                    {r.team1} <span className="text-white/40">gặp</span> {r.team2}
                  </p>
                  <p className="text-[11px] font-normal text-white/40">
                    ⏱ {formatKickoff(r.kickoff_time)}
                    {r.finished
                      ? ` · KQ ${r.home_score}–${r.away_score}`
                      : " · chưa đá"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-lg">
                  {r.predicted_home}–{r.predicted_away}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button className="btn mt-4 w-full" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>,
    document.body
  );
}
