"use client";

import { useEffect, useState } from "react";
import {
  computeSettlement,
  applySettlement,
  logSettlement,
  snapshotRewards,
  hasSettlement,
  revertLastSettlement,
  getAllPredictionsDetailed,
  updatePrediction,
  deletePrediction,
  getUpcomingMatches,
  setMatchOpen,
} from "@/lib/admin";
import type { SettleResult } from "@/lib/admin";
import { getJackpot, getFundByDay } from "@/lib/queries";
import type { Match } from "@/lib/types";
import { formatKickoff, formatShort, formatVND } from "@/lib/format";
import { dayKey, dayLabel } from "@/lib/day";

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
  const [banner, setBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [review, setReview] = useState<SettleResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [canRevert, setCanRevert] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<SettleResult | null>(null);

  async function refresh() {
    const [j, f, pv, rev] = await Promise.all([
      getJackpot(),
      getFundByDay(),
      computeSettlement(),
      hasSettlement(),
    ]);
    setJackpot(j);
    setFundByDay(f);
    setPreview(pv);
    setCanRevert(rev);
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
      const prev = await snapshotRewards(); // state before this settlement
      await applySettlement(review.payouts);
      await logSettlement(prev, review.breakdown);
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

  async function revert() {
    if (!confirm("Hoàn tác lần chốt sổ gần nhất? Quỹ sẽ quay lại như trước khi chốt."))
      return;
    setApplying(true);
    try {
      const ok = await revertLastSettlement();
      setBanner(
        ok
          ? "↩ Đã hoàn tác lần chốt sổ gần nhất."
          : "Không có lần chốt sổ nào để hoàn tác."
      );
      refresh();
    } catch (e) {
      setBanner("Lỗi: " + (e as Error).message);
    }
    setApplying(false);
  }

  // Settle-able = someone đoán trúng a NEW score (computeSettlement is
  // incremental, so it only surfaces winners that haven't been chốt'd yet).
  const canSettle = !!preview && preview.breakdown.winners.length > 0;
  const settleWinners = preview
    ? preview.breakdown.winners.map((w) => w.name)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚙️ Quản trị</h1>

      {banner && (
        <div className="card border-grass/40 text-sm text-grass">{banner}</div>
      )}

      {/* Settle the fund — top priority */}
      <div className="space-y-3">
        {canSettle && (
          <p className="text-center text-sm font-semibold text-neon">
            🎉 Chúc mừng {settleWinners.join(", ")} đã đoán trúng!
          </p>
        )}
        <button
          className="btn w-full"
          onClick={runReview}
          disabled={settling || applying || !canSettle}
        >
          {settling ? "Đang tính…" : "📒 Chốt sổ nào"}
        </button>
        {!canSettle && (
          <p className="text-center text-xs text-white/40">
            Nút chốt sổ bật khi có người đoán trúng tỉ số mới (chưa chốt).
          </p>
        )}

        {review && (
          <div className="card space-y-3 border-grass/40">
            <p className="font-bold">Xem trước kết quả chia</p>
            <p className="text-xs text-white/50">
              Quỹ {formatVND(review.breakdown.fund)} → thưởng{" "}
              <b className="text-neon">{formatVND(review.breakdown.winTotal)}</b> cho
              người trúng
              {review.breakdown.carried > 0 && (
                <>
                  , còn <b>{formatVND(review.breakdown.carried)}</b> giữ làm quỹ treo
                  cho đợt sau
                </>
              )}
              .
            </p>

            {review.breakdown.winners.length === 0 ? (
              <p className="text-sm text-white/60">Chưa ai trúng — không chia gì.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  🎯 Người trúng tỉ số — vì sao chia vậy?
                </p>
                <ul className="space-y-2">
                  {review.breakdown.winners.map((w) => {
                    const pct = Math.round(
                      (w.correct / (review.breakdown.totalCorrect || 1)) * 100
                    );
                    return (
                      <li key={w.name} className="rounded-lg bg-black/20 p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>
                            <b>{w.name}</b>{" "}
                            <span className="text-[11px] text-white/40">
                              trúng {w.correct}/{review.breakdown.totalCorrect} ·
                              tỉ lệ {pct}%
                            </span>
                          </span>
                          <span className="font-bold text-neon">
                            {formatVND(w.amount)}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5 text-[11px] text-white/50">
                          {w.days.map((d, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span>
                                {d.carry ? (
                                  <>
                                    🔁 Quỹ treo: {d.slots}/{d.players} slot ={" "}
                                    {formatVND(d.max)}
                                  </>
                                ) : (
                                  <>
                                    Ngày {dayLabel(d.date)}: {d.slots} slot ×{" "}
                                    {d.players} người = {formatVND(d.max)}
                                  </>
                                )}
                              </span>
                              <span className="shrink-0 text-white/70">
                                → {formatVND(d.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] leading-relaxed text-white/40">
                  Mỗi ngày: <b>slot × số người chơi × 20k = mức ăn tối đa</b>; nhân{" "}
                  <b>tỉ lệ tỉ số trúng</b>
                  {review.breakdown.scaled && (
                    <>
                      {" "}
                      rồi <b>giảm đều</b> (vì tổng vượt quỹ)
                    </>
                  )}{" "}
                  ra tiền thực nhận. Khác nhau do <b>số tỉ số trúng</b> và <b>mức ăn
                  tối đa</b> (chơi nhiều slot/ngày → trần cao hơn).
                </p>
              </div>
            )}

            {review.breakdown.carried > 0 && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                Người trúng không ôm hết quỹ — còn{" "}
                <b>{formatVND(review.breakdown.carried)}</b> giữ làm <b>quỹ treo</b>,
                sẽ cộng vào đợt tất toán sau (chia theo công thức bình thường).
              </p>
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

        {canRevert && (
          <button
            className="btn-ghost w-full text-amber-300"
            onClick={revert}
            disabled={applying}
          >
            ↩ Hoàn tác lần chốt sổ gần nhất
          </button>
        )}
      </div>

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
              <div
                key={d.date}
                className={`flex items-baseline justify-between gap-2 ${
                  d.counted ? "" : "opacity-40"
                }`}
              >
                <span className="text-white/70">
                  {d.date.slice(8, 10)}/{d.date.slice(5, 7)}{" "}
                  <span className="text-white/40">({d.participants.join(", ")})</span>
                  {!d.counted && <span className="text-white/30"> · chưa tính</span>}
                </span>
                <span className="shrink-0 font-semibold">{formatVND(d.pot)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pick matches open for prediction */}
      <OpenMatchesPicker onChanged={(text) => setBanner(text)} />

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

function OpenMatchesPicker({ onChanged }: { onChanged: (text: string) => void }) {
  const [list, setList] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);

  async function load() {
    setList(await getUpcomingMatches());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(m: Match) {
    setBusyId(m.id);
    try {
      await setMatchOpen(m.id, !m.is_open);
      await load();
      onChanged(
        !m.is_open
          ? `✅ Mở cho đoán: ${m.team1} - ${m.team2}`
          : `Đã đóng: ${m.team1} - ${m.team2}`
      );
    } catch (e) {
      onChanged("Lỗi: " + (e as Error).message);
    }
    setBusyId(null);
  }

  const openCount = list.filter((m) => m.is_open).length;

  // Next 3 days shown; later matches collapsed (keep any already-open ones up).
  const cutoff = Date.now() + 3 * 24 * 3600 * 1000;
  const soon = list.filter(
    (m) => new Date(m.kickoff_time).getTime() <= cutoff || m.is_open
  );
  const soonIds = new Set(soon.map((m) => m.id));
  const rest = list.filter((m) => !soonIds.has(m.id));

  const row = (m: Match) => (
    <li key={m.id} className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {m.team1} - {m.team2}
        </p>
        <p className="truncate text-xs text-white/40">
          {formatKickoff(m.kickoff_time)}
        </p>
      </div>
      <button
        onClick={() => toggle(m)}
        disabled={busyId === m.id}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
          m.is_open
            ? "bg-grass text-black"
            : "border border-white/15 text-white/60 hover:bg-white/10"
        }`}
      >
        {m.is_open ? "✓ Cho đoán" : "Đóng"}
      </button>
    </li>
  );

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-bold">Chọn trận cho đoán ({openCount} đang mở)</h2>
        <p className="text-xs text-white/40">
          Chỉ trận bật xanh mới hiện cho mọi người đoán. Mặc định chỉ hiện 3 ngày tới.
        </p>
      </div>
      {loading ? (
        <p className="text-white/40">Đang tải…</p>
      ) : list.length === 0 ? (
        <p className="text-white/50">Không có trận sắp tới.</p>
      ) : (
        <>
          <ul className="space-y-1.5">{soon.map(row)}</ul>
          {rest.length > 0 && (
            <div className="space-y-1.5">
              <button
                onClick={() => setShowRest((v) => !v)}
                className="text-sm font-semibold text-white/60 hover:text-white"
              >
                {showRest ? "▾" : "▸"} Trận xa hơn ({rest.length})
              </button>
              {showRest && <ul className="space-y-1.5">{rest.map(row)}</ul>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

type DetailItem = Awaited<
  ReturnType<typeof getAllPredictionsDetailed>
>["items"][number];

function ManagePredictions({ onChanged }: { onChanged: (text: string) => void }) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getAllPredictionsDetailed>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFinished, setShowFinished] = useState(false);

  async function load() {
    setData(await getAllPredictionsDetailed());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const items = data?.items ?? [];
  const active = data?.active ?? "";

  // Active-day predictions first, then other not-yet-played matches, then
  // finished matches (locked).
  const activeItems = items.filter(
    (p) => !p.finished && dayKey(p.kickoff_time) === active
  );
  const otherUpcoming = items.filter(
    (p) => !p.finished && dayKey(p.kickoff_time) !== active
  );
  const finishedItems = items.filter((p) => p.finished);

  const onDeleted = async (text: string) => {
    onChanged(text);
    await load();
  };

  const renderGroup = (title: string, list: DetailItem[], locked: boolean) =>
    list.length > 0 && (
      <>
        <li className="bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          {title} ({list.length})
        </li>
        {list.map((p) => (
          <PredRow
            key={p.id}
            item={p}
            locked={locked}
            onSaved={onChanged}
            onDeleted={onDeleted}
          />
        ))}
      </>
    );

  return (
    <div className="space-y-4">
      <h2 className="font-bold">Quản lý lượt đoán</h2>
      <section className="card p-0 overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 font-bold">
          Tất cả lượt đoán ({items.length})
        </div>
        {loading ? (
          <p className="p-4 text-white/40">Đang tải…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-white/50">Chưa có lượt đoán nào.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {renderGroup("⚡ Ngày đang diễn ra", activeItems, false)}
            {renderGroup("🕒 Trận sắp tới khác", otherUpcoming, false)}
            {finishedItems.length > 0 && (
              <>
                <li>
                  <button
                    onClick={() => setShowFinished((v) => !v)}
                    className="w-full bg-white/5 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40 hover:bg-white/10"
                  >
                    {showFinished ? "▾" : "▸"} ✅ Đã kết thúc ({finishedItems.length})
                  </button>
                </li>
                {showFinished &&
                  finishedItems.map((p) => (
                    <PredRow
                      key={p.id}
                      item={p}
                      locked
                      onSaved={onChanged}
                      onDeleted={onDeleted}
                    />
                  ))}
              </>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function PredRow({
  item,
  locked,
  onSaved,
  onDeleted,
}: {
  item: DetailItem;
  locked?: boolean;
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

  if (locked) {
    // Finished match → read-only, grayed, no edit/delete.
    return (
      <li className="flex items-center gap-2 px-4 py-2.5 opacity-45">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.player_name}</p>
          <p className="truncate text-xs text-white/50">
            {item.team1} - {item.team2}
          </p>
          <p className="truncate text-[10px] text-white/30">
            KQ: {item.home_score}–{item.away_score} · đoán{" "}
            {formatShort(item.created_at)}
          </p>
        </div>
        <span className="shrink-0 font-mono text-lg font-bold">
          {item.predicted_home}–{item.predicted_away}
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.player_name}</p>
        <p className="truncate text-xs text-white/50">
          {item.team1} - {item.team2}
        </p>
        <p className="truncate text-[10px] text-white/30">
          ⏱ {formatKickoff(item.kickoff_time)} · đoán {formatShort(item.created_at)}
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
