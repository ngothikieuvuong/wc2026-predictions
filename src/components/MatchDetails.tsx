"use client";

import { useEffect, useState } from "react";
import { getTeamInfo } from "@/lib/queries";
import LineupView from "@/components/LineupView";

type Info = Awaited<ReturnType<typeof getTeamInfo>>;

// Shared popup body: FIFA rank + tournament form of both teams, then lineups +
// card suspensions. Used by the home match popup and the predict "Thêm thông tin".
export default function MatchDetails({
  team1,
  team2,
}: {
  team1: string;
  team2: string;
}) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let alive = true;
    getTeamInfo(team1, team2).then((d) => alive && setInfo(d));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  return (
    <div className="space-y-4">
      {info === null ? (
        <p className="text-sm text-white/40">Đang tải…</p>
      ) : (
        <div className="space-y-3">
          {info.map((t) => (
            <div
              key={t.team}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="font-bold">
                {t.team}{" "}
                <span className="text-xs font-normal text-white/40">
                  · Hạng FIFA ~{t.rank ?? "?"}
                </span>
              </p>
              {t.played === 0 ? (
                <p className="mt-1 text-sm text-white/50">Chưa đá trận nào ở giải.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-white/70">
                    Đã đá {t.played} trận: {t.w} thắng, {t.d} hòa, {t.l} thua · ghi{" "}
                    {t.gf}, thủng {t.ga}
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {t.results.map((r, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span
                          className={`w-12 shrink-0 font-semibold ${
                            r.res === "T"
                              ? "text-grass"
                              : r.res === "H"
                              ? "text-amber-300"
                              : "text-red-400"
                          }`}
                        >
                          {r.res === "T" ? "Thắng" : r.res === "H" ? "Hòa" : "Thua"}
                        </span>
                        <span className="text-white/70">
                          {r.opp} {r.gf}–{r.ga}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lineups + card suspensions */}
      <div className="border-t border-white/10 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          Đội hình
        </p>
        <LineupView team1={team1} team2={team2} />
      </div>
    </div>
  );
}
