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
import { formatKickoff, isClosed, formatVND } from "@/lib/format";
import { getStake } from "@/lib/admin";
import { matchHint, teamRank } from "@/lib/strength";
import { getOdds, findOdds } from "@/lib/oddsClient";
import { predictMatch, type Prediction as ScorePrediction } from "@/lib/predict";
import TeamInfoButton from "@/components/TeamInfoButton";
import StarAlert from "@/components/StarAlert";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { useProfile } from "@/components/Profile";

const NEW_PLAYER = "__new__";
const MAX_GOALS = 6; // 0–6 per side (e.g. 6–0 max, never 7–0)
const DEFAULT_OU_LINE = 3; // Tài = tổng > 3 bàn, Xỉu = tổng < 3 (khi không có kèo)

// Realistic scores via a Poisson model: each side's expected goals (xG) is the
// 2.6-goal match baseline split by relative strength, then goals are sampled
// from Poisson(xG). Common low scores (1-0, 1-1, 2-1…) dominate; wild scores
// (5-5, 6-4…) are rare and rerolled.
const AVG_TOTAL_GOALS = 2.6; // baseline expected goals for a match
const MAX_RETRY = 20; // Poisson resamples before falling back to the pool

// Sample from a Poisson distribution — Knuth's algorithm.
function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// Poisson PMF P(X = k) — weights the (rare) fallback pool realistically.
function poissonPmf(k: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Relative attacking strength from FIFA rank (lower rank = stronger); unknown
// teams get a mid-table strength.
function teamStrength(name: string): number {
  const rank = teamRank(name) ?? 50;
  return Math.max(15, 110 - rank); // keep underdogs non-trivial
}

// Split the average total goals into each side's expected goals by strength.
function expectedGoals(home: string, away: string): [number, number] {
  const sh = teamStrength(home);
  const sa = teamStrength(away);
  const total = sh + sa;
  return [AVG_TOTAL_GOALS * (sh / total), AVG_TOTAL_GOALS * (sa / total)];
}

// Weighted random pick from candidate [home, away] scores (weightFn → relative
// likelihood). Falls back to a uniform pick if every weight is zero.
function pickWeighted(
  cands: [number, number][],
  weightFn: (h: number, a: number) => number
): [number, number] {
  const total = cands.reduce((s, [h, a]) => s + weightFn(h, a), 0);
  if (total <= 0) return cands[Math.floor(Math.random() * cands.length)];
  let r = Math.random() * total;
  for (const c of cands) {
    r -= weightFn(c[0], c[1]);
    if (r <= 0) return c;
  }
  return cands[cands.length - 1];
}

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
        // Tài = tổng > mức; Xỉu = tổng ≤ mức (vd mức 3: 3–0 / 2–1 vẫn là Xỉu).
        if (useOu && ou === "over" && !(h + a > line)) continue;
        if (useOu && ou === "under" && !(h + a <= line)) continue;
        if (useNoDup && takenSet.has(`${h}-${a}`)) continue;
        out.push([h, a]);
      }
    return out;
  };

  const spin = () => {
    const [homeXG, awayXG] = expectedGoals(team1, team2);

    // Whether a score satisfies the current winner / tài-xỉu / no-dup settings.
    const valid = (h: number, a: number, useNoDup: boolean, useOu: boolean) => {
      if (winner === "home" && !(h > a)) return false;
      if (winner === "away" && !(a > h)) return false;
      if (useOu && ou === "over" && !(h + a > line)) return false;
      if (useOu && ou === "under" && !(h + a <= line)) return false;
      if (useNoDup && takenSet.has(`${h}-${a}`)) return false;
      return true;
    };

    // Poisson-sample a realistic score, rerolling unrealistic ones (total > 7 or
    // a team > 6) and any that break the constraints. If the constraints are too
    // tight to hit by sampling, relax no-dup first, then tài/xỉu.
    const draw = (useNoDup: boolean, useOu: boolean): [number, number] | null => {
      for (let i = 0; i < MAX_RETRY; i++) {
        const h = poisson(homeXG);
        const a = poisson(awayXG);
        if (h + a > 7 || h > MAX_GOALS || a > MAX_GOALS) continue;
        if (valid(h, a, useNoDup, useOu)) return [h, a];
      }
      return null;
    };

    let final = draw(noDup, true) ?? draw(false, true) ?? draw(false, false);
    if (!final) {
      // Sampling couldn't satisfy the constraints — pick from the guaranteed
      // pool, weighted by Poisson probability so it's still realistic.
      let p = pool(noDup, true);
      if (p.length === 0) p = pool(false, true);
      if (p.length === 0) p = pool(false, false);
      final = pickWeighted(p, (h, a) => poissonPmf(h, homeXG) * poissonPmf(a, awayXG));
    }

    setResult(final);
    setPhase("spin");
    const start = performance.now();
    const DURATION = 7000;
    const loop = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= DURATION) {
        setDisplay(final!);
        setPhase("done");
        return;
      }
      // Flicker realistic Poisson samples (capped) so wild scores rarely flash.
      setDisplay([
        Math.min(poisson(homeXG), MAX_GOALS),
        Math.min(poisson(awayXG), MAX_GOALS),
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
                      ? "accent-grad"
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
                      ? "accent-grad"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  {lb}
                </button>
              ))}
            </div>
            {ou !== "any" && (
              <p className="mt-1 text-[11px] text-white/40">
                {ou === "over" ? "Tổng bàn > " : "Tổng bàn ≤ "}
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

// Always-on statistical score hint (odds + rank/form) shown under the random
// button — no tap needed. Reference only.
function ScoreHint({ team1, team2 }: { team1: string; team2: string }) {
  const [pred, setPred] = useState<ScorePrediction | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setPred(null);
    setErr(false);
    predictMatch(team1, team2)
      .then((p) => alive && setPred(p))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (err) return null;
  if (!pred)
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center text-xs text-white/40">
        Đang phân tích gợi ý…
      </div>
    );

  const pct = (x: number) => Math.round(x * 100);
  return (
    <div className="space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          🤖 Gợi ý tỉ số · tham khảo
        </p>
        <p className="mt-1 text-xl font-extrabold">
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
          <span className="truncate">
            {team1} {pct(pred.pA)}%
          </span>
          <span className="shrink-0">Hòa {pct(pred.pDraw)}%</span>
          <span className="truncate text-right">
            {team2} {pct(pred.pB)}%
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
          <div className="bg-grass" style={{ width: `${pct(pred.pA)}%` }} />
          <div className="bg-amber-400" style={{ width: `${pct(pred.pDraw)}%` }} />
          <div className="bg-red-400" style={{ width: `${pct(pred.pB)}%` }} />
        </div>
      </div>

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

      <p className="text-[11px] leading-relaxed text-white/30">
        Dựa trên {pred.basis}. Chỉ tham khảo cho vui — đoán đúng y tỉ số rất khó.
      </p>
    </div>
  );
}

export default function PredictPage() {
  const { profile, setProfile } = useProfile();
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
  const [stake, setStakeVal] = useState(20000);

  // Effective player name: typed (new) or picked from the roster.
  const name = picked === NEW_PLAYER ? newName : picked;

  // Default the name to this device's saved profile (once the roster loads).
  useEffect(() => {
    if (profile && !picked && players.includes(profile)) setPicked(profile);
  }, [profile, players, picked]);

  useEffect(() => {
    (async () => {
      const [m, p, st] = await Promise.all([
        getOpenMatches(),
        getPlayers(),
        getStake(),
      ]);
      setMatches(m);
      setPlayers(p);
      setStakeVal(st);
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
    setProfile(finalName); // remember this device's player for next time

    setMsg({ type: "ok", text: "✅ Đã lưu. Chúc may mắn!" });
    setHome("");
    setAway("");
    setMatchId("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đoán tỉ số"
        subtitle={`Góp ${formatVND(stake)} vào quỹ. Đoán trúng tỉ số nhận quỹ. Mỗi trận một lượt.`}
      />

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

        {selected && <StarAlert team1={selected.team1} team2={selected.team2} />}

        {/* Score input — right under the match dropdown */}
        {selected && (
          <div className="grid grid-cols-2 gap-2">
            <ScoreStepper label={selected.team1} value={home} onChange={setHome} />
            <ScoreStepper label={selected.team2} value={away} onChange={setAway} />
          </div>
        )}

        {/* Status / validation — right under the score box */}
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

        {closed && (
          <p className="text-sm text-amber-400">
            Trận đã bắt đầu — dự đoán đã đóng.
          </p>
        )}

        <button className="btn w-full" disabled={submitting || closed}>
          {submitting ? "Đang gửi…" : "Chốt lượt đoán"}
        </button>

        {/* Helper tools — random + suggested score (kept visually separate) */}
        {selected && (
          <div className="space-y-3 rounded-2xl border border-grass/30 bg-grass/[0.06] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-grass">
              🎯 Gợi ý chọn tỉ số
            </p>
            <button
              type="button"
              onClick={() => setShowRandom(true)}
              className="btn-ghost w-full"
            >
              🎲 Random tỉ số
            </button>
            <ScoreHint team1={selected.team1} team2={selected.team2} />
          </div>
        )}

        {/* Reference info — team strength + others' predictions */}
        {selected &&
          (() => {
            const hint = matchHint(selected.team1, selected.team2);
            if (!hint && others.length === 0) return null;
            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  📊 Thông tin tham khảo
                </p>
                {hint && (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
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
                      <TeamInfoButton
                        team1={selected.team1}
                        team2={selected.team2}
                      />
                    </div>
                  </div>
                )}
                {others.length > 0 && (
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
              </div>
            );
          })()}

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
      </form>
    </div>
  );
}
