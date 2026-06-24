"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GroupTable, BracketRound, Fixture } from "@/lib/tournament";
import { getMatchResults, getOpenMatches } from "@/lib/queries";
import { autoSync } from "@/lib/syncClient";
import { formatKickoff, matchSlug } from "@/lib/format";
import { useRefresh } from "@/components/Refresh";
import MatchInfoButton from "@/components/MatchInfoButton";
import PageHeader from "@/components/PageHeader";

// Small green badge marking a match that's open for prediction.
function OpenBadge() {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-grass">
      Mở đoán
    </span>
  );
}

const isStarted = (iso: string) =>
  !!iso && new Date(iso).getTime() <= Date.now();

type Results = Awaited<ReturnType<typeof getMatchResults>>;

// "15/06" / "01:00" in Vietnam time from a FIFA UTC ISO string.
function viDay(iso: string): string {
  const v = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}`;
}
function viTime(iso: string): string {
  const v = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`;
}

const TABS = [
  { key: "nhanh", label: "Lịch thi đấu" },
  { key: "ketqua", label: "Kết quả" },
  { key: "bang", label: "Bảng xếp hạng" },
] as const;

// One collapsible round section (Vòng bảng, Vòng 1/16, …).
function RoundSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
      >
        <span className="font-bold">
          {title}
          <span className="ml-1.5 text-xs font-normal text-white/40">({count})</span>
        </span>
        <span className="text-white/40">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function GiaiTabs({
  groups,
  groupFixtures,
  rounds,
  error,
}: {
  groups: GroupTable[];
  groupFixtures: Fixture[];
  rounds: BracketRound[];
  error?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("nhanh");
  const [results, setResults] = useState<Results | null>(null);
  // Team-pair keys of matches the admin has opened for prediction.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const isMatchOpen = (home: string, away: string) =>
    openKeys.has(matchSlug(home, away));
  // Which round sections are expanded. Default: Vòng bảng open, knockout closed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => expanded[k] ?? k === "Vòng bảng";
  const toggle = (k: string) =>
    setExpanded((e) => ({ ...e, [k]: !isOpen(k) }));
  // Whether the predict/tab bar is frozen under the nav → shrink it.
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const RESULTS_SHOWN = 10;
  const [q, setQ] = useState("");

  useEffect(() => {
    getOpenMatches().then((ms) =>
      setOpenKeys(new Set(ms.map((m) => matchSlug(m.team1, m.team2))))
    );
  }, []);

  // Re-fetch results + open flags when the global refresh button is tapped.
  const { tick } = useRefresh();
  useEffect(() => {
    if (!tick) return;
    getOpenMatches().then((ms) =>
      setOpenKeys(new Set(ms.map((m) => matchSlug(m.team1, m.team2))))
    );
    setResults(null);
    if (tab === "ketqua") getMatchResults().then(setResults);
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const navH =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
      ) || 90;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      rootMargin: `-${navH}px 0px 0px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (tab === "ketqua" && results === null) {
      getMatchResults().then(setResults);
      // Pull fresh FIFA scores; reload results if anything changed.
      autoSync().then((changed) => {
        if (changed) getMatchResults().then(setResults);
      });
    }
  }, [tab, results]);

  // Team search (accent-insensitive).
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const nq = norm(q);
  const hit = (a: string, b: string) =>
    !nq || norm(a).includes(nq) || norm(b).includes(nq);
  const filteredResults = (results ?? []).filter((m) => hit(m.team1, m.team2));

  // Group upcoming group-stage fixtures by day (already sorted), filtered.
  const fxGroups: { day: string; items: Fixture[] }[] = [];
  for (const f of groupFixtures) {
    if (!hit(f.home, f.away)) continue;
    const day = viDay(f.date);
    const last = fxGroups[fxGroups.length - 1];
    if (!last || last.day !== day) fxGroups.push({ day, items: [f] });
    else last.items.push(f);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch và kết quả"
        subtitle="Lịch thi đấu, kết quả các trận và bảng xếp hạng."
      />

      {/* Sentinel: marks where the bar pins under the nav */}
      <div ref={sentinelRef} aria-hidden className="h-0" />

      {/* Predict button + tabs freeze under the nav while scrolling — and
          shrink once frozen. */}
      <div
        className={`bar-bg sticky z-20 -mx-4 border-b border-white/10 px-4 backdrop-blur-xl transition-all duration-200 ${
          stuck ? "space-y-2 py-2" : "space-y-3 py-3"
        }`}
        style={{ top: "var(--nav-h)" }}
      >
        <Link
          href="/predict"
          className={`accent-grad flex w-full items-center justify-center gap-2 rounded-2xl font-extrabold shadow-glow transition-all duration-200 hover:brightness-110 active:scale-[0.98] ${
            stuck ? "px-6 py-2 text-sm" : "px-6 py-3.5 text-lg"
          }`}
        >
          ⚽ Dự Đoán Ngay
        </Link>

        <div className="flex gap-1 rounded-xl bg-black/30 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg px-2 font-medium transition-all duration-200 ${
                stuck ? "py-1 text-xs" : "py-2 text-sm"
              } ${
                tab === t.key
                  ? "accent-grad shadow-glow"
                  : "text-white/60 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔎 Tìm theo đội…"
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-base text-white placeholder-white/40 outline-none focus:border-grass"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label="Xoá"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card text-white/50">Không tải được dữ liệu giải đấu.</div>
      )}

      {/* Standings */}
      {tab === "bang" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups
              .filter((g) => !nq || g.rows.some((r) => norm(r.name).includes(nq)))
              .map((g) => (
              <div key={g.name} className="card p-0 overflow-hidden">
                <div className="border-b border-white/10 px-4 py-2 text-sm font-bold">
                  Bảng {g.name.replace("Group ", "")}
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
                    {g.rows.map((r, i) => (
                      <tr
                        key={r.name}
                        className={`border-t border-white/5 ${i < 2 ? "bg-grass/10" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <span className="mr-2 text-white/40">{i + 1}</span>
                          {r.name}
                        </td>
                        <td className="px-2 py-2 text-center text-white/60">{r.P}</td>
                        <td className="px-2 py-2 text-center text-white/60">
                          {r.GD > 0 ? `+${r.GD}` : r.GD}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{r.Pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30">2 đội đầu mỗi bảng (xanh) đi tiếp.</p>
        </div>
      )}

      {/* Schedule grouped by round (collapsible) */}
      {tab === "nhanh" && (
        <div className="space-y-3">
          {fxGroups.length > 0 && (
            <RoundSection
              title="Vòng bảng"
              count={fxGroups.reduce((s, g) => s + g.items.length, 0)}
              open={isOpen("Vòng bảng")}
              onToggle={() => toggle("Vòng bảng")}
            >
              {fxGroups.map((g) => (
                <div key={g.day} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    {g.day}
                  </p>
                  {g.items.map((m, i) => (
                    <MatchInfoButton
                      key={i}
                      team1={m.home}
                      team2={m.away}
                      started={isStarted(m.date)}
                    >
                      <div
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-white/10 ${
                          isMatchOpen(m.home, m.away)
                            ? "bg-grass/10 ring-1 ring-grass/40"
                            : "bg-black/20"
                        }`}
                      >
                        <span className="w-11 shrink-0 text-xs text-white/40">
                          {viTime(m.date)}
                        </span>
                        <span className="flex-1 text-right font-medium">{m.home}</span>
                        <span className="text-xs text-white/40">vs</span>
                        <span className="flex-1 font-medium">{m.away}</span>
                        {isMatchOpen(m.home, m.away) && <OpenBadge />}
                      </div>
                    </MatchInfoButton>
                  ))}
                </div>
              ))}
            </RoundSection>
          )}

          {rounds.map((round) => {
            const ms = round.matches.filter((m) => hit(m.home, m.away));
            if (nq && ms.length === 0) return null;
            return (
            <RoundSection
              key={round.name}
              title={round.name}
              count={ms.length}
              open={nq ? true : isOpen(round.name)}
              onToggle={() => toggle(round.name)}
            >
              <ul className="space-y-1.5">
                {ms.map((m, i) => {
                  const open = m.teamsKnown && isMatchOpen(m.home, m.away);
                  const row = (
                    <div
                      className={`rounded-lg px-3 py-2 transition hover:bg-white/10 ${
                        open ? "bg-grass/10 ring-1 ring-grass/40" : "bg-black/20"
                      }`}
                    >
                      {m.date && (
                        <p className="mb-1 text-center text-[11px] text-white/40">
                          {viDay(m.date)} · {viTime(m.date)}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex-1 text-right font-medium">{m.home}</span>
                        <span className="min-w-14 text-center font-bold text-white/80">
                          {m.played ? `${m.hs}–${m.as}` : "vs"}
                        </span>
                        <span className="flex-1 font-medium">{m.away}</span>
                        {open && <OpenBadge />}
                      </div>
                    </div>
                  );
                  return (
                    <li key={i}>
                      {m.teamsKnown ? (
                        <MatchInfoButton
                          team1={m.home}
                          team2={m.away}
                          started={m.played || isStarted(m.date)}
                        >
                          {row}
                        </MatchInfoButton>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </RoundSection>
            );
          })}

          {fxGroups.length === 0 && rounds.length === 0 && (
            <div className="card text-white/50">Chưa có lịch thi đấu.</div>
          )}
        </div>
      )}

      {/* Results — most recent first; older ones collapse behind a button */}
      {tab === "ketqua" && (
        <div className="card p-0 overflow-hidden">
          {results === null ? (
            <p className="p-4 text-white/40">Đang tải…</p>
          ) : filteredResults.length === 0 ? (
            <p className="p-4 text-white/50">
              {nq ? "Không tìm thấy trận của đội này." : "Chưa có trận nào kết thúc."}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {(showAllResults
                ? filteredResults
                : filteredResults.slice(0, RESULTS_SHOWN)
              ).map((m) => (
                <li key={m.id}>
                  <MatchInfoButton team1={m.team1} team2={m.team2} started>
                    <div className="px-4 py-3 transition hover:bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex-1 text-right text-sm font-medium">
                          {m.team1}
                        </span>
                        <span className="min-w-16 text-center text-lg font-bold">
                          {m.home_score}–{m.away_score}
                        </span>
                        <span className="flex-1 text-sm font-medium">{m.team2}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/30">
                          {formatKickoff(m.kickoff_time)}
                        </span>
                        {m.winners.length > 0 && (
                          <span className="text-xs font-semibold text-neon">
                            🎯 {m.winners.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </MatchInfoButton>
                </li>
              ))}
              {filteredResults.length > RESULTS_SHOWN && (
                <li>
                  <button
                    onClick={() => setShowAllResults((v) => !v)}
                    className="w-full px-4 py-3 text-center text-sm font-semibold text-white/60 transition hover:bg-white/5"
                  >
                    {showAllResults
                      ? "Thu gọn"
                      : `Xem thêm ${
                          filteredResults.length - RESULTS_SHOWN
                        } trận cũ hơn ▾`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
