"use client";

import { useEffect, useState } from "react";
import { getTeamInfo } from "@/lib/queries";
import { getOdds, findOdds, type OddsRow } from "@/lib/oddsClient";
import LineupView from "@/components/LineupView";

type Info = Awaited<ReturnType<typeof getTeamInfo>>;

// Reference odds (kèo chấp / tài xỉu) from kqbd.mobi for this match, if listed.
function OddsSection({ team1, team2 }: { team1: string; team2: string }) {
  const [odds, setOdds] = useState<OddsRow | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getOdds().then((rows) => alive && setOdds(findOdds(rows, team1, team2)));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (!odds) return null; // loading or not listed → hide

  return (
    <div className="border-t border-white/10 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        Tỷ lệ kèo (tham khảo)
      </p>
      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
        <p className="text-[11px] text-white/40">
          Nguồn kqbd.mobi · {odds.home} vs {odds.away}
          {odds.hour ? ` · ${odds.day} ${odds.hour}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-white/50">Kèo chấp ({odds.hcLine || "–"})</p>
            <p>
              {odds.home}: <b>{odds.hcHome || "–"}</b>
            </p>
            <p>
              {odds.away}: <b>{odds.hcAway || "–"}</b>
            </p>
          </div>
          <div>
            <p className="text-xs text-white/50">Tài xỉu ({odds.ouLine || "–"})</p>
            <p>
              Tài: <b>{odds.over || "–"}</b>
            </p>
            <p>
              Xỉu: <b>{odds.under || "–"}</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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

      {/* Reference odds */}
      <OddsSection team1={team1} team2={team2} />

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
