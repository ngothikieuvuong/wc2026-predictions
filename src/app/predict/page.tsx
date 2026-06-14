"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOpenMatches } from "@/lib/queries";
import type { Match } from "@/lib/types";
import { formatKickoff, isClosed } from "@/lib/format";

export default function PredictPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [name, setName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const m = await getOpenMatches();
      setMatches(m);
      setLoading(false);
    })();
  }, []);

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
      setMsg({ type: "err", text: "Dự đoán đã đóng — trận đã bắt đầu." });
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
          ? "Bạn đã dự đoán trận này rồi. Mỗi người chỉ dự đoán một lần mỗi trận."
          : error.message,
      });
      return;
    }

    setMsg({ type: "ok", text: "✅ Đã lưu dự đoán. Chúc may mắn!" });
    setHome("");
    setAway("");
    setMatchId("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dự đoán tỉ số</h1>
        <p className="text-sm text-white/50">
          20.000₫ vào hũ thưởng. Đoán đúng tỉ số thắng. Mỗi trận một lượt.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Tên của bạn</label>
          <input
            className="input"
            placeholder="VD: Minh"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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

        {selected && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{selected.team1}</label>
              <input
                type="number"
                min={0}
                className="input text-center text-xl"
                value={home}
                onChange={(e) => setHome(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{selected.team2}</label>
              <input
                type="number"
                min={0}
                className="input text-center text-xl"
                value={away}
                onChange={(e) => setAway(e.target.value)}
              />
            </div>
          </div>
        )}

        {closed && (
          <p className="text-sm text-amber-400">
            Trận đã bắt đầu — dự đoán đã đóng.
          </p>
        )}

        {msg && (
          <p
            className={`text-sm ${
              msg.type === "ok" ? "text-grass" : "text-red-400"
            }`}
          >
            {msg.text}
          </p>
        )}

        <button className="btn w-full" disabled={submitting || closed}>
          {submitting ? "Đang gửi…" : "Chốt dự đoán"}
        </button>
      </form>
    </div>
  );
}
