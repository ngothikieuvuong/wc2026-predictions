"use client";

import { useEffect, useState } from "react";
import { getStats } from "@/lib/queries";
import { formatVND } from "@/lib/format";

export default function StatsPage() {
  const [rows, setRows] = useState<
    { name: string; chi: number; thu: number; loiLo: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setRows(await getStats());
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Thống kê</h1>
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
                    <td className="px-3 py-3 font-semibold">{r.name}</td>
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
    </div>
  );
}
