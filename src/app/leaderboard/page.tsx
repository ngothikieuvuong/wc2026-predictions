"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/queries";
import { formatVND } from "@/lib/format";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<
    { player_name: string; wins: number; total: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setRows(await getLeaderboard());
      setLoading(false);
    })();
  }, []);

  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bảng xếp hạng</h1>
        <p className="text-sm text-white/50">Xếp theo tổng tiền thưởng.</p>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-5 text-white/40">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-white/50">Chưa có ai thắng.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Người chơi</th>
                <th className="px-4 py-3 text-center">Số lần thắng</th>
                <th className="px-4 py-3 text-right">Tổng thưởng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.player_name}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-lg">{medal(i)}</td>
                  <td className="px-4 py-3 font-semibold">{r.player_name}</td>
                  <td className="px-4 py-3 text-center">{r.wins}</td>
                  <td className="px-4 py-3 text-right font-bold text-neon">
                    {formatVND(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
