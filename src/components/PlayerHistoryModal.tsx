"use client";

import { useEffect, useState } from "react";
import { getPlayerLedger } from "@/lib/queries";
import { formatVND, formatShort } from "@/lib/format";
import Modal from "@/components/Modal";

type Ledger = Awaited<ReturnType<typeof getPlayerLedger>>;

export default function PlayerHistoryModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Ledger | null>(null);

  useEffect(() => {
    let alive = true;
    getPlayerLedger(name).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [name]);

  return (
    <Modal title={`Lịch sử tiền · ${name}`} onClose={onClose}>
        {data === null ? (
          <p className="text-sm text-white/40">Đang tải…</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-white/50">Chưa có giao dịch nào.</p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-sm text-white/60">Tổng cộng (lời/lỗ)</span>
              <span
                className={`text-xl font-extrabold ${
                  data.total > 0
                    ? "text-neon"
                    : data.total < 0
                    ? "text-red-400"
                    : "text-white/60"
                }`}
              >
                {data.total > 0 ? "+" : ""}
                {formatVND(data.total)}
              </span>
            </div>

            <ul className="divide-y divide-white/5">
              {data.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {it.kind === "win" ? "🎯 " : "📝 "}
                      {it.label}
                    </p>
                    {it.sub && (
                      <p className="truncate text-[11px] text-white/40">{it.sub}</p>
                    )}
                    <p className="text-[10px] text-white/30">{formatShort(it.time)}</p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold ${
                      it.amount > 0 ? "text-neon" : "text-red-400"
                    }`}
                  >
                    {it.amount > 0 ? "+" : ""}
                    {formatVND(it.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
    </Modal>
  );
}
