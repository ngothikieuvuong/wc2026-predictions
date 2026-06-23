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
  getSimMatches,
  deletePlayer,
  getStake,
  setStake,
  getCarry,
  addPayout,
  setTreoTotal,
  getAdjustments,
  deleteAdjustment,
} from "@/lib/admin";
import type { SettleResult } from "@/lib/admin";
import { getJackpot, getFundByDay, getPlayers, addPlayer } from "@/lib/queries";
import type { Match } from "@/lib/types";
import { formatKickoff, formatShort, formatVND } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
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

// Per-winner detail + formula (shared by the real preview and the simulator).
function BreakdownDetail({ b }: { b: SettleResult["breakdown"] }) {
  if (b.winners.length === 0)
    return <p className="text-sm text-white/60">Chưa ai trúng — không chia gì.</p>;
  return (
    <>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          🎯 Người trúng tỉ số — vì sao chia vậy?
        </p>
        <ul className="space-y-2">
          {b.winners.map((w) => {
            const pct = Math.round((w.correct / (b.totalCorrect || 1)) * 100);
            return (
              <li key={w.name} className="rounded-lg bg-black/20 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    <b>{w.name}</b>{" "}
                    <span className="text-[11px] text-white/40">
                      trúng {w.correct}/{b.totalCorrect} · tỉ lệ {pct}%
                    </span>
                  </span>
                  <span className="font-bold text-neon">{formatVND(w.amount)}</span>
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-white/50">
                  {w.days.map((d, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {d.kind === "treo" ? (
                          <>🔁 Treo {d.label} ({dayLabel(d.date)})</>
                        ) : (
                          <>🎯 {d.label ?? "Trúng tỉ số"}</>
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
          Mỗi <b>trận trúng</b>: quỹ trận đó chia đều cho người trúng trận đó.{" "}
          <b>Quỹ treo</b>: mỗi trận không ai trúng được giữ riêng, sau này chia cho
          người trúng <b>có chơi</b> trận treo đó.
        </p>
      </div>

      {b.carried > 0 && (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
          Người trúng không ôm hết quỹ — còn{" "}
          <b>{formatVND(b.carried)}</b> giữ làm <b>quỹ treo</b>, cộng vào đợt tất
          toán sau.
        </p>
      )}
    </>
  );
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
      <PageHeader title="⚙️ Quản trị" subtitle="Chốt sổ, quản lý quỹ, người chơi và lượt đoán." />

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

            <BreakdownDetail b={review.breakdown} />

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

      {/* Price per prediction */}
      <ManageStake onChanged={(text) => setBanner(text)} />

      {/* Withdraw fund / edit carried treo */}
      <ManageFund
        onChanged={(text) => {
          setBanner(text);
          refresh();
        }}
      />

      {/* Manage players */}
      <ManagePlayers onChanged={(text) => setBanner(text)} />

      {/* What-if settlement simulator */}
      <SettleSimulator />

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

// Set the price per prediction (default 20.000đ).
function ManageStake({ onChanged }: { onChanged: (t: string) => void }) {
  const [val, setVal] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStake().then((s) => {
      setCurrent(s);
      setVal(String(s));
    });
  }, []);

  async function save() {
    const n = Math.round(Number(val));
    if (!Number.isFinite(n) || n <= 0) {
      onChanged("Giá không hợp lệ.");
      return;
    }
    setBusy(true);
    try {
      await setStake(n);
      setCurrent(n);
      onChanged(`✅ Đã đặt giá ${formatVND(n)} / lượt đoán.`);
    } catch (e) {
      onChanged((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="card space-y-3">
      <p className="font-bold">💵 Giá mỗi lượt đoán</p>
      <p className="text-xs text-white/50">
        Hiện tại:{" "}
        <b className="text-white/80">
          {current === null ? "…" : formatVND(current)}
        </b>{" "}
        / 1 tỉ số. Đổi giá áp cho <b>toàn bộ</b> lượt đoán (kể cả đã đặt).
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          min={1000}
          step={1000}
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="input"
          placeholder="20000"
        />
        <button onClick={save} disabled={busy} className="btn">
          Lưu
        </button>
      </div>
    </section>
  );
}

// Trích quỹ cho 1 người + sửa tổng quỹ treo (manual fund adjustments).
function ManageFund({ onChanged }: { onChanged: (t: string) => void }) {
  const [treo, setTreo] = useState<number | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [adjustments, setAdjustments] = useState<
    Awaited<ReturnType<typeof getAdjustments>>
  >([]);
  const [busy, setBusy] = useState(false);

  // Give-to-person form.
  const [who, setWho] = useState("");
  const [giveAmt, setGiveAmt] = useState("");

  // Edit-treo form.
  const [treoVal, setTreoVal] = useState("");

  async function load() {
    const [c, p, a] = await Promise.all([
      getCarry(),
      getPlayers(),
      getAdjustments(),
    ]);
    setTreo(c);
    setTreoVal(String(Math.round(c)));
    setPlayers(p);
    setAdjustments(a);
  }
  useEffect(() => {
    load();
  }, []);

  async function give() {
    const amt = Math.round(Number(giveAmt));
    if (!who) return onChanged("Chọn người nhận đã.");
    if (!Number.isFinite(amt) || amt === 0) return onChanged("Số tiền không hợp lệ.");
    if (!window.confirm(`Trích ${formatVND(amt)} từ quỹ gửi cho ${who}?`)) return;
    setBusy(true);
    try {
      await addPayout(who, amt);
      onChanged(`✅ Đã trích ${formatVND(amt)} cho ${who}.`);
      setGiveAmt("");
      setWho("");
      await load();
    } catch (e) {
      onChanged((e as Error).message);
    }
    setBusy(false);
  }

  async function saveTreo() {
    const n = Math.round(Number(treoVal));
    if (!Number.isFinite(n) || n < 0) return onChanged("Số quỹ treo không hợp lệ.");
    if (treo !== null && n === Math.round(treo)) return;
    if (
      !window.confirm(
        `Đặt tổng quỹ treo thành ${formatVND(n)}? (hiện ${formatVND(treo ?? 0)})`
      )
    )
      return;
    setBusy(true);
    try {
      await setTreoTotal(n);
      onChanged(`✅ Đã đặt quỹ treo = ${formatVND(n)}.`);
      await load();
    } catch (e) {
      onChanged((e as Error).message);
    }
    setBusy(false);
  }

  async function undo(id: string) {
    if (!window.confirm("Hoàn tác điều chỉnh này? Tiền quay lại quỹ.")) return;
    setBusy(true);
    try {
      await deleteAdjustment(id);
      onChanged("↩ Đã hoàn tác điều chỉnh.");
      await load();
    } catch (e) {
      onChanged((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="card space-y-4">
      <div>
        <p className="font-bold">💸 Trích quỹ / sửa quỹ treo</p>
        <p className="text-xs text-white/50">
          Quỹ treo hiện tại:{" "}
          <b className="text-white/80">{treo === null ? "…" : formatVND(treo)}</b>
        </p>
      </div>

      {/* Give money from the fund to a person */}
      <div className="space-y-2 rounded-xl border border-white/10 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Trích quỹ gửi cho 1 người
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-base"
          >
            <option value="">Ai?</option>
            {players.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="number"
            step={1000}
            inputMode="numeric"
            value={giveAmt}
            onChange={(e) => setGiveAmt(e.target.value)}
            className="input flex-1"
            placeholder="Số tiền (vd 50000)"
          />
          <button onClick={give} disabled={busy} className="btn">
            Gửi
          </button>
        </div>
        <p className="text-[11px] text-white/40">
          Trừ vào quỹ và cộng cho người đó (hiện ở Tổng kết &amp; lịch sử của họ).
        </p>
      </div>

      {/* Set the carried treo to a specific number */}
      <div className="space-y-2 rounded-xl border border-white/10 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Sửa tổng quỹ treo
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step={1000}
            inputMode="numeric"
            value={treoVal}
            onChange={(e) => setTreoVal(e.target.value)}
            className="input flex-1"
            placeholder="0"
          />
          <button onClick={saveTreo} disabled={busy} className="btn">
            Lưu
          </button>
        </div>
        <p className="text-[11px] text-white/40">
          Đặt thẳng số quỹ treo (phần chênh được ghi nhận là điều chỉnh, có thể hoàn tác).
        </p>
      </div>

      {/* History of manual adjustments (undoable) */}
      {adjustments.length > 0 && (
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Điều chỉnh đã ghi
          </p>
          {adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-white/70">
                {a.player_name ? `→ ${a.player_name}` : a.note || "Điều chỉnh"}{" "}
                <span className="text-white/40">{formatShort(a.created_at)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <b className={Number(a.amount) >= 0 ? "text-amber-300" : "text-neon"}>
                  {formatVND(Number(a.amount))}
                </b>
                <button
                  onClick={() => undo(a.id)}
                  disabled={busy}
                  className="text-white/40 hover:text-red-400"
                  aria-label="Hoàn tác"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Add / remove players in the roster.
function ManagePlayers({ onChanged }: { onChanged: (t: string) => void }) {
  const [list, setList] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getPlayers().then(setList);
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await addPlayer(n);
      onChanged(`✅ Đã thêm ${n}`);
      setName("");
      await load();
    } catch (e) {
      onChanged((e as Error).message);
    }
    setBusy(false);
  }

  async function remove(n: string) {
    if (!window.confirm(`Xoá người chơi "${n}"?`)) return;
    setBusy(true);
    try {
      await deletePlayer(n);
      onChanged(`Đã xoá ${n}`);
      await load();
    } catch (e) {
      onChanged((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="card space-y-3">
      <p className="font-bold">👥 Người chơi ({list.length})</p>
      <div className="flex flex-wrap gap-2">
        {list.length === 0 ? (
          <span className="text-sm text-white/50">Chưa có người chơi.</span>
        ) : (
          list.map((n) => (
            <span
              key={n}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm"
            >
              {n}
              <button
                onClick={() => remove(n)}
                disabled={busy}
                className="text-white/40 transition hover:text-red-400"
                aria-label={`Xoá ${n}`}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Tên người chơi mới"
          className="input"
        />
        <button onClick={add} disabled={busy || !name.trim()} className="btn">
          + Thêm
        </button>
      </div>
    </section>
  );
}

// "What-if" settlement: admin types hypothetical scores for unplayed matches
// and previews how the pot would divide — no DB writes.
function NumStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-lg font-bold leading-none text-white/70 transition hover:bg-white/20 active:scale-95";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className={btn}
        aria-label="Giảm"
      >
        −
      </button>
      <span className="w-5 text-center font-mono text-base font-bold">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={btn}
        aria-label="Tăng"
      >
        +
      </button>
    </div>
  );
}

function SettleSimulator() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [matchId, setMatchId] = useState("");
  // Two independent what-if toggles.
  const [useScore, setUseScore] = useState(true);
  const [h, setH] = useState(0);
  const [a, setA] = useState(0);
  const [useExtra, setUseExtra] = useState(false);
  const [extra, setExtra] = useState<{ player: string; h: number; a: number }[]>([]);
  const [addPlayer, setAddPlayer] = useState("");
  const [addH, setAddH] = useState(0);
  const [addA, setAddA] = useState(0);
  const [result, setResult] = useState<SettleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && matches.length === 0) getSimMatches().then(setMatches);
    if (open && players.length === 0) getPlayers().then(setPlayers);
  }, [open, matches.length, players.length]);

  // Any change invalidates the shown result.
  useEffect(() => {
    setResult(null);
  }, [matchId, useScore, h, a, useExtra, extra]);

  // Default a newly-added prediction to the assumed final score, so the person
  // wins by default (the common what-if) — admin can still tweak it.
  useEffect(() => {
    setAddH(h);
    setAddA(a);
  }, [h, a, useExtra]);

  const selected = matches.find((m) => m.id === matchId);
  const finished = selected?.status === "finished";
  // Need a final score: for an unplayed match you must supply one (useScore).
  const needScore = !!selected && !finished && !useScore;
  const canRun =
    !!selected && (useScore || useExtra) && !needScore;

  async function run() {
    if (!matchId || !canRun) return;
    const overrides = useScore ? [{ match_id: matchId, home: h, away: a }] : [];
    // Include any person still selected in the add row but not yet "+ Thêm"'d.
    const list =
      useExtra && addPlayer && !extra.some((e) => e.player === addPlayer)
        ? [...extra, { player: addPlayer, h: addH, a: addA }]
        : extra;
    const extraPreds =
      useExtra && list.length
        ? list.map((e) => ({
            player_name: e.player,
            match_id: matchId,
            predicted_home: e.h,
            predicted_away: e.a,
          }))
        : [];
    setBusy(true);
    setResult(await computeSettlement(overrides, extraPreds));
    setBusy(false);
  }

  return (
    <section className="card space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-bold">🧮 Thử chốt sổ (giả định)</span>
        <span className="text-white/40">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <>
          <p className="text-xs text-white/50">
            Chọn 1 trận, rồi bật giả định: <b>tỉ số cuối</b>, <b>thêm lượt đoán</b>,
            hoặc cả hai — để xem ai trúng + chia quỹ thế nào. Không lưu gì cả.
          </p>

          {matches.length === 0 ? (
            <p className="text-sm text-white/50">Chưa có trận nào để thử.</p>
          ) : (
            <div className="space-y-3">
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="input"
              >
                <option value="">— Chọn trận —</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {dayLabel(dayKey(m.kickoff_time))} · {m.team1} – {m.team2}
                    {m.status === "finished"
                      ? ` (KQ ${m.home_score}–${m.away_score})`
                      : ""}
                  </option>
                ))}
              </select>

              {selected && (
                <>
                  {/* Option 1: hypothetical final score */}
                  <div className="space-y-2 rounded-xl border border-white/10 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={useScore}
                        onChange={(e) => setUseScore(e.target.checked)}
                        className="h-4 w-4 accent-grass"
                      />
                      Giả định tỉ số cuối trận
                    </label>
                    {useScore && (
                      <div className="flex items-center justify-center gap-3">
                        <NumStepper value={h} onChange={setH} />
                        <span className="text-white/40">:</span>
                        <NumStepper value={a} onChange={setA} />
                      </div>
                    )}
                    {needScore && (
                      <p className="text-[11px] text-amber-300">
                        Trận chưa đá — cần bật tỉ số cuối để tính.
                      </p>
                    )}
                  </div>

                  {/* Option 2: hypothetical extra predictions */}
                  <div className="space-y-2 rounded-xl border border-white/10 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={useExtra}
                        onChange={(e) => setUseExtra(e.target.checked)}
                        className="h-4 w-4 accent-grass"
                      />
                      Giả định thêm lượt đoán cho người
                    </label>
                    {useExtra && (
                      <>
                        <p className="text-[11px] text-white/40">
                          Nếu người đó đã đoán trận này rồi, tỉ số giả định sẽ{" "}
                          <b>thay</b> tỉ số cũ.
                        </p>
                        {extra.map((e, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span>
                              <b>{e.player}</b> ·{" "}
                              <span className="font-mono">
                                {e.h}–{e.a}
                              </span>
                            </span>
                            <button
                              onClick={() =>
                                setExtra((x) => x.filter((_, j) => j !== i))
                              }
                              className="text-white/40 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={addPlayer}
                            onChange={(e) => setAddPlayer(e.target.value)}
                            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                          >
                            <option value="">Ai?</option>
                            {players.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                          <NumStepper value={addH} onChange={setAddH} />
                          <span className="text-white/40">:</span>
                          <NumStepper value={addA} onChange={setAddA} />
                          <button
                            type="button"
                            disabled={!addPlayer}
                            onClick={() => {
                              setExtra((x) => [
                                ...x,
                                { player: addPlayer, h: addH, a: addA },
                              ]);
                              setAddPlayer("");
                              setAddH(0);
                              setAddA(0);
                            }}
                            className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                          >
                            + Thêm
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={run} disabled={busy || !canRun} className="btn flex-1">
                      {busy ? "Đang tính…" : "Tính thử"}
                    </button>
                    {(result || extra.length > 0) && (
                      <button
                        onClick={() => {
                          setResult(null);
                          setH(0);
                          setA(0);
                          setExtra([]);
                        }}
                        className="btn-ghost"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-xl border border-grass/30 bg-grass/5 p-3 text-sm">
              <p className="text-xs text-white/50">
                Nếu kết quả như trên: quỹ{" "}
                <b className="text-white/80">{formatVND(result.breakdown.fund)}</b> →
                thưởng{" "}
                <b className="text-neon">{formatVND(result.breakdown.winTotal)}</b>
                {result.breakdown.carried > 0 && (
                  <>
                    , treo lại <b>{formatVND(result.breakdown.carried)}</b>
                  </>
                )}
                .
              </p>
              <BreakdownDetail b={result.breakdown} />
              <p className="text-[11px] text-white/30">
                Chỉ là thử — chưa lưu, chưa chốt sổ thật.
              </p>
            </div>
          )}
        </>
      )}
    </section>
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
