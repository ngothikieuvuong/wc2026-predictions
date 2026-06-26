"use client";

import { useEffect, useState } from "react";
import { getTeamInfo } from "@/lib/queries";
import { getOdds, findOdds, type OddsRow } from "@/lib/oddsClient";
import { getMatchLive, type MatchLive } from "@/lib/matchLiveClient";
import { predictMatch, type Prediction } from "@/lib/predict";
import { getGroups, groupStatus, type GroupAnalysis } from "@/lib/groups";
import LineupView from "@/components/LineupView";

type Info = Awaited<ReturnType<typeof getTeamInfo>>;

// ── Tab 1: Phong độ — two teams compared side by side + group chances ──────────
function FormCompare({ info }: { info: Info }) {
  const [a, b] = info;
  const Row = ({ label, av, bv }: { label: string; av: string; bv: string }) => (
    <div className="grid grid-cols-3 items-center gap-2">
      <span className="text-left text-sm font-semibold">{av}</span>
      <span className="text-center text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </span>
      <span className="text-right text-sm font-semibold">{bv}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="grid grid-cols-3 items-end gap-2 text-center">
        <div>
          <p className="font-bold leading-tight">{a.team}</p>
          <p className="text-[11px] text-white/40">FIFA ~{a.rank ?? "?"}</p>
        </div>
        <span className="pb-1 text-xs text-white/30">vs</span>
        <div>
          <p className="font-bold leading-tight">{b.team}</p>
          <p className="text-[11px] text-white/40">FIFA ~{b.rank ?? "?"}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
        <Row label="đã đá" av={`${a.played}`} bv={`${b.played}`} />
        <Row label="T-H-B" av={`${a.w}-${a.d}-${a.l}`} bv={`${b.w}-${b.d}-${b.l}`} />
        <Row label="ghi / thủng" av={`${a.gf} / ${a.ga}`} bv={`${b.gf} / ${b.ga}`} />
      </div>
    </div>
  );
}

function RecentForm({ info }: { info: Info }) {
  return (
    <div className="space-y-2">
      {info.map((t) => (
        <div key={t.team} className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-1.5 text-sm font-bold">{t.team}</p>
          {t.played === 0 ? (
            <p className="text-xs text-white/40">Chưa đá trận nào ở giải.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {t.results.map((r, i) => (
                <span
                  key={i}
                  className={`rounded-md px-2 py-1 text-xs ${
                    r.res === "T"
                      ? "bg-grass/15 text-grass"
                      : r.res === "H"
                      ? "bg-amber-400/15 text-amber-300"
                      : "bg-red-400/15 text-red-300"
                  }`}
                >
                  <b>{r.res}</b> {r.opp} {r.gf}–{r.ga}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type Group = Awaited<ReturnType<typeof getGroups>>[number];
const gnorm = (s: string) =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "");
const inMatch = (name: string, t1: string, t2: string) =>
  gnorm(name) === gnorm(t1) || gnorm(name) === gnorm(t2);

const verdictTone = (v: GroupAnalysis["verdict"]) =>
  v === "done-top2" || v === "secured"
    ? "text-grass"
    : v === "out"
    ? "text-red-400"
    : "text-amber-300";

// Tab: the standings of this match's group + a SHORT qualification read for the
// two teams. Group-stage matches only (the tab isn't shown for knockout).
function GroupBoard({
  team1,
  team2,
  group,
  groups,
}: {
  team1: string;
  team2: string;
  group: Group;
  groups: Group[];
}) {
  const a1 = groupStatus(groups, team1, team2);
  const a2 = groupStatus(groups, team2, team1);
  const reads = [
    { team: team1, a: a1 },
    { team: team2, a: a2 },
  ].filter((x) => x.a) as { team: string; a: GroupAnalysis }[];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <div className="border-b border-white/10 px-3 py-2 text-xs font-bold">
          Bảng {group.name}
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Đội</th>
              <th className="px-2 py-2 text-center font-medium">Tr</th>
              <th className="px-2 py-2 text-center font-medium">Hiệu</th>
              <th className="px-3 py-2 text-center font-medium">Đ</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r, i) => {
              const here = inMatch(r.name, team1, team2);
              return (
                <tr
                  key={r.name}
                  className={`border-t border-white/5 ${
                    here ? "bg-grass/15" : i < 2 ? "bg-grass/5" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="mr-2 text-white/40">{i + 1}</span>
                    <span className={here ? "font-semibold" : ""}>{r.name}</span>
                  </td>
                  <td className="px-2 py-2 text-center text-white/60">{r.P}</td>
                  <td className="px-2 py-2 text-center text-white/60">
                    {r.GD > 0 ? `+${r.GD}` : r.GD}
                  </td>
                  <td className="px-3 py-2 text-center font-bold">{r.Pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reads.map(({ team, a }) => (
        <div key={team} className="rounded-lg bg-black/20 px-3 py-2 text-sm">
          <b>{team}</b>{" "}
          <span className={`font-semibold ${verdictTone(a.verdict)}`}>· {a.label}</span>
        </div>
      ))}
      <p className="text-[11px] text-white/30">
        Top 2 mỗi bảng + 8 đội hạng 3 tốt nhất đi tiếp. Chỉ để tham khảo.
      </p>
    </div>
  );
}

// ── Tab 2 (pre-match): on-demand statistical score hint + reference odds ───────
function PredictionSection({ team1, team2 }: { team1: string; team2: string }) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [err, setErr] = useState(false);
  const pct = (x: number) => Math.round(x * 100);

  // Auto-load the score hint as soon as the tab opens (no button).
  useEffect(() => {
    let alive = true;
    setErr(false);
    predictMatch(team1, team2)
      .then((p) => alive && setPred(p))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (!pred)
    return (
      <p className="text-sm text-white/40">
        {err ? "Chưa gợi ý được tỉ số, thử lại sau." : "🤖 Đang phân tích tỉ số…"}
      </p>
    );

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

      <div>
        <p className="mb-1 text-[11px] text-white/50">Vài tỉ số khả dĩ:</p>
        <div className="flex flex-wrap gap-2">
          {pred.top.map((t, i) => (
            <span
              key={i}
              className="rounded-lg bg-black/30 px-2.5 py-1 font-mono text-sm"
            >
              {t.a}–{t.b} <span className="text-xs text-white/40">{pct(t.p)}%</span>
            </span>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-white/30">
        Dựa trên {pred.basis}. Chỉ để tham khảo cho vui — đoán đúng y tỉ số rất khó.
      </p>
    </div>
  );
}

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
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        Tỷ lệ kèo (tham khảo)
      </p>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
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
  );
}

// ── Tab 2 (in-play): live score, goals, cards, possession ──────────────────────
function LiveStatsSection({ team1, team2 }: { team1: string; team2: string }) {
  const [data, setData] = useState<MatchLive | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getMatchLive(team1, team2).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (data === undefined)
    return <p className="text-sm text-white/40">Đang tải số liệu trận…</p>;
  if (!data || !data.found)
    return <p className="text-sm text-white/40">Chưa có số liệu trực tiếp.</p>;

  const { home, away, minute, status, possession } = data;
  const label =
    status === 3
      ? `🔴 Đang diễn ra${minute ? ` · ${minute}` : ""}`
      : status === 0
      ? "Kết thúc"
      : "Sắp diễn ra";

  return (
    <div className="space-y-3">
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

// Shared popup body, organised into tabs so it reads cleanly instead of one
// long cluttered scroll. Used by the home match popup and the predict page.
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
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tab, setTab] = useState<"form" | "insight" | "bxh" | "lineup">(
    started ? "insight" : "form"
  );

  useEffect(() => {
    let alive = true;
    getTeamInfo(team1, team2).then((d) => alive && setInfo(d));
    getGroups().then((g) => alive && setGroups(g));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  // This match's group (group-stage only — knockout matches have none).
  const myGroup =
    groups?.find((g) => g.rows.some((r) => inMatch(r.name, team1, team2))) ?? null;

  const tabs = [
    { id: "form" as const, label: "Phong độ" },
    { id: "insight" as const, label: started ? "🔴 Trực tiếp" : "Nhận định" },
    ...(myGroup ? [{ id: "bxh" as const, label: "BXH" }] : []),
    { id: "lineup" as const, label: "Đội hình" },
  ];

  return (
    <div className="space-y-4">
      {/* Segmented tabs */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "accent-grad shadow-glow"
                : "text-white/60 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "form" &&
        (info === null ? (
          <p className="text-sm text-white/40">Đang tải…</p>
        ) : (
          <div className="space-y-3">
            <FormCompare info={info} />
            <RecentForm info={info} />
          </div>
        ))}

      {tab === "bxh" && myGroup && groups && (
        <GroupBoard team1={team1} team2={team2} group={myGroup} groups={groups} />
      )}

      {tab === "insight" &&
        (started ? (
          <LiveStatsSection team1={team1} team2={team2} />
        ) : (
          <div className="space-y-3">
            <PredictionSection team1={team1} team2={team2} />
            <OddsSection team1={team1} team2={team2} />
          </div>
        ))}

      {tab === "lineup" && <LineupView team1={team1} team2={team2} />}
    </div>
  );
}
