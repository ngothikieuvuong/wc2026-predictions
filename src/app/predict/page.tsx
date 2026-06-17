"use client";

import { useEffect, useState } from "react";
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
import TeamInfoButton from "@/components/TeamInfoButton";

const NEW_PLAYER = "__new__";

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
          <div className="grid grid-cols-2 gap-2">
            <ScoreStepper label={selected.team1} value={home} onChange={setHome} />
            <ScoreStepper label={selected.team2} value={away} onChange={setAway} />
          </div>
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
