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

// Per-person accuracy + winnings table.
export default function HitRateTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0)
    return <p className="text-white/50">Chưa có dữ liệu.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-white/40">
            <th className="py-1.5 pr-2 text-left font-medium">Người</th>
            <th className="px-1 text-center font-medium">Đoán</th>
            <th className="px-1 text-center font-medium">Trúng</th>
            <th className="px-1 text-center font-medium">Tỉ lệ</th>
            <th className="pl-1 text-right font-medium">Tiền trúng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => (
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
