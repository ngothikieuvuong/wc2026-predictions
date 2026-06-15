"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  getPredictionsByMatch,
  getReactionsByPrediction,
  getPlayers,
  addReaction,
  removeReaction,
} from "@/lib/queries";
import type { Match, Prediction, Reaction } from "@/lib/types";
import { formatKickoff, formatShort, isClosed } from "@/lib/format";
import { dayKey, dayLabel } from "@/lib/day";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏", "🙏", "🤡"];

type Row = { match: Match; predictions: Prediction[] };
type DayGroup = { day: string; items: Row[]; finished: boolean };

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
  onOpen,
}: {
  match: Match;
  p: Prediction;
  reactions: Reaction[];
  onOpen: (p: Prediction) => void;
}) {
  const win = isWinner(match, p);
  const finished = match.status === "finished";
  const tone = win ? "text-red-400 font-bold" : finished ? "text-white/35" : "";

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
  onOpen,
}: Row & {
  reactionsByPred: Map<string, Reaction[]>;
  onOpen: (p: Prediction) => void;
}) {
  const finished = match.status === "finished";
  const live = !finished && isClosed(match.kickoff_time); // started, no score yet
  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {match.team1} <span className="text-white/40">gặp</span> {match.team2}
          </p>
          <p className="text-xs text-white/50">⏱ {formatKickoff(match.kickoff_time)}</p>
        </div>
        {finished ? (
          <span className="whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold">
            KQ: {match.home_score}–{match.away_score}
          </span>
        ) : live ? (
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Đang diễn ra
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-grass/20 px-2.5 py-0.5 text-xs font-semibold text-grass">
            Sắp diễn ra
          </span>
        )}
      </div>

      <ul className="divide-y divide-white/5">
        {predictions.map((p) => (
          <PredRow
            key={p.id}
            match={match}
            p={p}
            reactions={reactionsByPred.get(p.id) ?? []}
            onOpen={onOpen}
          />
        ))}
      </ul>

      <p className="text-right text-xs text-white/40">{predictions.length} lượt đoán</p>
    </section>
  );
}

function DayBlock({
  group,
  label,
  reactionsByPred,
  onOpen,
}: {
  group: DayGroup;
  label?: string;
  reactionsByPred: Map<string, Reaction[]>;
  onOpen: (p: Prediction) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
        {label ?? `Ngày ${dayLabel(group.day)}`}
      </h2>
      {group.items.map((r) => (
        <MatchCard
          key={r.match.id}
          {...r}
          reactionsByPred={reactionsByPred}
          onOpen={onOpen}
        />
      ))}
    </div>
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
  const [name, setName] = useState("");
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
      else await addReaction(pred.id, name, emoji);
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4 rounded-b-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs text-white/40">{matchLabel}</p>
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

        <button onClick={onClose} className="btn w-full">
          Xong
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function PredictionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [reactionsByPred, setReactionsByPred] = useState<Map<string, Reaction[]>>(
    new Map()
  );
  const [players, setPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOld, setShowOld] = useState(false);
  const [target, setTarget] = useState<{
    pred: Prediction;
    matchLabel: string;
  } | null>(null);

  const loadReactions = async () =>
    setReactionsByPred(await getReactionsByPrediction());

  useEffect(() => {
    (async () => {
      const [r, rx, pl] = await Promise.all([
        getPredictionsByMatch(),
        getReactionsByPrediction(),
        getPlayers(),
      ]);
      setRows(r);
      setReactionsByPred(rx);
      setPlayers(pl);
      setLoading(false);
    })();
  }, []);

  // Group by game-day (rows already sorted by kickoff asc).
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const d = dayKey(r.match.kickoff_time);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(r);
  }
  const groups: DayGroup[] = [...map.entries()].map(([day, items]) => ({
    day,
    items,
    finished: items.every(
      (r) => r.match.status === "finished" && r.match.home_score != null
    ),
  }));

  const upcoming = groups
    .filter((g) => !g.finished)
    .sort((a, b) => (a.day < b.day ? -1 : 1)); // soonest first
  const finishedDesc = groups
    .filter((g) => g.finished)
    .sort((a, b) => (a.day > b.day ? -1 : 1)); // most recent first
  const justEnded = finishedDesc[0];
  const older = finishedDesc.slice(1);

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
      <div>
        <h1 className="text-2xl font-bold">Lượt đoán của mọi người</h1>
        <p className="text-sm text-white/50">
          Trận sắp diễn ra ở trên, ngày vừa xong mờ bên dưới. Nhấn giữ một lượt
          đoán để thả cảm xúc 💬
        </p>
      </div>

      {loading ? (
        <p className="text-white/40">Đang tải…</p>
      ) : groups.length === 0 ? (
        <div className="card text-center">
          <p className="text-white/50">Chưa có ai đoán.</p>
          <Link href="/predict" className="btn mt-3">
            Đoán ngay
          </Link>
        </div>
      ) : (
        <>
          {upcoming.map((g) => (
            <DayBlock
              key={g.day}
              group={g}
              reactionsByPred={reactionsByPred}
              onOpen={onOpen}
            />
          ))}

          {justEnded && (
            <div className="opacity-70">
              <DayBlock
                group={justEnded}
                label={`Vừa kết thúc · Ngày ${dayLabel(justEnded.day)}`}
                reactionsByPred={reactionsByPred}
                onOpen={onOpen}
              />
            </div>
          )}

          {older.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowOld((v) => !v)}
                className="text-sm font-semibold text-white/60 hover:text-white"
              >
                {showOld ? "▾" : "▸"} Các ngày trước ({older.length})
              </button>
              {showOld &&
                older.map((g) => (
                  <div key={g.day} className="opacity-70">
                    <DayBlock
                      group={g}
                      reactionsByPred={reactionsByPred}
                      onOpen={onOpen}
                    />
                  </div>
                ))}
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
