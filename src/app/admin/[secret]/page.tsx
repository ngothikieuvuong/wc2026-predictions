"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calculateWinners, getAllMatches, getPredictionCount } from "@/lib/admin";
import type { Match } from "@/lib/types";
import { formatKickoff, formatVND } from "@/lib/format";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET;

export default function AdminPage({
  params,
}: {
  params: { secret: string };
}) {
  const { secret } = params;

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return (
      <div className="card text-center">
        <h1 className="text-xl font-bold">404 — Không tìm thấy</h1>
        <p className="mt-2 text-white/50">Trang này không tồn tại.</p>
      </div>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  // Create form
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [kickoff, setKickoff] = useState("");

  async function refresh() {
    const m = await getAllMatches();
    setMatches(m);
    const entries = await Promise.all(
      m.map(async (x) => [x.id, await getPredictionCount(x.id)] as const)
    );
    setCounts(Object.fromEntries(entries));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!team1.trim() || !team2.trim() || !kickoff) return;
    const { error } = await supabase.from("matches").insert({
      team1: team1.trim(),
      team2: team2.trim(),
      kickoff_time: new Date(kickoff).toISOString(),
      status: "upcoming",
    });
    if (error) return setBanner("Lỗi: " + error.message);
    setTeam1("");
    setTeam2("");
    setKickoff("");
    setBanner("✅ Đã tạo trận.");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">⚙️ Quản trị</h1>
        <p className="text-sm text-white/50">
          Tạo trận, nhập tỉ số cuối, và chia hũ thưởng.
        </p>
      </div>

      {banner && (
        <div className="card border-grass/40 text-sm text-grass">{banner}</div>
      )}

      {/* Create match */}
      <section className="card space-y-4">
        <h2 className="font-bold">Tạo trận</h2>
        <form onSubmit={createMatch} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Đội 1"
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
            />
            <input
              className="input"
              placeholder="Đội 2"
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Giờ bóng lăn</label>
            <input
              type="datetime-local"
              className="input"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
            />
          </div>
          <button className="btn">Tạo trận</button>
        </form>
      </section>

      {/* Matches list */}
      <section className="space-y-4">
        <h2 className="font-bold">Danh sách trận</h2>
        {loading ? (
          <p className="text-white/40">Đang tải…</p>
        ) : matches.length === 0 ? (
          <p className="text-white/50">Chưa có trận nào.</p>
        ) : (
          matches.map((m) => (
            <AdminMatchCard
              key={m.id}
              match={m}
              count={counts[m.id] ?? 0}
              onChanged={(text) => {
                setBanner(text);
                refresh();
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}

function AdminMatchCard({
  match,
  count,
  onChanged,
}: {
  match: Match;
  count: number;
  onChanged: (text: string) => void;
}) {
  const [team1, setTeam1] = useState(match.team1);
  const [team2, setTeam2] = useState(match.team2);
  const [kickoff, setKickoff] = useState(toLocalInput(match.kickoff_time));
  const [home, setHome] = useState(match.home_score?.toString() ?? "");
  const [away, setAway] = useState(match.away_score?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  async function saveEdits() {
    setBusy(true);
    const { error } = await supabase
      .from("matches")
      .update({
        team1: team1.trim(),
        team2: team2.trim(),
        kickoff_time: new Date(kickoff).toISOString(),
      })
      .eq("id", match.id);
    setBusy(false);
    onChanged(error ? "Lỗi: " + error.message : "✅ Đã cập nhật trận.");
  }

  async function payout() {
    if (home === "" || away === "") {
      onChanged("Hãy nhập đủ hai tỉ số.");
      return;
    }
    setBusy(true);
    try {
      const res = await calculateWinners(match.id, Number(home), Number(away));
      setBusy(false);
      if (res.carriedOver) {
        onChanged(
          `Không ai đoán đúng tỉ số ${match.team1} - ${match.team2}. Hũ thưởng cộng dồn.`
        );
      } else {
        onChanged(
          `🏆 ${res.winners.join(", ")} thắng ${formatVND(res.amountEach)} mỗi người ` +
            `(hũ ${formatVND(res.jackpotUsed)} chia ${res.winners.length} người).`
        );
      }
    } catch (e) {
      setBusy(false);
      onChanged("Lỗi: " + (e as Error).message);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Xóa trận ${match.team1} - ${match.team2}? Toàn bộ dự đoán của trận cũng bị xóa.`
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    setBusy(false);
    onChanged(error ? "Lỗi: " + error.message : "🗑 Đã xóa trận.");
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            match.status === "finished"
              ? "bg-white/10 text-white/60"
              : "bg-grass/20 text-grass"
          }`}
        >
          {match.status === "finished" ? "Đã kết thúc" : "Sắp diễn ra"}
        </span>
        <span className="text-xs text-white/40">{count} lượt dự đoán</span>
      </div>

      {/* Edit fields */}
      <div className="grid grid-cols-2 gap-3">
        <input className="input" value={team1} onChange={(e) => setTeam1(e.target.value)} />
        <input className="input" value={team2} onChange={(e) => setTeam2(e.target.value)} />
      </div>
      <div>
        <label className="label">Bóng lăn — {formatKickoff(match.kickoff_time)}</label>
        <input
          type="datetime-local"
          className="input"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="btn-ghost" onClick={saveEdits} disabled={busy}>
          Lưu thay đổi
        </button>
        <button
          className="btn-ghost text-red-300 hover:bg-red-500/10"
          onClick={remove}
          disabled={busy}
        >
          Xóa
        </button>
      </div>

      {/* Final score + payout */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="mb-2 text-sm font-semibold text-white/70">Tỉ số cuối</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            className="input w-20 text-center text-lg"
            placeholder="0"
            value={home}
            onChange={(e) => setHome(e.target.value)}
          />
          <span className="text-white/40">:</span>
          <input
            type="number"
            min={0}
            className="input w-20 text-center text-lg"
            placeholder="0"
            value={away}
            onChange={(e) => setAway(e.target.value)}
          />
          <button className="btn ml-auto whitespace-nowrap" onClick={payout} disabled={busy}>
            {busy ? "…" : "Chia thưởng 💰"}
          </button>
        </div>
        {match.status === "finished" && (
          <p className="mt-2 text-xs text-white/40">
            Đã ghi: {match.team1} {match.home_score}–{match.away_score} {match.team2}.
            Chạy lại sẽ tính lại tiền thưởng.
          </p>
        )}
      </div>
    </div>
  );
}

// ISO → value for <input type="datetime-local"> in local time.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
