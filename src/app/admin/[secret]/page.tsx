"use client";

import { useEffect, useState } from "react";
import {
  computeSettlement,
  applySettlement,
  snapshotRewards,
  restoreRewards,
  getAllMatches,
  getAllPredictionsDetailed,
  addPrediction,
  updatePrediction,
  deletePrediction,
} from "@/lib/admin";
import type { SettleResult } from "@/lib/admin";
import {
  getJackpot,
  getCorrectPredictions,
  getFundByDay,
  getPlayers,
} from "@/lib/queries";
import type { Match, Reward } from "@/lib/types";
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

export default function AdminPage({ params }: { params: { secret: string } }) {
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
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [fundByDay, setFundByDay] = useState<
    Awaited<ReturnType<typeof getFundByDay>>
  >([]);
  const [correct, setCorrect] = useState<
    Awaited<ReturnType<typeof getCorrectPredictions>>
  >([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [review, setReview] = useState<SettleResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [snapshot, setSnapshot] = useState<Reward[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  async function refresh() {
    const [j, f, c] = await Promise.all([
      getJackpot(),
      getFundByDay(),
      getCorrectPredictions(),
    ]);
    setJackpot(j);
    setFundByDay(f);
    setCorrect(c);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function syncResults() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      const j = await res.json();
      setBanner(
        j.ok ? `✅ Đã cập nhật ${j.updated.length} trận từ FIFA.` : "Lỗi: " + (j.error ?? "")
      );
      if (j.ok) refresh();
    } catch {
      setBanner("Lỗi kết nối FIFA.");
    }
    setSyncing(false);
  }

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
      const prev = await snapshotRewards();
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

  const correctNames = [...new Set(correct.map((c) => c.player_name))];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚙️ Quản trị</h1>

      {banner && (
        <div className="card border-grass/40 text-sm text-grass">{banner}</div>
      )}

      {/* Current fund + per-day breakdown */}
      <section className="card text-center">
        <p className="text-sm uppercase tracking-widest text-white/50">
          Tổng quỹ hiện tại
        </p>
        <p className="mt-2 text-4xl font-extrabold text-neon">
          {jackpot === null ? "…" : formatVND(jackpot)}
        </p>
        <button
          className="btn-ghost mt-3 text-sm"
          onClick={syncResults}
          disabled={syncing}
        >
          {syncing ? "Đang cập nhật…" : "🔄 Cập nhật kết quả từ FIFA"}
        </button>

        {fundByDay.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-left text-sm">
            <p className="mb-1 text-xs uppercase tracking-wider text-white/40">
              Quỹ theo ngày
            </p>
            {fundByDay.map((d) => (
              <div key={d.date} className="flex items-baseline justify-between gap-2">
                <span className="text-white/70">
                  {d.date.slice(8, 10)}/{d.date.slice(5, 7)}{" "}
                  <span className="text-white/40">({d.participants.join(", ")})</span>
                </span>
                <span className="shrink-0 font-semibold">{formatVND(d.pot)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Correct predictors (most recent match first) */}
      <section className="card p-0 overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 font-bold">
          Người đoán đúng ({correct.length})
        </div>
        {correct.length === 0 ? (
          <p className="p-4 text-white/50">Chưa có ai đoán đúng.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {correct.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="font-semibold">🎯 {c.player_name}</p>
                  <p className="text-xs text-white/50">
                    {c.team1} {c.home_score}–{c.away_score} {c.team2}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-white/40">
                  {formatKickoff(c.kickoff_time)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Divide the fund */}
      <div className="space-y-3">
        {correctNames.length > 0 && (
          <p className="text-center text-sm font-semibold text-neon">
            🎉 Chúc mừng {correctNames.join(", ")} đã đoán trúng!
          </p>
        )}
        <button
          className="btn w-full"
          onClick={runReview}
          disabled={settling || applying || correct.length === 0}
        >
          {settling ? "Đang tính…" : "💰 Chia quỹ (xem trước)"}
        </button>
        {correct.length === 0 && (
          <p className="text-center text-xs text-white/40">
            Nút chia quỹ bật khi có người đoán trúng.
          </p>
        )}

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
              <button className="btn flex-1" onClick={confirmSettle} disabled={applying}>
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

      {/* Manage predictions */}
      <ManagePredictions
        key={reloadKey}
        onChanged={(text) => {
          setBanner(text);
          refresh();
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function ManagePredictions({ onChanged }: { onChanged: (text: string) => void }) {
  const [list, setList] = useState<
    Awaited<ReturnType<typeof getAllPredictionsDetailed>>
  >([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [name, setName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [l, p, m] = await Promise.all([
      getAllPredictionsDetailed(),
      getPlayers(),
      getAllMatches(),
    ]);
    setList(l);
    setPlayers(p);
    setMatches(m);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setMsg(null);
    if (!name || !matchId || home === "" || away === "") {
      setMsg("Điền đủ tên, trận và tỉ số.");
      return;
    }
    setBusy(true);
    try {
      await addPrediction(name, matchId, Number(home), Number(away));
      setHome("");
      setAway("");
      setMatchId("");
      setMsg("✅ Đã thêm.");
      await load();
    } catch (e) {
      const m = (e as { code?: string; message?: string }) ?? {};
      setMsg(
        m.code === "23505" || /duplicate|unique/i.test(m.message ?? "")
          ? "Người này đã đoán trận đó rồi."
          : "Lỗi: " + (m.message ?? "không rõ")
      );
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-bold">Quản lý lượt đoán</h2>

      {/* Add (shown last) */}
      <section className="order-2 card space-y-3">
        <p className="text-sm font-semibold text-white/70">Thêm lượt đoán</p>
        <select
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        >
          <option value="">Chọn tên…</option>
          {players.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
        >
          <option value="">Chọn trận…</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.team1} - {m.team2} — {formatKickoff(m.kickoff_time)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="input !w-16 px-1 text-center"
            placeholder="0"
            value={home}
            onChange={(e) => setHome(e.target.value)}
          />
          <span className="text-white/40">:</span>
          <input
            type="number"
            min={0}
            className="input !w-16 px-1 text-center"
            placeholder="0"
            value={away}
            onChange={(e) => setAway(e.target.value)}
          />
          <button className="btn ml-auto" onClick={add} disabled={busy}>
            Thêm
          </button>
        </div>
        {msg && <p className="text-xs text-white/60">{msg}</p>}
      </section>

      {/* List */}
      <section className="order-1 card p-0 overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 font-bold">
          Tất cả lượt đoán ({list.length})
        </div>
        {loading ? (
          <p className="p-4 text-white/40">Đang tải…</p>
        ) : list.length === 0 ? (
          <p className="p-4 text-white/50">Chưa có lượt đoán nào.</p>
        ) : (
          <ul className="divide-y divide-white/5 px-4">
            {list.map((p) => (
              <PredRow
                key={p.id}
                item={p}
                onSaved={onChanged}
                onDeleted={async (text) => {
                  onChanged(text);
                  await load();
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PredRow({
  item,
  onSaved,
  onDeleted,
}: {
  item: Awaited<ReturnType<typeof getAllPredictionsDetailed>>[number];
  onSaved: (text: string) => void;
  onDeleted: (text: string) => void | Promise<void>;
}) {
  const [h, setH] = useState(String(item.predicted_home));
  const [a, setA] = useState(String(item.predicted_away));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (h === "" || a === "") return;
    setBusy(true);
    try {
      await updatePrediction(item.id, Number(h), Number(a));
      onSaved(`✅ Đã sửa lượt đoán của ${item.player_name}.`);
    } catch (e) {
      onSaved("Lỗi: " + (e as Error).message);
    }
    setBusy(false);
  }

  async function del() {
    if (!confirm(`Xoá lượt đoán của ${item.player_name} (${item.team1} - ${item.team2})?`))
      return;
    setBusy(true);
    try {
      await deletePrediction(item.id);
      await onDeleted(`🗑 Đã xoá lượt đoán của ${item.player_name}.`);
    } catch (e) {
      onSaved("Lỗi: " + (e as Error).message);
    }
    setBusy(false);
  }

  return (
    <li className="flex items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.player_name}</p>
        <p className="truncate text-xs text-white/50">
          {item.team1} - {item.team2}
        </p>
      </div>
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
      <button className="btn-ghost shrink-0 px-3 py-1.5 text-xs" onClick={save} disabled={busy}>
        Lưu
      </button>
      <button
        className="shrink-0 px-1 text-lg text-red-300 hover:text-red-200 disabled:opacity-40"
        onClick={del}
        disabled={busy}
        title="Xoá"
      >
        ✕
      </button>
    </li>
  );
}
