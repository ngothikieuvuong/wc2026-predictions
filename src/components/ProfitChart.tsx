"use client";

import { Money } from "@/components/Money";

type Settlement = { created_at: string; cum: { name: string; value: number }[] };

// Cumulative profit/loss per player as a CANDLESTICK chart (one mini-chart per
// person, like a stock chart). Each candle = one settlement: the body runs from
// their running net BEFORE that chốt (open) to AFTER it (close) — green candle =
// gained money that round, red = lost. The dashed line is hòa vốn (0).
export default function ProfitChart({
  settlements,
}: {
  settlements: Settlement[];
}) {
  const names = Array.from(
    new Set(settlements.flatMap((s) => s.cum.map((c) => c.name)))
  );
  if (settlements.length === 0 || names.length === 0)
    return <p className="text-sm text-white/40">Chưa có dữ liệu chia quỹ để vẽ.</p>;

  const valueAt = (s: Settlement, name: string) =>
    s.cum.find((c) => c.name === name)?.value ?? 0;

  // Per person: the running net at each settlement, prefixed with 0 (đầu mùa).
  const series = names
    .map((name) => ({
      name,
      vals: [0, ...settlements.map((s) => valueAt(s, name))],
      final: valueAt(settlements[settlements.length - 1], name),
    }))
    .sort((a, b) => b.final - a.final);

  const cols = settlements.length; // one candle per settlement

  // Shared y-scale across everyone so heights are comparable.
  const allVals = series.flatMap((s) => s.vals).concat(0);
  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (min === max) {
    min -= 1000;
    max += 1000;
  }
  const pad = (max - min) * 0.15;
  min -= pad;
  max += pad;

  const STEP = 12;
  const W = Math.max(cols, 1) * STEP;
  const H = 44;
  const bodyW = STEP * 0.5;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const zeroY = y(0);

  return (
    <div className="space-y-2.5">
      {series.map((s) => {
        const up = s.final > 0;
        const down = s.final < 0;
        return (
          <div key={s.name} className="flex items-center gap-2.5">
            <span className="w-16 shrink-0 truncate text-sm font-medium sm:w-20">
              {s.name}
            </span>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-11 flex-1 rounded bg-black/20"
            >
              {/* break-even line */}
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
              {Array.from({ length: cols }).map((_, i) => {
                const open = s.vals[i]; // running net before this chốt
                const close = s.vals[i + 1]; // after this chốt
                const gain = close > open;
                const flat = close === open;
                const color = flat ? "#9ca3af" : gain ? "#22c55e" : "#ef4444";
                const cx = i * STEP + STEP / 2;
                const yo = y(open);
                const yc = y(close);
                const top = Math.min(yo, yc);
                const h = Math.max(1.6, Math.abs(yo - yc));
                return (
                  <rect
                    key={i}
                    x={cx - bodyW / 2}
                    y={top}
                    width={bodyW}
                    height={h}
                    fill={color}
                    rx={0.6}
                  />
                );
              })}
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
        Mỗi <b>cây nến</b> = 1 lần chia quỹ: <b className="text-grass">xanh</b> = lần
        đó lời thêm, <b className="text-red-400">đỏ</b> = lỗ thêm; cao/thấp so với
        vạch đứt (hòa vốn) là tổng lời/lỗ tới lúc đó. Xếp từ lời nhất xuống lỗ nhất.
      </p>
    </div>
  );
}
