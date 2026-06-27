"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Modal from "@/components/Modal";
import { getTeamInfo } from "@/lib/queries";
import type {
  BracketRound,
  BracketMatch,
  GroupTable,
  SlotRef,
} from "@/lib/tournament";

const SEEDS = new Set([
  "Brazil",
  "Pháp",
  "Hà Lan",
  "Anh",
  "Đức",
  "Argentina",
  "Tây Ban Nha",
]);

const norm = (s: string) =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const pad = (n: number) => String(n).padStart(2, "0");
const vnDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
};
const vnTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

type Open =
  | { kind: "team"; team: string }
  | { kind: "group"; group: string }
  | { kind: "thirds"; groups: string[] }
  | { kind: "match"; m: BracketMatch }
  | null;

// A two-sided knockout bracket (Round of 32 → Final). Tap a slot to explore:
// a filled team → its info; "Nhất bảng X" → that group's table; "Thắng trận N"
// → that match's two teams (if any). Each box shows kickoff + host country.
export default function Bracket({
  rounds,
  groups,
}: {
  rounds: BracketRound[];
  groups: GroupTable[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const [full, setFull] = useState(false);

  const byName = (n: string) => rounds.find((r) => r.name === n)?.matches ?? [];
  const finalM = byName("Chung kết")[0];

  // KO rounds outer → centre (Final is the centrepiece, handled separately).
  const koRounds = [
    { name: "Vòng 1/16", matches: byName("Vòng 1/16") },
    { name: "Vòng 1/8", matches: byName("Vòng 1/8") },
    { name: "Tứ kết", matches: byName("Tứ kết") },
    { name: "Bán kết", matches: byName("Bán kết") },
  ].filter((r) => r.matches.length > 0);

  if (koRounds.length === 0 && !finalM) return null;

  const matchByNum = new Map<number, BracketMatch>();
  rounds.forEach((r) => r.matches.forEach((m) => matchByNum.set(m.matchNumber, m)));

  // Collapse finished rounds: by default start at the earliest round that still
  // has a match to play (so e.g. at the semis you only see SF + Final).
  let activeStart = koRounds.findIndex((r) => r.matches.some((m) => !m.played));
  if (activeStart < 0) activeStart = 0;
  const start = full ? 0 : activeStart;
  const shown = koRounds.slice(start);

  const half = (a: BracketMatch[], side: "l" | "r") => {
    const mid = Math.ceil(a.length / 2);
    return side === "l" ? a.slice(0, mid) : a.slice(mid);
  };
  const leftCols = shown.map((r) => half(r.matches, "l"));
  const rightCols = [...shown].reverse().map((r) => half(r.matches, "r"));

  const openSlot = (ref: SlotRef) => {
    if (ref.kind === "group") setOpen({ kind: "group", group: ref.group });
    else if (ref.kind === "group3") setOpen({ kind: "thirds", groups: ref.groups });
    else {
      const fm = matchByNum.get(ref.num);
      if (fm && (fm.homeKnown || fm.awayKnown)) setOpen({ kind: "match", m: fm });
    }
  };

  const Box = ({ m }: { m: BracketMatch }) => {
    const country = m.venue.split(",").pop()?.trim();
    return (
      <div className="b-box">
        <SideRow
          name={m.home}
          slot={m.homeSlot}
          score={m.played ? m.hs : null}
          win={m.played && (m.hs ?? 0) > (m.as ?? 0)}
          known={m.homeKnown}
          onClick={
            m.homeKnown
              ? () => setOpen({ kind: "team", team: m.home })
              : m.homeRef
              ? () => openSlot(m.homeRef!)
              : undefined
          }
        />
        <SideRow
          name={m.away}
          slot={m.awaySlot}
          score={m.played ? m.as : null}
          win={m.played && (m.as ?? 0) > (m.hs ?? 0)}
          known={m.awayKnown}
          onClick={
            m.awayKnown
              ? () => setOpen({ kind: "team", team: m.away })
              : m.awayRef
              ? () => openSlot(m.awayRef!)
              : undefined
          }
        />
        {(m.date || country) && (
          <div className="b-meta">
            {vnDate(m.date)} {vnTime(m.date)}
            {country ? ` · ${country}` : ""}
          </div>
        )}
      </div>
    );
  };

  const Col = ({ col }: { col: BracketMatch[] }) => (
    <div className="b-col">
      {col.map((m, i) => (
        <div key={i} className="b-cell">
          <Box m={m} />
        </div>
      ))}
    </div>
  );

  return (
    <>
      {activeStart > 0 && (
        <button
          onClick={() => setFull((v) => !v)}
          className="mb-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/10"
        >
          {full
            ? "Thu gọn — chỉ vòng đang đá ▴"
            : `Xem toàn bộ sơ đồ (cả ${activeStart} vòng đã xong) ▾`}
        </button>
      )}
      <div className="bracket-wrap">
      <div className="bracket">
        <div className="b-side b-side-l">
          {leftCols.map((col, i) => (
            <Col key={i} col={col} />
          ))}
        </div>
        <div className="b-center">
          <p className="title-lux text-center text-lg tracking-widest">FINAL</p>
          <Image
            src="/trophy.webp"
            alt="Cúp"
            width={63}
            height={141}
            className="mx-auto my-2 h-24 w-auto object-contain drop-shadow-[0_2px_14px_rgba(233,201,124,0.5)]"
          />
          {finalM && (
            <div className="w-40">
              <Box m={finalM} />
            </div>
          )}
        </div>
        <div className="b-side b-side-r">
          {rightCols.map((col, i) => (
            <Col key={i} col={col} />
          ))}
        </div>
      </div>

      {open && (
        <Modal title={modalTitle(open)} onClose={() => setOpen(null)}>
          {open.kind === "team" && <TeamPanel team={open.team} groups={groups} />}
          {open.kind === "group" && (
            <GroupView g={groups.find((x) => x.name === open.group)} />
          )}
          {open.kind === "thirds" && (
            <ThirdsView groups={groups} highlight={open.groups} />
          )}
          {open.kind === "match" && <FeederView m={open.m} />}
        </Modal>
      )}
      </div>
    </>
  );
}

function modalTitle(o: NonNullable<Open>): string {
  if (o.kind === "team") return o.team;
  if (o.kind === "group") return `Bảng ${o.group}`;
  if (o.kind === "thirds") return "Xếp hạng đội hạng 3";
  return `Trận ${o.m.matchNumber}`;
}

function SideRow({
  name,
  slot,
  score,
  win,
  known,
  onClick,
}: {
  name: string;
  slot: string;
  score: number | null;
  win: boolean;
  known: boolean;
  onClick?: () => void;
}) {
  const seed = known && SEEDS.has(name);
  const cls = `b-team ${win ? "font-bold text-grass" : seed ? "font-semibold text-gold" : ""}`;
  const inner = (
    <>
      <span className="truncate">
        {seed && "⭐ "}
        {name}
      </span>
      {score != null && <span className="font-mono text-white/70">{score}</span>}
    </>
  );
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button
      onClick={onClick}
      title={known ? `Xem thông tin ${name}` : slot}
      className={`${cls} w-full text-left transition hover:bg-white/10`}
    >
      {inner}
    </button>
  );
}

// ── Modal bodies ──────────────────────────────────────────────────────────────
function Standings({
  rows,
  qualify = 2,
  highlight,
}: {
  rows: GroupTable["rows"];
  qualify?: number;
  highlight?: (name: string) => boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-[11px] uppercase tracking-wider text-white/40">
        <tr>
          <th className="px-2 py-2 text-left font-medium">Đội</th>
          <th className="px-1 py-2 text-center font-medium">Tr</th>
          <th className="px-1 py-2 text-center font-medium">T-H-B</th>
          <th className="px-1 py-2 text-center font-medium">Hiệu</th>
          <th className="px-2 py-2 text-center font-medium">Đ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={r.name}
            className={`border-t border-white/5 ${
              highlight?.(r.name)
                ? "bg-grass/20"
                : i < qualify
                ? "bg-grass/5"
                : ""
            }`}
          >
            <td className="px-2 py-2">
              <span className="mr-2 text-white/40">{i + 1}</span>
              {r.name}
            </td>
            <td className="px-1 py-2 text-center text-white/60">{r.P}</td>
            <td className="px-1 py-2 text-center text-white/60">
              {r.W}-{r.D}-{r.L}
            </td>
            <td className="px-1 py-2 text-center text-white/60">
              {r.GD > 0 ? `+${r.GD}` : r.GD}
            </td>
            <td className="px-2 py-2 text-center font-bold">{r.Pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupView({ g }: { g?: GroupTable }) {
  if (!g) return <p className="text-sm text-white/50">Chưa có dữ liệu bảng này.</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <Standings rows={g.rows} qualify={2} />
      </div>
      <p className="text-[11px] text-white/30">2 đội đầu bảng (xanh) đi tiếp.</p>
    </div>
  );
}

function ThirdsView({
  groups,
  highlight,
}: {
  groups: GroupTable[];
  highlight: string[];
}) {
  const thirds = groups
    .map((g) => ({ group: g.name, row: g.rows[2] }))
    .filter((x) => !!x.row)
    .map((x) => ({ group: x.group, ...x.row! }))
    .sort(
      (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name)
    );
  const hi = new Set(highlight);
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Đội (bảng)</th>
              <th className="px-1 py-2 text-center font-medium">Hiệu</th>
              <th className="px-2 py-2 text-center font-medium">Đ</th>
            </tr>
          </thead>
          <tbody>
            {thirds.map((r, i) => {
              const qual = i < 8;
              return (
                <tr
                  key={r.name}
                  className={`border-t border-white/5 ${
                    hi.has(r.group) ? "bg-amber-400/10" : qual ? "bg-grass/5" : "opacity-70"
                  }`}
                >
                  <td className="px-2 py-2 text-white/40">
                    {i + 1}
                    {qual && <span className="text-grass"> ✓</span>}
                  </td>
                  <td className="px-2 py-2">
                    {r.name} <span className="text-white/40">({r.group})</span>
                  </td>
                  <td className="px-1 py-2 text-center text-white/60">
                    {r.GD > 0 ? `+${r.GD}` : r.GD}
                  </td>
                  <td className="px-2 py-2 text-center font-bold">{r.Pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/30">
        8 đội hạng 3 tốt nhất (✓) đi tiếp. Suất này từ bảng {highlight.join("/")}.
      </p>
    </div>
  );
}

function FeederView({ m }: { m: BracketMatch }) {
  const country = m.venue || "";
  const Side = ({ name, known, score }: { name: string; known: boolean; score: number | null }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2">
      <span className={known ? "font-semibold" : "text-white/50"}>{name}</span>
      {score != null && <span className="font-mono text-white/70">{score}</span>}
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/50">
        Đội thắng trận này đi vào nhánh đang xét.
      </p>
      <Side name={m.home} known={m.homeKnown} score={m.played ? m.hs : null} />
      <Side name={m.away} known={m.awayKnown} score={m.played ? m.as : null} />
      <p className="text-[11px] text-white/40">
        ⏱ {vnDate(m.date)} {vnTime(m.date)}
        {country ? ` · 🏟 ${country}` : ""}
      </p>
    </div>
  );
}

function TeamPanel({ team, groups }: { team: string; groups: GroupTable[] }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getTeamInfo>>[number] | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getTeamInfo(team, team).then((d) => {
      if (alive) {
        setInfo(d[0]);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [team]);

  const g = groups.find((gg) => gg.rows.some((r) => norm(r.name) === norm(team)));
  const pos = g ? g.rows.findIndex((r) => norm(r.name) === norm(team)) + 1 : 0;
  const row = g?.rows[pos - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold">{team}</span>
        {info?.rank != null && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
            Hạng FIFA ~{info.rank}
          </span>
        )}
        {SEEDS.has(team) && (
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold">
            ⭐ Hạt giống
          </span>
        )}
      </div>

      {g && row && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <p>
            Bảng <b>{g.name}</b> · đang <b>hạng {pos}</b> ·{" "}
            <b className="text-white/80">{row.Pts}đ</b>{" "}
            <span className="text-white/50">
              (đã đá {row.P}, {row.W}T {row.D}H {row.L}B · ghi {row.GF}/thủng {row.GA})
            </span>
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Đang tải…</p>
      ) : info && info.played > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Kết quả tại giải ({info.w}T {info.d}H {info.l}B · {info.gf}–{info.ga})
          </p>
          <ul className="space-y-1 text-sm">
            {info.results.map((r, i) => (
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
        </div>
      ) : (
        <p className="text-sm text-white/50">Chưa có kết quả tại giải.</p>
      )}
    </div>
  );
}
