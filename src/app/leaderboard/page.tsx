"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats, getSettlements } from "@/lib/queries";
import { formatVND } from "@/lib/format";
import PlayerHistoryModal from "@/components/PlayerHistoryModal";
import PendingWinnersBanner from "@/components/PendingWinnersBanner";
import ProfitChart from "@/components/ProfitChart";

export default function StatsPage() {
  const [rows, setRows] = useState<
    { name: string; chi: number; thu: number; loiLo: number }[]
  >([]);
  const [settlements, setSettlements] = useState<
    Awaited<ReturnType<typeof getSettlements>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [historyName, setHistoryName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [stats, s] = await Promise.all([getStats(), getSettlements()]);
      setRows(stats);
      setSettlements(s);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PendingWinnersBanner />

      <div>
        <h1 className="title-lux text-2xl">Tổng kết</h1>
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
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-white/40">
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

      {/* Profit/loss trajectory chart */}
      {!loading && settlements.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
            Diễn biến lời/lỗ
          </h2>
          <div className="card">
            <ProfitChart settlements={settlements} />
          </div>
        </div>
      )}

      <Link href="/history" className="btn-ghost w-full">
        📜 Lịch sử chia quỹ
      </Link>

      {historyName && (
        <PlayerHistoryModal
          name={historyName}
          onClose={() => setHistoryName(null)}
        />
      )}
    </div>
  );
}
