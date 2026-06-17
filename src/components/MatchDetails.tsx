"use client";

import { useEffect, useState } from "react";
import { getTeamInfo } from "@/lib/queries";
import { getOdds, findOdds, type OddsRow } from "@/lib/oddsClient";
import { getMatchLive, type MatchLive } from "@/lib/matchLiveClient";
import { predictMatch, type Prediction } from "@/lib/predict";
import { getTeamNews, type TeamNewsResult } from "@/lib/teamNewsClient";
import LineupView from "@/components/LineupView";

// On-demand injuries + projected lineups from API-Football (saves quota — only
// fetched when the user taps). Degrades gracefully when no key / no data.
function TeamNewsSection({ team1, team2 }: { team1: string; team2: string }) {
  const [res, setRes] = useState<TeamNewsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setRes(await getTeamNews(team1, team2));
    setLoading(false);
  };

  if (!res) {
    return (
      <div className="border-t border-white/10 pt-3">
        <button onClick={run} disabled={loading} className="btn-ghost w-full">
          {loading ? "Đang lấy tin…" : "🩺 Tin đội bóng (chấn thương / đội hình)"}
        </button>
      </div>
    );
  }

  if (!res.ok) {
    const msg =
      res.reason === "no-key"
        ? "Chưa cấu hình nguồn tin (API key)."
        : "Không lấy được tin lúc này.";
    return (
      <div className="border-t border-white/10 pt-3">
        <p className="text-center text-xs text-white/40">{msg}</p>
      </div>
    );
  }

  if (!res.found)
    return (
      <div className="border-t border-white/10 pt-3">
        <p className="text-center text-xs text-white/40">
          Chưa có tin chấn thương / đội hình cho trận này.
        </p>
      </div>
    );

  const teams = [team1, team2];
  return (
    <div className="space-y-3 border-t border-white/10 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
        🩺 Tin đội bóng
      </p>
      {teams.map((tName) => {
        const inj = res.injuries.filter((i) =>
          i.team.toLowerCase().includes(tName.toLowerCase().slice(0, 3))
        );
        const ln = res.lineups.find((l) =>
          l.team.toLowerCase().includes(tName.toLowerCase().slice(0, 3))
        );
        return (
          <div
            key={tName}
            className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
          >
            <p className="font-bold">{tName}</p>
            {ln && ln.xi.length > 0 && (
              <p className="mt-1 text-xs text-white/60">
                Đội hình ({ln.formation}): {ln.xi.join(", ")}
              </p>
            )}
            {res.injuries.length > 0 ? (
              inj.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {inj.map((i, k) => (
                    <li key={k} className="text-red-300">
                      🚑 {i.player}
                      {i.reason ? ` — ${i.reason}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-white/40">Không có ca chấn thương.</p>
              )
            ) : (
              !ln && (
                <p className="mt-1 text-xs text-white/40">Chưa có dữ liệu.</p>
              )
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-white/30">
        Nguồn: API-Football. Đội hình chỉ có khi gần giờ bóng lăn.
      </p>
    </div>
  );
}

// On-demand statistical score hint (free, no external AI). Computes only when
// the user taps the button. Framed clearly as a non-serious reference.
function PredictionSection({ team1, team2 }: { team1: string; team2: string }) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const pct = (x: number) => Math.round(x * 100);

  const run = async () => {
    setLoading(true);
    setErr(false);
    try {
      setPred(await predictMatch(team1, team2));
    } catch {
      setErr(true);
    }
    setLoading(false);
  };

  if (!pred) {
    return (
      <div className="border-t border-white/10 pt-3">
        <button onClick={run} disabled={loading} className="btn-ghost w-full">
          {loading ? "Đang phân tích…" : "🤖 Gợi ý tỉ số (tham khảo)"}
        </button>
        {err && (
          <p className="mt-2 text-center text-xs text-red-300">
            Chưa phân tích được, thử lại sau.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          🤖 Gợi ý tỉ số · tham khảo
        </p>
        <p className="mt-1 text-2xl font-extrabold">
          {team1}{" "}
          <span className="text-neon">
            {pred.scoreA}–{pred.scoreB}
          </span>{" "}
          {team2}
        </p>
        <p className="text-[11px] text-white/40">
          khả năng đúng y tỉ số này ~{pct(pred.pTopScore)}%
        </p>
      </div>

      {/* Win / draw / win split */}
      <div>
        <div className="mb-1 flex justify-between gap-2 text-[11px] text-white/60">
          <span className="truncate">{team1} {pct(pred.pA)}%</span>
          <span className="shrink-0">Hòa {pct(pred.pDraw)}%</span>
          <span className="truncate text-right">{team2} {pct(pred.pB)}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
          <div className="bg-grass" style={{ width: `${pct(pred.pA)}%` }} />
          <div className="bg-amber-400" style={{ width: `${pct(pred.pDraw)}%` }} />
          <div className="bg-red-400" style={{ width: `${pct(pred.pB)}%` }} />
        </div>
      </div>

      {/* A few likely scorelines */}
      <div>
        <p className="mb-1 text-[11px] text-white/50">Vài tỉ số khả dĩ:</p>
        <div className="flex flex-wrap gap-2">
          {pred.top.map((t, i) => (
            <span
              key={i}
              className="rounded-lg bg-black/30 px-2.5 py-1 font-mono text-sm"
            >
              {t.a}–{t.b}{" "}
              <span className="text-xs text-white/40">{pct(t.p)}%</span>
            </span>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-white/30">
        Dựa trên {pred.basis}. Chỉ để tham khảo cho vui — đoán đúng y tỉ số rất
        khó, % thấp là bình thường.
      </p>
    </div>
  );
}

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

      {/* On-demand statistical score hint */}
      <PredictionSection team1={team1} team2={team2} />

      {/* On-demand injuries + projected lineups (API-Football) */}
      <TeamNewsSection team1={team1} team2={team2} />

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
