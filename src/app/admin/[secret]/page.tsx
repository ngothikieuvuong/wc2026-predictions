"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  saveScore,
  computeSettlement,
  applySettlement,
  snapshotRewards,
  restoreRewards,
  getAllMatches,
  getPredictionCount,
  getMatchPredictions,
  updatePrediction,
  deletePrediction,
} from "@/lib/admin";
import type { SettleResult } from "@/lib/admin";
import type { Match, Prediction, Reward } from "@/lib/types";
import { formatKickoff, formatVND } from "@/lib/format";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET;

// Aggregate a settlement's per-day payouts into per-person totals (desc).
function perPerson(r: SettleResult): { name: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const p of r.payouts)
    m.set(p.player_name, (m.get(p.player_name) ?? 0) + p.amount);
  return [...m.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

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
  const [settling, setSettling] = useState(false);
  const [review, setReview] = useState<SettleResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [snapshot, setSnapshot] = useState<Reward[] | null>(null);

  async function runReview() {
    setSettling(true);
    setReview(null);
    try {
      setReview(await computeSettlement());
    } catch (e) {
      setBanner("Lỗi: " + (e as Error).message);
    }
    setSettling(false);
  }

  async function confirmSettle() {
    if (!review) return;
    setApplying(true);
    try {
      const prev = await snapshotRewards(); // keep for Undo
      await applySettlement(review.payouts);
      setSnapshot(prev);
      setBanner(
        `✅ Đã chia ${formatVND(review.totalPaid)} cho ${perPerson(review).length} người.`
      );
      setReview(null);
      refresh();
    } catch (e) {
      setBanner("Lỗi: " + (e as Error).message);
    }
    setApplying(false);
  }

  async function undo() {
    if (!snapshot) return;
    setApplying(true);
    try {
      await restoreRewards(snapshot);
      setSnapshot(null);
      setBanner("↩ Đã hoàn tác lần chia gần nhất.");
      refresh();
    } catch (e) {
      setBanner("Lỗi: " + (e as Error).message);
    }
    setApplying(false);
  }

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
          Nhập tỉ số từng trận, rồi bấm “Tính lại quỹ” để chia tiền theo ngày.
        </p>
      </div>

      {banner && (
        <div className="card border-grass/40 text-sm text-grass">{banner}</div>
      )}

      <div className="space-y-3">
        <button
          className="btn w-full"
          onClick={runReview}
          disabled={settling || applying}
        >
          {settling ? "Đang tính…" : "💰 Tính lại quỹ (xem trước)"}
        </button>

        {review && (
          <div className="card space-y-3 border-grass/40">
            <p className="font-bold">Xem trước kết quả chia</p>
            <p className="text-xs text-white/50">
              {review.settledDays} ngày đã chốt · {review.pending.length} ngày treo
              · tổng chia {formatVND(review.totalPaid)}
            </p>
            {perPerson(review).length === 0 ? (
              <p className="text-sm text-white/60">Chưa ai trúng — không chia gì.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {perPerson(review).map((p) => (
                  <li key={p.name} className="flex justify-between py-1.5 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="font-bold text-neon">{formatVND(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {review.pending.length > 0 && (
              <p className="text-xs text-white/40">
                Quỹ treo:{" "}
                {review.pending
                  .map((d) => `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`)
                  .join(", ")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="btn flex-1"
                onClick={confirmSettle}
                disabled={applying}
              >
                {applying ? "Đang chia…" : "Xác nhận chia"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setReview(null)}
                disabled={applying}
              >
                Huỷ
              </button>
            </div>
          </div>
        )}

        {snapshot && (
          <button
            className="btn-ghost w-full text-amber-300"
            onClick={undo}
            disabled={applying}
          >
            ↩ Hoàn tác lần chia gần nhất
          </button>
        )}
      </div>

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

  async function saveFinalScore() {
    if (home === "" || away === "") {
      onChanged("Hãy nhập đủ hai tỉ số.");
      return;
    }
    setBusy(true);
    try {
      await saveScore(match.id, Number(home), Number(away));
      onChanged(
        `✅ Đã lưu: ${match.team1} ${home}–${away} ${match.team2}. Bấm “Tính lại quỹ” để chia tiền.`
      );
    } catch (e) {
      onChanged("Lỗi: " + (e as Error).message);
    }
    setBusy(false);
  }

  async function remove() {
    if (
      !confirm(
        `Xóa trận ${match.team1} - ${match.team2}? Toàn bộ lượt đoán của trận cũng bị xóa.`
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
        <span className="text-xs text-white/40">{count} lượt đoán</span>
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
          <button
            className="btn-ghost ml-auto whitespace-nowrap"
            onClick={saveFinalScore}
            disabled={busy}
          >
            {busy ? "…" : "Lưu tỉ số"}
          </button>
        </div>
        {match.status === "finished" && (
          <p className="mt-2 text-xs text-white/40">
            Đã ghi: {match.team1} {match.home_score}–{match.away_score} {match.team2}.
          </p>
        )}
      </div>

      {/* Edit individual predictions */}
      <MatchPredictions matchId={match.id} onChanged={onChanged} />
    </div>
  );
}

function MatchPredictions({
  matchId,
  onChanged,
}: {
  matchId: string;
  onChanged: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preds, setPreds] = useState<Prediction[] | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && preds === null) setPreds(await getMatchPredictions(matchId));
  }

  async function reload() {
    setPreds(await getMatchPredictions(matchId));
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <button
        onClick={toggle}
        className="text-sm font-semibold text-white/70 hover:text-white"
      >
        {open ? "▾" : "▸"} Sửa lượt đoán
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {preds === null ? (
            <p className="text-xs text-white/40">Đang tải…</p>
          ) : preds.length === 0 ? (
            <p className="text-xs text-white/40">Chưa có ai đoán trận này.</p>
          ) : (
            preds.map((p) => (
              <PredictionRow
                key={p.id}
                pred={p}
                onSaved={onChanged}
                onDeleted={async (text) => {
                  onChanged(text);
                  await reload();
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PredictionRow({
  pred,
  onSaved,
  onDeleted,
}: {
  pred: Prediction;
  onSaved: (text: string) => void;
  onDeleted: (text: string) => void | Promise<void>;
}) {
  const [h, setH] = useState(String(pred.predicted_home));
  const [a, setA] = useState(String(pred.predicted_away));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (h === "" || a === "") return;
    setBusy(true);
    try {
      await updatePrediction(pred.id, Number(h), Number(a));
      onSaved(`✅ Đã sửa lượt đoán của ${pred.player_name}.`);
    } catch (e) {
      onSaved("Lỗi: " + (e as Error).message);
    }
    setBusy(false);
  }

  async function del() {
    if (!confirm(`Xóa lượt đoán của ${pred.player_name}?`)) return;
    setBusy(true);
    try {
      await deletePrediction(pred.id);
      await onDeleted(`🗑 Đã xóa lượt đoán của ${pred.player_name}.`);
    } catch (e) {
      onSaved("Lỗi: " + (e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {pred.player_name}
      </span>
      <input
        type="number"
        min={0}
        className="input !w-14 shrink-0 px-1 text-center"
        value={h}
        onChange={(e) => setH(e.target.value)}
      />
      <span className="text-white/40">:</span>
      <input
        type="number"
        min={0}
        className="input !w-14 shrink-0 px-1 text-center"
        value={a}
        onChange={(e) => setA(e.target.value)}
      />
      <button
        className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
        onClick={save}
        disabled={busy}
      >
        Lưu
      </button>
      <button
        className="shrink-0 px-1 text-lg text-red-300 hover:text-red-200 disabled:opacity-40"
        onClick={del}
        disabled={busy}
        title="Xóa"
      >
        ✕
      </button>
    </div>
  );
}

// ISO → value for <input type="datetime-local"> in local time.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
