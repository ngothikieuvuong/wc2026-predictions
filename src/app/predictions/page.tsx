"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import {
  getPredictionsByMatch,
  getReactionsByPrediction,
  getPlayers,
  addReaction,
  removeReaction,
} from "@/lib/queries";
import type { Match, Prediction, Reaction } from "@/lib/types";
import { getLive, findLive, type LiveScore } from "@/lib/liveClient";
import { autoSync } from "@/lib/syncClient";
import LiveBar from "@/components/LiveBar";
import { useRefresh } from "@/components/Refresh";
import { loseMessage, allMissMessage, winMessage } from "@/lib/tease";
import { formatKickoff, formatShort, isClosed, matchSlug } from "@/lib/format";
import MatchInfoButton from "@/components/MatchInfoButton";
import PendingWinnersBanner from "@/components/PendingWinnersBanner";
import JustWonBanner from "@/components/JustWonBanner";
import PageHeader from "@/components/PageHeader";
import { useProfile } from "@/components/Profile";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏", "🙏", "🤡"];

type Row = { match: Match; predictions: Prediction[] };

function isWinner(m: Match, p: Prediction): boolean {
  return (
    m.status === "finished" &&
    p.predicted_home === m.home_score &&
    p.predicted_away === m.away_score
  );
}

// Group a prediction's reactions by emoji → list of names.
function groupReactions(rs: Reaction[]): [string, string[]][] {
  const m = new Map<string, string[]>();
  for (const r of rs) {
    const a = m.get(r.emoji) ?? [];
    a.push(r.player_name);
    m.set(r.emoji, a);
  }
  return [...m.entries()];
}

function PredRow({
  match,
  p,
  reactions,
  liveInfo,
  onOpen,
}: {
  match: Match;
  p: Prediction;
  reactions: Reaction[];
  liveInfo: { t1: number; t2: number; minute: string } | null;
  onOpen: (p: Prediction) => void;
}) {
  const win = isWinner(match, p);
  const finished = match.status === "finished";
  // Match in play → compare to the live score. Scores only go up, so a
  // prediction is still reachable if ≥ the current score on both sides.
  const isLive = !!liveInfo;
  const liveExact =
    isLive &&
    p.predicted_home === liveInfo!.t1 &&
    p.predicted_away === liveInfo!.t2;
  const livePossible =
    isLive &&
    !liveExact &&
    p.predicted_home >= liveInfo!.t1 &&
    p.predicted_away >= liveInfo!.t2;
  const liveGone = isLive && !liveExact && !livePossible; // no chance anymore
  const tone = win
    ? "text-red-400 font-bold"
    : liveExact
    ? "text-grass font-bold"
    : liveGone || finished
    ? "text-white/35"
    : "";

  // Long-press (≈450ms) opens the reaction picker; a move/scroll cancels it.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const start = () => {
    cancel();
    timer.current = setTimeout(() => onOpen(p), 450);
  };

  const groups = groupReactions(reactions);

  return (
    <li className="py-2">
      <div
        className={`flex select-none items-center justify-between gap-2 ${tone}`}
        style={{ WebkitTouchCallout: "none" }}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerMove={cancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="min-w-0">
          <span className="font-medium">
            {win && "🎯 "}
            {p.player_name}
          </span>
          <span className="block text-[11px] text-white/30">
            đoán lúc {formatShort(p.created_at)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-lg font-bold">
          {p.predicted_home}–{p.predicted_away}
        </span>
      </div>

      {liveExact && (
        <p className="mt-0.5 text-[11px] font-semibold text-grass">
          Gần trúng rồi, cố lên xí nữa 🙂
        </p>
      )}

      {livePossible && (
        <p className="mt-0.5 text-[11px] text-white/50">🤞 còn cơ hội</p>
      )}

      {liveGone && (
        <p className="mt-0.5 text-[11px] text-white/30">{loseMessage(p.id)}</p>
      )}

      {groups.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {groups.map(([emoji, names]) => (
            <button
              key={emoji}
              onClick={() => onOpen(p)}
              title={names.join(", ")}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
            >
              <span>{emoji}</span>
              <span className="text-white/60">{names.length}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function MatchCard({
  match,
  predictions,
  reactionsByPred,
  liveScores,
  onOpen,
}: Row & {
  reactionsByPred: Map<string, Reaction[]>;
  liveScores: LiveScore[];
  onOpen: (p: Prediction) => void;
}) {
  const finished = match.status === "finished";
  const started = !finished && isClosed(match.kickoff_time); // kickoff passed
  const liveInfo = started ? findLive(liveScores, match.team1, match.team2) : null;
  // Live match: who currently matches; and whether nobody can win anymore
  // (every prediction already below the live score on some side).
  const liveWinners = liveInfo
    ? predictions
        .filter(
          (p) => p.predicted_home === liveInfo.t1 && p.predicted_away === liveInfo.t2
        )
        .map((p) => p.player_name)
    : [];
  const stillAlive = liveInfo
    ? predictions.some(
        (p) => p.predicted_home >= liveInfo.t1 && p.predicted_away >= liveInfo.t2
      )
    : false;
  const allMiss = !!liveInfo && predictions.length > 0 && !stillAlive;

  // Closest-to-winning first (live: extra goals still needed; finished: gap to
  // the final score; upcoming: keep original order).
  const closeness = (p: Prediction) => {
    if (liveInfo) {
      return p.predicted_home >= liveInfo.t1 && p.predicted_away >= liveInfo.t2
        ? p.predicted_home - liveInfo.t1 + (p.predicted_away - liveInfo.t2)
        : Infinity;
    }
    if (finished && match.home_score != null && match.away_score != null) {
      return (
        Math.abs(p.predicted_home - match.home_score) +
        Math.abs(p.predicted_away - match.away_score)
      );
    }
    return 0;
  };
  const sortedPreds = [...predictions].sort((a, b) => closeness(a) - closeness(b));
  return (
    <section
      id={matchSlug(match.team1, match.team2)}
      className={`card scroll-mt-28 space-y-3 transition ${
        started ? "border-red-500/40 ring-1 ring-red-500/30" : ""
      }`}
    >
      {/* Live: prominent score banner like the home page */}
      {started && (
        <div className="flex items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            Đang diễn ra
          </span>
          {liveInfo?.minute && (
            <span className="text-xs font-semibold text-red-300">
              {liveInfo.minute}
            </span>
          )}
        </div>
      )}

      <MatchInfoButton
        team1={match.team1}
        team2={match.team2}
        started={finished || started}
        showPredictionsLink={false}
      >
        <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-0.5 transition hover:bg-white/5">
          <div className="min-w-0">
            <p className="font-bold underline decoration-white/20 underline-offset-2">
              {match.team1} <span className="text-white/40">gặp</span> {match.team2}
            </p>
            <p className="text-xs text-white/50">⏱ {formatKickoff(match.kickoff_time)}</p>
          </div>
          {finished ? (
            <span className="whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold">
              KQ: {match.home_score}–{match.away_score}
            </span>
          ) : started ? (
            <span className="shrink-0 font-mono text-2xl font-extrabold text-red-300">
              {liveInfo ? `${liveInfo.t1}–${liveInfo.t2}` : "?–?"}
            </span>
          ) : (
            <span className="whitespace-nowrap rounded-full bg-grass/20 px-2.5 py-0.5 text-xs font-semibold text-grass">
              Sắp diễn ra
            </span>
          )}
        </div>
      </MatchInfoButton>

      {liveWinners.length > 0 && (
        <p className="rounded-lg bg-grass/15 px-3 py-1.5 text-center text-sm font-bold text-grass">
          {winMessage(match.id, liveWinners)}
        </p>
      )}

      {allMiss && (
        <p className="rounded-lg bg-red-500/15 px-3 py-1.5 text-center text-sm font-bold text-red-400">
          {allMissMessage(match.id)}
        </p>
      )}

      <ul className="divide-y divide-white/5">
        {sortedPreds.map((p) => (
          <PredRow
            key={p.id}
            match={match}
            p={p}
            reactions={reactionsByPred.get(p.id) ?? []}
            liveInfo={liveInfo}
            onOpen={onOpen}
          />
        ))}
      </ul>

      <p className="text-right text-xs text-white/40">{predictions.length} lượt đoán</p>
    </section>
  );
}

function ReactionSheet({
  target,
  players,
  existing,
  onClose,
  onChanged,
}: {
  target: { pred: Prediction; matchLabel: string };
  players: string[];
  existing: Reaction[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const { pred, matchLabel } = target;
  const { profile, setProfile } = useProfile();
  // Default the reactor to this device's profile (if it's in the roster).
  const [name, setName] = useState(
    profile && players.includes(profile) ? profile : ""
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Emojis the selected person has already placed on this prediction.
  const mine = new Set(
    existing.filter((r) => r.player_name === name).map((r) => r.emoji)
  );

  // Tap an emoji to toggle the selected person's reaction on/off.
  const toggle = async (emoji: string) => {
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      if (mine.has(emoji)) await removeReaction(pred.id, name, emoji);
      else {
        await addReaction(pred.id, name, emoji);
        setProfile(name); // remember this device's player for next time
      }
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const removeOne = async (who: string, emoji: string) => {
    setBusy(true);
    setErr(null);
    try {
      await removeReaction(pred.id, who, emoji);
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Modal
      title={matchLabel || "Cảm xúc"}
      onClose={onClose}
      footer={
        <button onClick={onClose} className="btn w-full">
          Xong
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="font-bold">
            {pred.player_name}:{" "}
            <span className="font-mono">
              {pred.predicted_home}–{pred.predicted_away}
            </span>
          </p>
        </div>

        {err && (
          <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">
            Lỗi: {err}
          </p>
        )}

        {existing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {existing.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => removeOne(r.player_name, r.emoji)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs hover:bg-red-500/20"
                title="Bấm để gỡ"
              >
                <span>{r.emoji}</span>
                <span className="text-white/60">{r.player_name}</span>
                <span className="text-white/40">✕</span>
              </button>
            ))}
          </div>
        )}

        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        >
          <option value="">— Ai thả? (chọn tên) —</option>
          {players.map((pl) => (
            <option key={pl} value={pl}>
              {pl}
            </option>
          ))}
        </select>

        {name && (
          <>
            <p className="text-sm font-semibold text-white/70">
              Chạm để thả / gỡ — chọn được nhiều
            </p>
            <div className="grid grid-cols-5 gap-2">
              {EMOJIS.map((e) => {
                const on = mine.has(e);
                return (
                  <button
                    key={e}
                    onClick={() => toggle(e)}
                    disabled={busy}
                    className={`rounded-xl py-2.5 text-2xl transition active:scale-95 ${
                      on
                        ? "bg-grass/30 ring-2 ring-grass"
                        : "bg-white/5 hover:bg-white/15"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function PredictionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [reactionsByPred, setReactionsByPred] = useState<Map<string, Reaction[]>>(
    new Map()
  );
  const [players, setPlayers] = useState<string[]>([]);
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<{
    pred: Prediction;
    matchLabel: string;
  } | null>(null);
  const [showOld, setShowOld] = useState(false); // older finished matches

  const loadReactions = async () =>
    setReactionsByPred(await getReactionsByPrediction());

  const loadAll = async () => {
    const [r, rx, pl, lv] = await Promise.all([
      getPredictionsByMatch(),
      getReactionsByPrediction(),
      getPlayers(),
      getLive(),
    ]);
    setRows(r);
    setReactionsByPred(rx);
    setPlayers(pl);
    setLiveScores(lv);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // Pull fresh FIFA scores on load; reload if anything changed.
    autoSync().then((changed) => {
      if (changed) loadAll();
    });
  }, []);

  // Re-fetch when the global "Cập nhật tỉ số" button is tapped.
  const { tick } = useRefresh();
  useEffect(() => {
    if (tick) loadAll();
  }, [tick]);

  // Linked from a match popup (#match-…): scroll to that match and flash it.
  // If the match sits in the collapsed group, expand it first, then scroll.
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) {
      if (
        !showOld &&
        olderFinished.some((r) => matchSlug(r.match.team1, r.match.team2) === hash)
      )
        setShowOld(true);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-grass");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-grass"), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, showOld]);

  // Sort by status: live on top, then upcoming (nearest first), then finished
  // (newest first).
  const isDone = (m: Match) => m.status === "finished" && m.home_score != null;
  const isLive = (m: Match) => !isDone(m) && isClosed(m.kickoff_time);
  const byKickoffAsc = (a: Row, b: Row) =>
    a.match.kickoff_time < b.match.kickoff_time ? -1 : 1;
  const byKickoffDesc = (a: Row, b: Row) =>
    a.match.kickoff_time > b.match.kickoff_time ? -1 : 1;

  const liveRows = rows.filter((r) => isLive(r.match)).sort(byKickoffAsc);
  const upcomingRows = rows
    .filter((r) => !isDone(r.match) && !isLive(r.match))
    .sort(byKickoffAsc); // nearest first
  const finishedRows = rows.filter((r) => isDone(r.match)).sort(byKickoffDesc); // new → old
  // Show only the 2 most-recently finished; the rest collapse into a group.
  const recentFinished = finishedRows.slice(0, 2);
  const olderFinished = finishedRows.slice(2);

  // Top sections: live, then upcoming, then the 2 latest finished.
  const sections = [
    { key: "live", title: "🔴 Đang diễn ra", items: liveRows, dim: false },
    { key: "upcoming", title: "Sắp diễn ra", items: upcomingRows, dim: false },
    { key: "finished", title: "Vừa kết thúc", items: recentFinished, dim: true },
  ];

  // Open the reaction sheet for a prediction; resolve its match for the label.
  const matchById = new Map(rows.map((r) => [r.match.id, r.match]));
  const onOpen = (p: Prediction) => {
    const m = matchById.get(p.match_id);
    setTarget({
      pred: p,
      matchLabel: m ? `${m.team1} gặp ${m.team2}` : "",
    });
  };

  return (
    <div className="space-y-6">
      <LiveBar live={liveScores} />

      <PageHeader
        title="Mọi người đoán"
        subtitle="Tất cả lượt đoán theo từng trận — chạm giữ một lượt để thả cảm xúc."
      />

      {/* Đoán Ngay — freezes under the nav (below the live bar) on scroll */}
      <div
        className="bar-bg sticky z-20 -mx-4 border-b border-white/10 px-4 py-2 backdrop-blur-xl"
        style={{ top: "calc(var(--nav-h) + var(--live-h, 0px))" }}
      >
        <Link
          href="/predict"
          className="accent-grad flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-2.5 font-extrabold shadow-glow transition hover:brightness-110 active:scale-[0.98]"
        >
          ⚽ Đoán Ngay
        </Link>
      </div>

      <PendingWinnersBanner />
      <JustWonBanner />

      {loading ? (
        <p className="text-white/40">Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className="card text-center">
          <p className="text-white/50">Chưa có ai đoán.</p>
          <Link href="/predict" className="btn mt-3">
            Đoán ngay
          </Link>
        </div>
      ) : (
        <>
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <div
                  key={s.key}
                  className={`space-y-3 ${s.dim ? "opacity-70" : ""}`}
                >
                  <h2 className="section-title">
                    {s.title}
                  </h2>
                  {s.items.map((r) => (
                    <MatchCard
                      key={r.match.id}
                      {...r}
                      reactionsByPred={reactionsByPred}
                      liveScores={liveScores}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )
          )}

          {/* Older finished matches — collapsed by default */}
          {olderFinished.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowOld((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/10"
              >
                <span>
                  Các trận đã kết thúc khác
                  <span className="ml-1.5 font-normal text-white/40">
                    ({olderFinished.length})
                  </span>
                </span>
                <span className="text-white/40">{showOld ? "▾" : "▸"}</span>
              </button>
              {showOld && (
                <div className="space-y-3 opacity-70">
                  {olderFinished.map((r) => (
                    <MatchCard
                      key={r.match.id}
                      {...r}
                      reactionsByPred={reactionsByPred}
                      liveScores={liveScores}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {target && (
        <ReactionSheet
          target={target}
          players={players}
          existing={reactionsByPred.get(target.pred.id) ?? []}
          onClose={() => setTarget(null)}
          onChanged={loadReactions}
        />
      )}
    </div>
  );
}
