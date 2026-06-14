"use client";

import { useEffect, useState } from "react";
import type { MatchInfo, TeamLineup } from "@/lib/fifaLineup";

function Team({ t }: { t: TeamLineup }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="font-bold">{t.name}</p>

      {t.xi.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-grass">
            Đội hình ra sân
          </p>
          <ul className="mt-1 grid grid-cols-1 gap-x-3 text-sm">
            {t.xi.map((p) => (
              <li key={p.num} className="flex gap-2">
                <span className="w-6 shrink-0 text-right text-white/40">{p.num}</span>
                <span>
                  {p.name}
                  {p.captain && <span className="text-amber-300"> (C)</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : t.squad.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Danh sách cầu thủ ({t.squad.length})
          </p>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 text-sm">
            {t.squad.map((p) => (
              <li key={p.num} className="flex gap-2">
                <span className="w-6 shrink-0 text-right text-white/40">{p.num}</span>
                <span className="truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-white/50">Đội hình chưa công bố.</p>
      )}

      {t.bench.length > 0 && (
        <p className="mt-2 text-xs text-white/40">
          <span className="font-semibold">Dự bị:</span>{" "}
          {t.bench.map((p) => p.name).join(", ")}
        </p>
      )}

      {t.cards.length > 0 && (
        <p className="mt-1 text-xs text-white/50">
          {t.cards.map((c, i) => (
            <span key={i} className="mr-2">
              {c.card} {c.name} {c.minute}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// Self-fetching lineup view for a match (reused by the match popup and the
// predict "Thêm thông tin" popup).
export default function LineupView({
  team1,
  team2,
}: {
  team1: string;
  team2: string;
}) {
  const [data, setData] = useState<MatchInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(
      `/api/match-info?t1=${encodeURIComponent(team1)}&t2=${encodeURIComponent(team2)}`
    )
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ error: "Lỗi" }));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (data === null)
    return <p className="text-sm text-white/40">Đang tải đội hình…</p>;
  if ("error" in data)
    return <p className="text-sm text-white/50">Chưa có đội hình trận này.</p>;

  return (
    <div className="space-y-3">
      {!data.lineupReady && (
        <p className="text-xs text-white/40">
          Đội hình chính thức thường công bố ~1 giờ trước trận. Dưới đây là đội
          hình dự kiến.
        </p>
      )}
      <Team t={data.home} />
      <Team t={data.away} />
      <p className="text-center text-[11px] text-white/30">
        Nguồn: FIFA · chỉ để tham khảo
      </p>
    </div>
  );
}
