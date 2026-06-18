"use client";

import { Money } from "@/components/Money";

type Settlement = { created_at: string; cum: { name: string; value: number }[] };

// A distinct colour per player (cycles if there are more than 10).
const COLORS = [
  "#1db954", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7",
  "#ec4899", "#14b8a6", "#eab308", "#f97316", "#22d3ee",
];

// Cumulative profit/loss per player across the season's settlement events —
// a multi-line chart so you can see who's climbing and who's nose-diving.
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
  const series = names.map((name, i) => ({
    name,
    color: COLORS[i % COLORS.length],
    values: [0, ...settlements.map((s) => valueAt(s, name))],
    final: valueAt(settlements[settlements.length - 1], name),
  }));
  const cols = settlements.length + 1;

  const allVals = series.flatMap((s) => s.values).concat(0);
  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (min === max) {
    min -= 1000;
    max += 1000;
  }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;

  const W = 320, H = 200, L = 6, Rr = 6, T = 10, Bb = 20;
  const x = (i: number) => L + (i * (W - L - Rr)) / Math.max(1, cols - 1);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - Bb);
  const zeroY = y(0);

  const labels = [
    "Đầu",
    ...settlements.map((s) => {
      const d = new Date(s.created_at);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
  ];
  const legend = [...series].sort((a, b) => b.final - a.final);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Zero baseline (break-even) */}
        {min < 0 && max > 0 && (
          <line
            x1={L}
            x2={W - Rr}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(255,255,255,0.28)"
            strokeDasharray="3 3"
            strokeWidth={0.7}
          />
        )}
        {/* X labels (settlement dates) */}
        {labels.map((lb, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 5}
            fontSize={7}
            fill="rgba(255,255,255,0.4)"
            textAnchor="middle"
          >
            {lb}
          </text>
        ))}
        {/* One line + dots per player */}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={1.8} fill={s.color} />
            ))}
          </g>
        ))}
      </svg>

      {/* Legend with each player's current total */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {legend.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="truncate">{s.name}</span>
            </span>
            <span
              className={
                s.final > 0
                  ? "text-neon"
                  : s.final < 0
                  ? "text-red-400"
                  : "text-white/50"
              }
            >
              {s.final > 0 ? "+" : ""}
              <Money value={s.final} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-white/30">
        Trục dọc: lời/lỗ tích lũy · trục ngang: các lần chia quỹ. Đường đi lên =
        đang ăn, đi xuống = đang thua.
      </p>
    </div>
  );
}
