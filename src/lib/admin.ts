import { supabase } from "./supabase";
import type { Match, Prediction, Reward } from "./types";
import { dayKey, activeDay } from "./day";

const DEFAULT_STAKE = 20000;

// Price per prediction (slot), admin-configurable via the settings table.
// Defaults to 20.000đ when unset. Functions doing money math fetch this.
export async function getStake(): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "stake")
    .maybeSingle();
  const v = Number((data as { value: string } | null)?.value);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_STAKE;
}

export async function setStake(value: number): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "stake", value: String(Math.round(value)) });
  if (error) throw error;
}

// Save a match's final score (marks it finished). No payout here — settlement
// is day-based via settleAll().
export async function saveScore(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ home_score: homeScore, away_score: awayScore, status: "finished" })
    .eq("id", matchId);
  if (error) throw error;
}

export type SettleResult = {
  settledDays: number;
  totalPaid: number;
  payouts: {
    player_name: string;
    pay_date: string;
    amount: number;
    match_id?: string | null;
  }[];
  pending: { date: string; pot: number }[];
  // New days settled in THIS settlement.
  paidDates: string[];
  // Payout split: winners (đoán trúng tỉ số) + leftover kept as treo (carried).
  breakdown: {
    fund: number; // total settled fund (leftover + new days)
    winTotal: number; // paid to winners
    carried: number; // leftover kept as quỹ treo for the next settlement
    totalCorrect: number; // total correct scores among winners
    scaled: boolean; // winners' tentative total exceeded the fund → scaled down
    winners: {
      name: string;
      correct: number;
      maxClaim: number; // their max-claim cap
      amount: number;
      // Per-source breakdown: how the payout was made up.
      days: {
        kind: "win" | "treo" | "other";
        date: string;
        slots: number;
        players: number;
        correct: number;
        totalWin: number;
        amount: number;
        label?: string; // matchup, e.g. "Brazil–Haiti" (for win / treo lines)
      }[];
    }[];
  };
  // The carried treo as a fund-by-day entry (date + amount + participants).
  carriedTreo: { date: string; amount: number; participants: string[] } | null;
  // Each no-winner match still in treo (listed individually, newest day last).
  treoMatches?: {
    date: string;
    team1: string | null;
    team2: string | null;
    pot: number;
    participants: string[];
  }[];
  // Matches whose money has left the in-play pool (won+paid, or no-winner ones
  // already absorbed by a settled win) — displays hide these.
  hiddenMatchIds?: string[];
};

// What's already been settled, derived from the rewards table:
//  - watermark = the latest pay_date (days with dayKey ≤ it are already chốt'd),
//  - carry = the leftover treo still in the pot = stakes on settled days minus
//    everything paid. It carries only SLOTS forward (max-claim capacity), never
//    the previous correct-score history.
export async function settlementState(
  matches: Match[],
  preds: Prediction[]
): Promise<{
  watermark: string;
  carryAmount: number;
  carrySlots: Map<string, number>;
  paidPlayers: Set<string>;
}> {
  const STAKE = await getStake();
  // Only LEGACY rewards (the old day-based settlements) seed this boundary —
  // per-match settlements (match_id set) are handled by the per-match engine.
  const { data: rewards } = await supabase
    .from("rewards")
    .select("player_name, pay_date, amount")
    .is("match_id", null);
  const R =
    (rewards as { player_name: string; pay_date: string | null; amount: number }[]) ??
    [];
  const dates = R.map((r) => r.pay_date).filter((d): d is string => !!d);
  const watermark = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "";
  const paidTotal = R.reduce((s, r) => s + Number(r.amount), 0);
  // People who already won/got paid — their share of the leftover is gone, so
  // they (and their slots) drop out of the carried treo's capacity.
  const paidPlayers = new Set(R.map((r) => r.player_name));

  const byId = new Map(matches.map((m) => [m.id, m]));
  const carrySlots = new Map<string, number>();
  let settledFund = 0;
  if (watermark) {
    // Settled matches that already had a winner (someone nailed the exact
    // score): that match's pot was disbursed, so NONE of its slots carry into
    // the treo — only no-winner matches' money is still in the pot.
    const wonMatches = new Set<string>();
    for (const p of preds) {
      const m = byId.get(p.match_id);
      if (!m || dayKey(m.kickoff_time) > watermark) continue;
      if (
        m.home_score != null &&
        m.away_score != null &&
        p.predicted_home === m.home_score &&
        p.predicted_away === m.away_score
      )
        wonMatches.add(m.id);
    }
    for (const p of preds) {
      const m = byId.get(p.match_id);
      if (!m || dayKey(m.kickoff_time) > watermark) continue;
      settledFund += STAKE; // all settled stakes count toward the fund/leftover
      if (paidPlayers.has(p.player_name)) continue; // winners excluded from carry
      if (wonMatches.has(p.match_id)) continue; // won match: pot already paid out
      carrySlots.set(p.player_name, (carrySlots.get(p.player_name) ?? 0) + 1);
    }
  }
  const adjustTotal = await getAdjustTotal(); // manual withdrawals from the pool
  return {
    watermark,
    carryAmount: Math.max(0, settledFund - paidTotal - adjustTotal),
    carrySlots,
    paidPlayers,
  };
}

// Manual fund adjustments (admin "trích quỹ" / "sửa quỹ treo"). Each row is an
// amount taken OUT of the pool — given to a player (player_name set) or a
// general correction (player_name null). Kept separate from settlement rewards
// so it never affects the watermark / treo-capacity logic.
export async function getAdjustTotal(): Promise<number> {
  const { data } = await supabase.from("adjustments").select("amount");
  return ((data as { amount: number }[]) ?? []).reduce(
    (s, a) => s + Number(a.amount),
    0
  );
}

export async function getAdjustments(): Promise<
  { id: string; player_name: string | null; amount: number; note: string | null; created_at: string }[]
> {
  const { data } = await supabase
    .from("adjustments")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as any[]) ?? [];
}

// Give money from the pool to a person (records a withdrawal).
export async function addPayout(
  playerName: string,
  amount: number,
  note?: string
): Promise<void> {
  const { error } = await supabase.from("adjustments").insert({
    player_name: playerName,
    amount: Math.round(amount),
    note: note ?? "Trích quỹ",
  });
  if (error) throw error;
}

export async function deleteAdjustment(id: string): Promise<void> {
  const { error } = await supabase.from("adjustments").delete().eq("id", id);
  if (error) throw error;
}

// Current carried treo amount (after all finished matches, net of manual
// adjustments) — the full treo still in play, used by the adjustment UI.
export async function getCarry(): Promise<number> {
  const [{ breakdown }, adjust] = await Promise.all([
    computeSettlement(),
    getAdjustTotal(),
  ]);
  return Math.max(0, breakdown.carried - adjust);
}

// Set the treo total to a specific value (records a general correction).
export async function setTreoTotal(newTotal: number): Promise<void> {
  const current = await getCarry();
  const delta = Math.round(current - newTotal); // taken out of the pool
  if (delta === 0) return;
  const { error } = await supabase.from("adjustments").insert({
    player_name: null,
    amount: delta,
    note: "Sửa quỹ treo",
  });
  if (error) throw error;
}

// INCREMENTAL per-MATCH settlement (no DB writes — applySettlement persists).
//  - A match settles as soon as it finishes with a winner (no waiting for the
//    rest of the day). Its pot splits equally among those who nailed it.
//  - Treo is kept PER no-winner MATCH (its pot + who played it). When a later
//    match is won, each winner ALSO claims — from every treo match THEY played
//    — that match's pot (split among the winners who played it). No slots.
//  - LEGACY day-based settlements (rewards.match_id = null) stay frozen and seed
//    one legacy treo lump, claimed by winners who were in it.
// `overrides` / `extraPreds` are the admin "thử chốt sổ" simulator hooks.
export async function computeSettlement(
  overrides?: { match_id: string; home: number; away: number }[],
  extraPreds?: {
    player_name: string;
    match_id: string;
    predicted_home: number;
    predicted_away: number;
  }[]
): Promise<SettleResult> {
  const STAKE = await getStake();
  const [{ data: matchesData }, { data: predsData }, { data: rewardsData }] =
    await Promise.all([
      supabase.from("matches").select("*"),
      supabase.from("predictions").select("*"),
      supabase.from("rewards").select("match_id"),
    ]);
  let matches = (matchesData as Match[]) ?? [];
  const preds = (predsData as Prediction[]) ?? [];

  if (extraPreds && extraPreds.length) {
    extraPreds.forEach((e, i) =>
      preds.push({
        id: `sim-${i}`,
        player_name: e.player_name,
        match_id: e.match_id,
        predicted_home: e.predicted_home,
        predicted_away: e.predicted_away,
        created_at: new Date(0).toISOString(),
      } as Prediction)
    );
  }
  if (overrides && overrides.length) {
    const ov = new Map(overrides.map((o) => [o.match_id, o]));
    matches = matches.map((m) =>
      ov.has(m.id)
        ? {
            ...m,
            home_score: ov.get(m.id)!.home,
            away_score: ov.get(m.id)!.away,
            status: "finished",
          }
        : m
    );
  }

  const settledMatchIds = new Set(
    ((rewardsData as { match_id: string | null }[]) ?? [])
      .map((r) => r.match_id)
      .filter((x): x is string => !!x)
  );

  // Legacy boundary + its carried lump (old day-based settlements, frozen).
  const { watermark, carryAmount, carrySlots } = await settlementState(matches, preds);

  const predsByMatch = new Map<string, Prediction[]>();
  for (const p of preds) {
    const a = predsByMatch.get(p.match_id) ?? [];
    a.push(p);
    predsByMatch.set(p.match_id, a);
  }

  const future = matches
    .filter(
      (m) =>
        predsByMatch.has(m.id) && (!watermark || dayKey(m.kickoff_time) > watermark)
    )
    .sort((a, b) =>
      a.kickoff_time < b.kickoff_time
        ? -1
        : a.kickoff_time > b.kickoff_time
        ? 1
        : a.id < b.id
        ? -1
        : 1
    );

  // Treo kept per no-winner match: its pot + who played it.
  type Treo = {
    matchId: string;
    date: string;
    team1: string | null;
    team2: string | null;
    pot: number;
    players: Set<string>;
  };
  let treo: Treo[] = [];
  if (carryAmount > 0)
    treo.push({
      matchId: "__legacy__",
      date: watermark || "",
      team1: null,
      team2: null,
      pot: carryAmount,
      players: new Set(carrySlots.keys()),
    });

  type Line = SettleResult["breakdown"]["winners"][number]["days"][number];
  const winnerInfo = new Map<string, { amount: number; correct: number; lines: Line[] }>();
  const ensure = (name: string) => {
    let w = winnerInfo.get(name);
    if (!w) {
      w = { amount: 0, correct: 0, lines: [] };
      winnerInfo.set(name, w);
    }
    return w;
  };

  const round1k = (n: number) => Math.round(n / 1000) * 1000;
  // Simulator mode (the admin "thử chốt sổ" preview): hypothetical scores /
  // predictions are passed in. Skip not-yet-played matches instead of stopping,
  // so a single what-if match settles against the current treo.
  const sim = !!(overrides && overrides.length) || !!(extraPreds && extraPreds.length);
  const newPayouts: {
    match_id: string;
    player_name: string;
    pay_date: string;
    amount: number;
  }[] = [];
  const consumedMatchIds = new Set<string>(); // treo/won matches consumed by ALREADY-settled wins
  const paidDateSet = new Set<string>();

  for (const m of future) {
    if (!(m.status === "finished" && m.home_score != null && m.away_score != null)) {
      if (sim) continue; // skip unplayed matches in a what-if
      break; // real settle — chronological, wait for this match
    }
    const ps = predsByMatch.get(m.id) ?? [];
    if (ps.length === 0) continue;
    const pot = ps.length * STAKE;
    const d = dayKey(m.kickoff_time);
    const winners = ps
      .filter(
        (p) => p.predicted_home === m.home_score && p.predicted_away === m.away_score
      )
      .map((p) => p.player_name);

    if (winners.length === 0) {
      // No winner → this match's pot rolls forward as its own treo entry.
      treo.push({
        matchId: m.id,
        date: d,
        team1: m.team1,
        team2: m.team2,
        pot,
        players: new Set(ps.map((p) => p.player_name)),
      });
      continue;
    }

    const isSettled = settledMatchIds.has(m.id);
    const winShare = pot / winners.length;

    // Each winner claims, from every treo match they played, that match's pot
    // (split among the winners of THIS match who also played that treo match).
    const treoPay = new Map<string, { amount: number; lines: Line[] }>();
    const remaining: Treo[] = [];
    for (const T of treo) {
      const claimants = winners.filter((w) => T.players.has(w));
      if (claimants.length === 0) {
        remaining.push(T);
        continue;
      }
      if (isSettled) consumedMatchIds.add(T.matchId);
      const share = T.pot / claimants.length;
      for (const w of claimants) {
        const e = treoPay.get(w) ?? { amount: 0, lines: [] };
        e.amount += share;
        e.lines.push({
          kind: "treo",
          date: T.date,
          slots: 0,
          players: 0,
          correct: 0,
          totalWin: 0,
          amount: round1k(share),
          label: T.team1 && T.team2 ? `${T.team1}–${T.team2}` : "quỹ treo trước",
        });
        treoPay.set(w, e);
      }
    }
    treo = remaining;
    if (isSettled) consumedMatchIds.add(m.id);

    if (!isSettled) {
      for (const w of winners) {
        const tp = treoPay.get(w);
        const winLine = round1k(winShare);
        const treoAmt = tp ? round1k(tp.amount) : 0;
        const total = winLine + treoAmt;
        const info = ensure(w);
        info.amount += total;
        info.correct += 1;
        info.lines.push({
          kind: "win",
          date: d,
          slots: 0,
          players: 0,
          correct: 1,
          totalWin: winners.length,
          amount: winLine,
          label: `${m.team1}–${m.team2}`,
        });
        if (tp) for (const l of tp.lines) info.lines.push(l);
        newPayouts.push({ match_id: m.id, player_name: w, pay_date: d, amount: total });
        paidDateSet.add(d);
      }
    }
  }

  // Remaining treo, listed per match (legacy lump first if any).
  const treoMatches = treo.map((T) => ({
    date: T.date,
    team1: T.team1,
    team2: T.team2,
    pot: T.pot,
    participants: [...T.players],
  }));
  const carriedTreoAmount = treo.reduce((s, T) => s + T.pot, 0);
  const treoParticipants = [...new Set(treo.flatMap((T) => [...T.players]))];

  const names = [...winnerInfo.keys()];
  const winTotal = names.reduce((s, n) => s + winnerInfo.get(n)!.amount, 0);
  const totalCorrect = names.reduce((s, n) => s + winnerInfo.get(n)!.correct, 0);
  const newMatchCount = new Set(newPayouts.map((p) => p.match_id)).size;

  const breakdown = {
    fund: winTotal + carriedTreoAmount,
    winTotal,
    carried: carriedTreoAmount,
    totalCorrect,
    scaled: false,
    winners: names
      .map((name) => {
        const w = winnerInfo.get(name)!;
        return { name, correct: w.correct, maxClaim: 0, amount: w.amount, days: w.lines };
      })
      .sort((a, b) => b.amount - a.amount),
  };

  const carriedTreo =
    carriedTreoAmount > 0
      ? { date: watermark || "", amount: carriedTreoAmount, participants: treoParticipants }
      : null;

  return {
    settledDays: newMatchCount,
    totalPaid: newPayouts.reduce((s, p) => s + p.amount, 0),
    payouts: newPayouts,
    pending: [],
    paidDates: [...paidDateSet],
    breakdown,
    carriedTreo,
    treoMatches,
    hiddenMatchIds: [...settledMatchIds, ...consumedMatchIds],
  };
}

// Persist a settlement: APPEND this settlement's payouts to the rewards table
// (incremental — previous payouts stay).
export async function applySettlement(
  payouts: SettleResult["payouts"]
): Promise<void> {
  if (payouts.length > 0) {
    await supabase.from("rewards").insert(
      payouts.map((p) => ({
        player_name: p.player_name,
        pay_date: p.pay_date,
        amount: p.amount,
        match_id: p.match_id ?? null,
      }))
    );
  }
}

// Match ids whose money has left the in-play pool (settled wins + the no-winner
// matches those wins absorbed). Displays use this to hide them.
export async function getHiddenMatchIds(): Promise<Set<string>> {
  const { hiddenMatchIds } = await computeSettlement();
  return new Set(hiddenMatchIds ?? []);
}

const normNet = (arr: { name: string; value: number }[]) =>
  JSON.stringify(
    [...arr].map((x) => [x.name, Math.round(x.value)]).sort((a, b) =>
      String(a[0]).localeCompare(String(b[0]))
    )
  );

// Cumulative net per person from settled money: received (all rewards) − stake
// on settled days (≤ watermark). Used for the Tổng kết history snapshots.
async function cumulativeNet(): Promise<{ name: string; value: number }[]> {
  const STAKE = await getStake();
  const [{ data: m }, { data: p }, { data: r }] = await Promise.all([
    supabase.from("matches").select("id, kickoff_time"),
    supabase.from("predictions").select("player_name, match_id"),
    supabase.from("rewards").select("player_name, amount, pay_date"),
  ]);
  const M = (m as { id: string; kickoff_time: string }[]) ?? [];
  const P = (p as { player_name: string; match_id: string }[]) ?? [];
  const R = (r as { player_name: string; amount: number; pay_date: string | null }[]) ?? [];
  const dates = R.map((x) => x.pay_date).filter((d): d is string => !!d);
  const watermark = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "";
  const byId = new Map(M.map((x) => [x.id, x]));

  const received = new Map<string, number>();
  for (const x of R)
    received.set(x.player_name, (received.get(x.player_name) ?? 0) + Number(x.amount));
  const stake = new Map<string, number>();
  for (const x of P) {
    const mm = byId.get(x.match_id);
    if (mm && watermark && dayKey(mm.kickoff_time) <= watermark)
      stake.set(x.player_name, (stake.get(x.player_name) ?? 0) + STAKE);
  }
  const names = new Set([...received.keys(), ...stake.keys()]);
  return [...names].map((name) => ({
    name,
    value: Math.round((received.get(name) ?? 0) - (stake.get(name) ?? 0)),
  }));
}

// Log a settlement event: cumulative net snapshot, the rewards snapshot before
// this settlement (for revert), and the confirmed payout breakdown (for Tổng
// kết). Skips if the net is unchanged.
export async function logSettlement(
  prevRewards: Reward[],
  detail: SettleResult["breakdown"]
): Promise<void> {
  const cum = await cumulativeNet();
  const { data: last } = await supabase
    .from("settlements")
    .select("cum")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastCum =
    ((last?.cum as { name: string; value: number }[] | undefined) ?? []);
  if (normNet(lastCum) === normNet(cum)) return; // no change → no event
  await supabase
    .from("settlements")
    .insert({ cum, prev_rewards: prevRewards, detail });
}

// The most recent confirmed settlement's payout breakdown (for Tổng kết).
export async function getLastSettlementDetail(): Promise<
  SettleResult["breakdown"] | null
> {
  const { data } = await supabase
    .from("settlements")
    .select("detail")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.detail as SettleResult["breakdown"] | undefined) ?? null;
}

export async function deleteLastSettlement(): Promise<void> {
  const { data: last } = await supabase
    .from("settlements")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.id) await supabase.from("settlements").delete().eq("id", last.id);
}

// Whether there's a settlement that can be reverted.
export async function hasSettlement(): Promise<boolean> {
  const { count } = await supabase
    .from("settlements")
    .select("*", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

// Revert the most recent settlement: restore the rewards snapshot stored with
// it and delete the settlement event. Persistent — works after a refresh.
export async function revertLastSettlement(): Promise<boolean> {
  const { data: last } = await supabase
    .from("settlements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last?.id) return false;
  const prev = (last.prev_rewards as Reward[] | null) ?? [];
  await restoreRewards(prev);
  await supabase.from("settlements").delete().eq("id", last.id);
  return true;
}

// Snapshot current rewards (for Undo) and restore them.
export async function snapshotRewards(): Promise<Reward[]> {
  const { data } = await supabase.from("rewards").select("*");
  return (data as Reward[]) ?? [];
}

export async function restoreRewards(rows: Reward[]): Promise<void> {
  await supabase.from("rewards").delete().gte("amount", 0);
  if (rows.length > 0) {
    await supabase.from("rewards").insert(
      rows.map((r) => ({
        player_name: r.player_name,
        match_id: r.match_id,
        pay_date: r.pay_date,
        amount: r.amount,
      }))
    );
  }
}

// Upcoming matches for the admin "open for prediction" picker.
export async function getUpcomingMatches(): Promise<Match[]> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .gte("kickoff_time", new Date().toISOString())
    .order("kickoff_time", { ascending: true })
    .limit(40);
  return (data as Match[]) ?? [];
}

// Unfinished matches that already have predictions — the candidates the admin
// can assign hypothetical scores to in the "thử chốt sổ" simulator.
export async function getPendingScoreMatches(): Promise<Match[]> {
  const [{ data: m }, { data: p }] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .neq("status", "finished")
      .order("kickoff_time", { ascending: true }),
    supabase.from("predictions").select("match_id"),
  ]);
  const predicted = new Set(
    ((p as { match_id: string }[]) ?? []).map((x) => x.match_id)
  );
  return ((m as Match[]) ?? []).filter((x) => predicted.has(x.id));
}

// Remove a name from the roster (predictions already made keep their name).
export async function deletePlayer(name: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("name", name);
  if (error) throw error;
}

export async function setMatchOpen(matchId: string, open: boolean): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ is_open: open })
    .eq("id", matchId);
  if (error) throw error;
}

export async function getAllMatches(): Promise<Match[]> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_time", { ascending: true });
  return (data as Match[]) ?? [];
}

export async function getPredictionCount(matchId: string): Promise<number> {
  const { count } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId);
  return count ?? 0;
}

// All predictions joined with their match, for the admin manage list.
// Sorted by match kickoff time (ascending). Includes match status/score so the
// UI can lock finished matches, and an `active` day so it can surface the
// day currently in play first.
export async function getAllPredictionsDetailed(): Promise<{
  active: string;
  items: {
    id: string;
    player_name: string;
    match_id: string;
    team1: string;
    team2: string;
    predicted_home: number;
    predicted_away: number;
    kickoff_time: string;
    created_at: string;
    finished: boolean;
    home_score: number | null;
    away_score: number | null;
  }[];
}> {
  const [{ data: preds }, { data: matches }] = await Promise.all([
    supabase.from("predictions").select("*"),
    supabase.from("matches").select("*"),
  ]);
  const M = (matches as Match[]) ?? [];
  const P = (preds as Prediction[]) ?? [];
  const byId = new Map(M.map((m) => [m.id, m]));
  const active = activeDay(M, P);

  const items = P.map((p) => {
    const m = byId.get(p.match_id);
    return {
      id: p.id,
      player_name: p.player_name,
      match_id: p.match_id,
      team1: m?.team1 ?? "?",
      team2: m?.team2 ?? "?",
      predicted_home: p.predicted_home,
      predicted_away: p.predicted_away,
      kickoff_time: m?.kickoff_time ?? "",
      created_at: p.created_at,
      finished:
        m?.status === "finished" && m.home_score != null && m.away_score != null,
      home_score: m?.home_score ?? null,
      away_score: m?.away_score ?? null,
    };
  }).sort((a, b) =>
    a.kickoff_time < b.kickoff_time ? -1 : a.kickoff_time > b.kickoff_time ? 1 : 0
  );

  return { active, items };
}

export async function addPrediction(
  player: string,
  matchId: string,
  home: number,
  away: number
): Promise<void> {
  const { error } = await supabase.from("predictions").insert({
    player_name: player,
    match_id: matchId,
    predicted_home: home,
    predicted_away: away,
  });
  if (error) throw error;
}

export async function getMatchPredictions(matchId: string): Promise<Prediction[]> {
  const { data } = await supabase
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .order("player_name", { ascending: true });
  return (data as Prediction[]) ?? [];
}

export async function updatePrediction(
  id: string,
  home: number,
  away: number
): Promise<void> {
  const { error } = await supabase
    .from("predictions")
    .update({ predicted_home: home, predicted_away: away })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePrediction(id: string): Promise<void> {
  const { error } = await supabase.from("predictions").delete().eq("id", id);
  if (error) throw error;
}
