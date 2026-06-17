"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  getOpenMatches,
  getPlayers,
  addPlayer,
  getPredictionsForMatch,
} from "@/lib/queries";
import type { Match, Prediction } from "@/lib/types";
import { formatKickoff, isClosed } from "@/lib/format";
import { matchHint } from "@/lib/strength";
import { getOdds, findOdds } from "@/lib/oddsClient";
import TeamInfoButton from "@/components/TeamInfoButton";
import Modal from "@/components/Modal";

const NEW_PLAYER = "__new__";
const MAX_GOALS = 6; // 0–6 per side (e.g. 6–0 max, never 7–0)
const DEFAULT_OU_LINE = 3; // Tài = tổng > 3 bàn, Xỉu = tổng < 3 (khi không có kèo)

// "2.5/3" → 2.75 · "3" → 3 · "" → null
function parseOuLine(s: string | undefined): number | null {
  if (!s) return null;
  const ns = s
    .split("/")
    .map((x) => parseFloat(x.replace(/[^0-9.]/g, "")))
    .filter((n) => !isNaN(n));
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
}

// Pick a random score, then a 7s slot-machine spin before revealing it.
//  - "Đội thắng": force a winner for the chosen team (else any, incl. draws),
//  - "Không trùng": avoid scores other players already predicted for this match.
function RandomScoreModal({
  team1,
  team2,
  taken,
  onUse,
  onClose,
}: {
  team1: string;
  team2: string;
  taken: [number, number][];
  onUse: (h: number, a: number) => void;
  onClose: () => void;
}) {
  const [winner, setWinner] = useState<"any" | "home" | "away">("any");
  const [ou, setOu] = useState<"any" | "over" | "under">("any");
  const [noDup, setNoDup] = useState(true);
  const [phase, setPhase] = useState<"setup" | "spin" | "done">("setup");
  const [display, setDisplay] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<[number, number] | null>(null);
  // Over/under line: from the scraped odds if listed, else the default.
  const [line, setLine] = useState(DEFAULT_OU_LINE);
  const [lineFromOdds, setLineFromOdds] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    getOdds().then((rows) => {
      if (!alive) return;
      const l = parseOuLine(findOdds(rows, team1, team2)?.ouLine);
      if (l != null) {
        setLine(l);
        setLineFromOdds(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  const takenSet = new Set(taken.map(([h, a]) => `${h}-${a}`));

  const pool = (useNoDup: boolean, useOu: boolean): [number, number][] => {
    const out: [number, number][] = [];
    for (let h = 0; h <= MAX_GOALS; h++)
      for (let a = 0; a <= MAX_GOALS; a++) {
        if (winner === "home" && !(h > a)) continue;
        if (winner === "away" && !(a > h)) continue;
        if (useOu && ou === "over" && !(h + a > line)) continue;
        if (useOu && ou === "under" && !(h + a < line)) continue;
        if (useNoDup && takenSet.has(`${h}-${a}`)) continue;
        out.push([h, a]);
      }
    return out;
  };

  const spin = () => {
    // Relax constraints in order if the combination leaves nothing: drop
    // no-dup first, then tài/xỉu.
    let p = pool(noDup, true);
    if (p.length === 0) p = pool(false, true);
    if (p.length === 0) p = pool(false, false);
    const final = p[Math.floor(Math.random() * p.length)];
    setResult(final);
    setPhase("spin");
    const start = performance.now();
    const DURATION = 7000;
    const loop = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= DURATION) {
        setDisplay(final);
        setPhase("done");
        return;
      }
      setDisplay([
        Math.floor(Math.random() * (MAX_GOALS + 1)),
        Math.floor(Math.random() * (MAX_GOALS + 1)),
      ]);
      const prog = elapsed / DURATION;
      timer.current = setTimeout(loop, 55 + prog * prog * 420); // ease-out
    };
    loop();
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const footer =
    phase === "done" && result ? (
      <div className="flex gap-2">
        <button
          className="btn flex-1"
          onClick={() => onUse(result[0], result[1])}
        >
          Dùng tỉ số này
        </button>
        <button className="btn-ghost flex-1" onClick={spin}>
          🎲 Quay lại
        </button>
      </div>
    ) : undefined;

  return (
    <Modal title="🎲 Random tỉ số" onClose={onClose} footer={footer}>
      {phase === "setup" ? (
        <div className="space-y-4">
          <div>
            <label className="label">Đội thắng</label>
            <div className="flex gap-1 rounded-xl bg-black/30 p-1">
              {(
                [
                  ["any", "Bất kỳ"],
                  ["home", team1],
                  ["away", team2],
                ] as const
              ).map(([k, lb]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWinner(k)}
                  className={`flex-1 truncate rounded-lg px-2 py-2 text-sm font-medium transition ${
                    winner === k
                      ? "bg-grass text-black"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  {lb}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Tài / Xỉu</label>
            <div className="flex gap-1 rounded-xl bg-black/30 p-1">
              {(
                [
                  ["any", "Bất kỳ"],
                  ["over", "Tài"],
                  ["under", "Xỉu"],
                ] as const
              ).map(([k, lb]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOu(k)}
                  className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition ${
                    ou === k
                      ? "bg-grass text-black"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  {lb}
                </button>
              ))}
            </div>
            {ou !== "any" && (
              <p className="mt-1 text-[11px] text-white/40">
                {ou === "over" ? "Tổng bàn > " : "Tổng bàn < "}
                {line} ({lineFromOdds ? "theo kèo" : "mặc định"})
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noDup}
              onChange={(e) => setNoDup(e.target.checked)}
              className="h-4 w-4 accent-grass"
            />
            Không trùng tỉ số người khác đã đoán
          </label>

          <p className="text-[11px] text-white/40">
            Tỉ số ngẫu nhiên trong khoảng 0–{MAX_GOALS} bàn mỗi đội.
          </p>

          <button type="button" className="btn w-full text-lg" onClick={spin}>
            🎲 Quay số!
          </button>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-xs uppercase tracking-widest text-white/40">
            {phase === "spin" ? "Đang quay…" : "Tỉ số may mắn của bạn"}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="w-20 truncate text-right text-sm text-white/60">
              {team1}
            </span>
            <span
              key={`${display[0]}-${display[1]}-${phase}`}
              className={`score-tick rounded-2xl bg-black/40 px-5 py-3 font-mono text-5xl font-extrabold ${
                phase === "done" ? "text-neon" : "text-white"
              }`}
            >
              {display[0]}–{display[1]}
            </span>
            <span className="w-20 truncate text-left text-sm text-white/60">
              {team2}
            </span>
          </div>
          {phase === "spin" && (
            <p className="mt-3 text-xs text-white/30">
              Đang chọn tỉ số may mắn cho bạn… 🍀
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

// Score input with −/+ steppers for easy mobile entry.
function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const n = value === "" ? 0 : Number(value);
  const step = (d: number) => onChange(String(Math.max(0, n + d)));
  const btn =
    "flex h-7 w-full items-center justify-center rounded-lg bg-white/10 text-lg font-bold leading-none text-white/70 transition hover:bg-white/20 active:scale-95";
  return (
    <div className="min-w-0">
      <label className="label text-center">{label}</label>
      <div className="mx-auto flex max-w-[8rem] flex-col gap-1">
        <button type="button" onClick={() => step(1)} className={btn} aria-label="Tăng">
          +
        </button>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="input !py-1.5 !px-1 text-center text-lg font-bold"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" onClick={() => step(-1)} className={btn} aria-label="Giảm">
          −
        </button>
      </div>
    </div>
  );
}

export default function PredictPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [picked, setPicked] = useState(""); // dropdown value (a name, or NEW_PLAYER)
  const [newName, setNewName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [others, setOthers] = useState<Prediction[]>([]);
  const [showRandom, setShowRandom] = useState(false);

  // Effective player name: typed (new) or picked from the roster.
  const name = picked === NEW_PLAYER ? newName : picked;

  useEffect(() => {
    (async () => {
      const [m, p] = await Promise.all([getOpenMatches(), getPlayers()]);
      setMatches(m);
      setPlayers(p);
      setLoading(false);
    })();
  }, []);

  // Load others' predictions whenever the selected match changes.
  useEffect(() => {
    if (!matchId) {
      setOthers([]);
      return;
    }
    let alive = true;
    getPredictionsForMatch(matchId).then((p) => alive && setOthers(p));
    return () => {
      alive = false;
    };
  }, [matchId]);

  const selected = matches.find((m) => m.id === matchId);
  const closed = selected ? isClosed(selected.kickoff_time) : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!name.trim() || !matchId || home === "" || away === "") {
      setMsg({ type: "err", text: "Vui lòng điền đầy đủ thông tin." });
      return;
    }
    if (selected && isClosed(selected.kickoff_time)) {
      setMsg({ type: "err", text: "Lượt đoán đã đóng — trận đã bắt đầu." });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("predictions").insert({
      player_name: name.trim(),
      match_id: matchId,
      predicted_home: Number(home),
      predicted_away: Number(away),
    });
    setSubmitting(false);

    if (error) {
      const dup = error.code === "23505" || /duplicate|unique/i.test(error.message);
      setMsg({
        type: "err",
        text: dup
          ? "Bạn đã đoán trận này rồi. Mỗi người chỉ đoán một lần mỗi trận."
          : error.message,
      });
      return;
    }

    // New name → add to the roster so it appears in the dropdown next time.
    const finalName = name.trim();
    if (!players.some((p) => p.toLowerCase() === finalName.toLowerCase())) {
      await addPlayer(finalName);
      setPlayers((prev) => [...prev, finalName]);
    }
    setPicked(finalName);
    setNewName("");

    setMsg({ type: "ok", text: "✅ Đã lưu. Chúc may mắn!" });
    setHome("");
    setAway("");
    setMatchId("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Đoán tỉ số</h1>
        <p className="text-sm text-white/50">
          Góp 20.000₫ vào quỹ. Đoán trúng tỉ số nhận quỹ. Mỗi trận một lượt.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Tên của bạn</label>
          <select
            className="input"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value="">Chọn tên…</option>
            {players.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={NEW_PLAYER}>+ Người mới…</option>
          </select>
          {picked === NEW_PLAYER && (
            <input
              className="input mt-2"
              placeholder="Gõ tên mới"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="label">Trận đấu</label>
          {loading ? (
            <p className="text-white/40">Đang tải trận đấu…</p>
          ) : matches.length === 0 ? (
            <p className="text-white/50">Hiện chưa có trận nào mở dự đoán.</p>
          ) : (
            <select
              className="input"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
            >
              <option value="">Chọn trận đấu…</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id} disabled={isClosed(m.kickoff_time)}>
                  {m.team1} - {m.team2} — {formatKickoff(m.kickoff_time)}
                  {isClosed(m.kickoff_time) ? " (đã đóng)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {selected &&
          (() => {
            const hint = matchHint(selected.team1, selected.team2);
            if (!hint) return null;
            return (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wider text-white/40">
                  Tham khảo
                </p>
                <div className="flex items-center justify-between text-white/70">
                  <span>
                    {selected.team1}{" "}
                    <span className="text-white/40">(hạng ~{hint.rank1})</span>
                  </span>
                  <span>
                    <span className="text-white/40">(hạng ~{hint.rank2})</span>{" "}
                    {selected.team2}
                  </span>
                </div>
                <p className="mt-1 text-center font-semibold text-grass">
                  {hint.level === "cân sức" ? "⚖ Cân sức" : `💪 ${hint.level}`}
                </p>
                <div className="mt-2 text-center">
                  <TeamInfoButton team1={selected.team1} team2={selected.team2} />
                </div>
              </div>
            );
          })()}

        {selected && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ScoreStepper label={selected.team1} value={home} onChange={setHome} />
              <ScoreStepper label={selected.team2} value={away} onChange={setAway} />
            </div>
            <button
              type="button"
              onClick={() => setShowRandom(true)}
              className="btn-ghost w-full"
            >
              🎲 Random tỉ số
            </button>
          </>
        )}

        {showRandom && selected && (
          <RandomScoreModal
            team1={selected.team1}
            team2={selected.team2}
            taken={others.map(
              (p) => [p.predicted_home, p.predicted_away] as [number, number]
            )}
            onUse={(h, a) => {
              setHome(String(h));
              setAway(String(a));
              setShowRandom(false);
            }}
            onClose={() => setShowRandom(false)}
          />
        )}

        {selected && others.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-1 text-xs uppercase tracking-wider text-white/40">
              Người khác đã đoán ({others.length})
            </p>
            <ul className="divide-y divide-white/5">
              {others.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="font-medium">{p.player_name}</span>
                  <span className="font-mono font-bold">
                    {p.predicted_home}–{p.predicted_away}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {closed && (
          <p className="text-sm text-amber-400">
            Trận đã bắt đầu — dự đoán đã đóng.
          </p>
        )}

        {msg && (
          <div className="space-y-1">
            <p
              className={`text-sm ${
                msg.type === "ok" ? "text-grass" : "text-red-400"
              }`}
            >
              {msg.text}
            </p>
            {msg.type === "ok" && (
              <Link
                href="/predictions"
                className="inline-block text-sm font-semibold text-neon underline"
              >
                Xem lượt đoán của mọi người →
              </Link>
            )}
          </div>
        )}

        <button className="btn w-full" disabled={submitting || closed}>
          {submitting ? "Đang gửi…" : "Chốt lượt đoán"}
        </button>
      </form>
    </div>
  );
}
