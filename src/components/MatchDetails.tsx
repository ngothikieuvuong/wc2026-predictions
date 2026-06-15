"use client";

import { useEffect, useState } from "react";
import { getTeamInfo } from "@/lib/queries";
import { getOdds, findOdds, type OddsRow } from "@/lib/oddsClient";
import { getMatchLive, type MatchLive } from "@/lib/matchLiveClient";
import LineupView from "@/components/LineupView";

type Info = Awaited<ReturnType<typeof getTeamInfo>>;

// Live match info (score, minute, goals, cards, possession) once a match starts.
function LiveStatsSection({ team1, team2 }: { team1: string; team2: string }) {
  const [data, setData] = useState<MatchLive | null>(null);

  useEffect(() => {
    let alive = true;
    getMatchLive(team1, team2).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (!data) {
    return (
      <div className="border-t border-white/10 pt-3">
        <p className="text-sm text-white/40">Đang tải số liệu trận…</p>
      </div>
    );
  }
  if (!data.found) return null;

  const { home, away, minute, status, possession } = data;
  const label =
    status === 3
      ? `🔴 Đang diễn ra${minute ? ` · ${minute}` : ""}`
      : status === 0
      ? "Kết thúc"
      : "Sắp diễn ra";

  return (
    <div className="space-y-3 border-t border-white/10 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Diễn biến trận đấu
      </p>

      {/* Score */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
        <p className="text-xs font-semibold text-red-300">{label}</p>
        <p className="mt-1 flex items-center justify-center gap-3 text-2xl font-extrabold">
          <span className="flex-1 text-right text-base font-bold">{home.name}</span>
          <span className="font-mono">
            {home.score}–{away.score}
          </span>
          <span className="flex-1 text-left text-base font-bold">{away.name}</span>
        </p>
      </div>

      {/* Possession */}
      {possession && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-white/60">
            <span>Cầm bóng {possession.home}%</span>
            <span>{possession.away}%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
            <div className="bg-grass" style={{ width: `${possession.home}%` }} />
            <div className="bg-amber-400" style={{ width: `${possession.away}%` }} />
          </div>
        </div>
      )}

      {/* Goals + cards per team */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[home, away].map((t, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-1 font-bold">{t.name}</p>
            {t.goals.length === 0 && t.cards.length === 0 ? (
              <p className="text-xs text-white/40">—</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {t.goals.map((g, j) => (
                  <li key={`g${j}`}>
                    ⚽ {g.player} {g.minute}
                    {g.note ? ` (${g.note})` : ""}
                  </li>
                ))}
                {t.cards.map((c, j) => (
                  <li key={`c${j}`} className={c.red ? "text-red-400" : "text-amber-300"}>
                    {c.red ? "🟥" : "🟨"} {c.player} {c.minute}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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
  started = false,
}: {
  team1: string;
  team2: string;
  started?: boolean;
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

      {/* Live stats once the match starts; otherwise reference odds */}
      {started ? (
        <LiveStatsSection team1={team1} team2={team2} />
      ) : (
        <OddsSection team1={team1} team2={team2} />
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
