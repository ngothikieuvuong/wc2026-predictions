"use client";

import { Money } from "@/components/Money";

type Settlement = { created_at: string; cum: { name: string; value: number }[] };

// Cumulative profit/loss per player — shown as "small multiples": one row per
// person with their own sparkline (no overlapping colours to confuse), sorted
// best → worst, green = winning, red = losing. Easy to scan who's up/down.
export default function ProfitChart({
  settlements,
}: {
  settlements: Settlement[];
}) {
  const names = Array.from(
    new Set(settlements.flatMap((s) => s.cum.map((c) => c.name)))
  );
  if (settlements.length === 0 || names.length === 0)
    return (
      <p className="text-sm text-white/40">Chưa có dữ liệu chia quỹ để vẽ.</p>
    );

  const valueAt = (s: Settlement, name: string) =>
    s.cum.find((c) => c.name === name)?.value ?? 0;

  // Each line starts at 0 (đầu mùa), then one point per settlement.
  const series = names
    .map((name) => ({
      name,
      values: [0, ...settlements.map((s) => valueAt(s, name))],
      final: valueAt(settlements[settlements.length - 1], name),
    }))
    .sort((a, b) => b.final - a.final);
  const cols = settlements.length + 1;

  // Shared y-scale across everyone so the heights are comparable.
  const allVals = series.flatMap((s) => s.values).concat(0);
  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (min === max) {
    min -= 1000;
    max += 1000;
  }
  const span = max - min;
  min -= span * 0.15;
  max += span * 0.15;

  const W = 100, H = 28;
  const x = (i: number) => (cols <= 1 ? W / 2 : (i * W) / (cols - 1));
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const zeroY = y(0);

  return (
    <div className="space-y-2.5">
      {series.map((s) => {
        const up = s.final > 0;
        const down = s.final < 0;
        const color = up ? "#22c55e" : down ? "#ef4444" : "#9ca3af";
        const pts = s.values
          .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
          .join(" ");
        return (
          <div key={s.name} className="flex items-center gap-2.5">
            <span className="w-16 shrink-0 truncate text-sm font-medium sm:w-20">
              {s.name}
            </span>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-7 flex-1 rounded bg-black/20"
            >
              <line
                x1={0}
                x2={W}
                y1={zeroY}
                y2={zeroY}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={1}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={pts}
              />
            </svg>
            <span
              className={`w-20 shrink-0 text-right text-sm font-bold ${
                up ? "text-neon" : down ? "text-red-400" : "text-white/50"
              }`}
            >
              {up ? "+" : ""}
              <Money value={s.final} />
            </span>
          </div>
        );
      })}
      <p className="mt-1 text-[11px] leading-relaxed text-white/30">
        Mỗi người một đường riêng theo các lần chia quỹ — <b>xanh</b> đang lời,{" "}
        <b>đỏ</b> đang lỗ; đường vắt qua vạch đứt = hòa vốn. Xếp từ lời nhất xuống
        lỗ nhất.
      </p>
    </div>
  );
}
