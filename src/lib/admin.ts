import { supabase } from "./supabase";
import type { Match, Prediction, Reward } from "./types";
import { dayKey, activeDay } from "./day";

const STAKE = 20000;

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
  payouts: { player_name: string; pay_date: string; amount: number }[];
  pending: { date: string; pot: number }[];
  // New days settled in THIS settlement.
  paidDates: string[];
  // Payout split: winners (đoán trúng tỉ số) + leftover kept as treo (carried).
  breakdown: {
    fund: number; // total settled fund
    winTotal: number; // paid to winners
    carried: number; // leftover kept as quỹ treo for the next settlement
    winners: { name: string; correct: number; amount: number }[];
  };
  // The carried treo as a fund-by-day entry (date + amount + participants).
  carriedTreo: { date: string; amount: number; participants: string[] } | null;
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
}> {
  const { data: rewards } = await supabase
    .from("rewards")
    .select("pay_date, amount");
  const R = (rewards as { pay_date: string | null; amount: number }[]) ?? [];
  const dates = R.map((r) => r.pay_date).filter((d): d is string => !!d);
  const watermark = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "";
  const paidTotal = R.reduce((s, r) => s + Number(r.amount), 0);

  const byId = new Map(matches.map((m) => [m.id, m]));
  const carrySlots = new Map<string, number>();
  let settledFund = 0;
  if (watermark) {
    for (const p of preds) {
      const m = byId.get(p.match_id);
      if (m && dayKey(m.kickoff_time) <= watermark) {
        carrySlots.set(p.player_name, (carrySlots.get(p.player_name) ?? 0) + 1);
        settledFund += STAKE;
      }
    }
  }
  return { watermark, carryAmount: Math.max(0, settledFund - paidTotal), carrySlots };
}

// INCREMENTAL day-based settlement (no DB writes — applySettlement persists).
//  - Each prediction = 1 slot (20k). A day's pot = its slots × 20k.
//  - Only days AFTER the last chốt'd day (watermark) are settled; the carried
//    treo (leftover money + slots, NOT win history) seeds the pool, so already
//    settled money isn't re-added and old correct scores aren't re-counted.
//  - No-winner new days accumulate (treo) into the pool. At a winning day,
//    winners take min(fund, …) via max-claim × win-ratio (see settlePool); the
//    leftover carries forward. Trailing no-winner days + leftover stay treo.
export async function computeSettlement(): Promise<SettleResult> {
  const [{ data: matchesData }, { data: predsData }] = await Promise.all([
    supabase.from("matches").select("*"),
    supabase.from("predictions").select("*"),
  ]);
  const matches = (matchesData as Match[]) ?? [];
  const preds = (predsData as Prediction[]) ?? [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const { watermark, carryAmount, carrySlots } = await settlementState(
    matches,
    preds
  );

  // Predicted matches grouped by day — only days AFTER the watermark (the
  // already-settled days are skipped entirely).
  const predictedIds = new Set(preds.map((p) => p.match_id));
  const matchesByDay = new Map<string, Match[]>();
  for (const m of matches) {
    if (!predictedIds.has(m.id)) continue;
    const d = dayKey(m.kickoff_time);
    if (watermark && d <= watermark) continue; // already chốt'd
    if (!matchesByDay.has(d)) matchesByDay.set(d, []);
    matchesByDay.get(d)!.push(m);
  }

  type DayInfo = {
    date: string;
    finished: boolean;
    totalSlots: number;
    slots: Map<string, number>; // name -> slots placed that day
    correct: Map<string, number>; // name -> correct slots that day
    carryFund?: number; // for a synthetic "carried treo" day: its fund = leftover
  };

  const infos: DayInfo[] = [...matchesByDay.keys()].sort().map((d) => {
    const dms = matchesByDay.get(d)!;
    const ids = new Set(dms.map((m) => m.id));
    const finished = dms.every(
      (m) => m.status === "finished" && m.home_score != null && m.away_score != null
    );
    const slots = new Map<string, number>();
    const correct = new Map<string, number>();
    let totalSlots = 0;
    for (const p of preds) {
      if (!ids.has(p.match_id)) continue;
      totalSlots++;
      slots.set(p.player_name, (slots.get(p.player_name) ?? 0) + 1);
      const m = matchById.get(p.match_id)!;
      if (
        m.status === "finished" &&
        p.predicted_home === m.home_score &&
        p.predicted_away === m.away_score
      ) {
        correct.set(p.player_name, (correct.get(p.player_name) ?? 0) + 1);
      }
    }
    return { date: d, finished, totalSlots, slots, correct };
  });

  const pay = new Map<string, number>(); // "name|date" -> amount
  const addPay = (name: string, date: string, amount: number) =>
    pay.set(name + "|" + date, (pay.get(name + "|" + date) ?? 0) + amount);

  // Win breakdown (for the admin congrats + Tổng kết history).
  const winBy = new Map<string, number>();
  const correctBy = new Map<string, number>();

  const fundOf = (d: DayInfo) => d.carryFund ?? d.totalSlots * STAKE;

  // Settle one pool (carried treo + no-winner days + the winning day):
  //  - win-ratio[w] = w's correct scores / total correct scores (winning day),
  //  - max-claim[w] = Σ over pool days (w's slots × players that day × stake),
  //  - tentative[w] = max-claim[w] × win-ratio[w],
  //  - if Σ tentative > fund, scale everyone down by fund / Σ tentative,
  //  - the leftover (fund − paid) is NOT refunded — it's returned to be carried
  //    forward (treo) into the next pool and settled by the same formula.
  const settlePool = (poolDays: DayInfo[], winDay: DayInfo): number => {
    const totalFund = poolDays.reduce((s, d) => s + fundOf(d), 0);

    const maxClaim = new Map<string, number>();
    for (const d of poolDays) {
      const numPlayers = d.slots.size; // distinct players that day
      for (const [name, sl] of d.slots)
        maxClaim.set(name, (maxClaim.get(name) ?? 0) + sl * numPlayers * STAKE);
    }

    // Winners + win-ratio from the winning day's correct scores only.
    const winners = [...winDay.correct.entries()].filter(([, c]) => c > 0);
    const totalWin = winners.reduce((s, [, c]) => s + c, 0);

    // Tentative = each winner's own max-claim × their win-ratio.
    const tentative = new Map<string, number>();
    let sumTentative = 0;
    for (const [name, c] of winners) {
      const t = (maxClaim.get(name) ?? 0) * (c / totalWin);
      tentative.set(name, t);
      sumTentative += t;
    }

    // Scale down only if the winners' tentative total exceeds the fund.
    const scale =
      sumTentative > totalFund && sumTentative > 0 ? totalFund / sumTentative : 1;

    let paidWinners = 0;
    for (const [name, c] of winners) {
      const w = (tentative.get(name) ?? 0) * scale;
      addPay(name, winDay.date, w);
      winBy.set(name, (winBy.get(name) ?? 0) + w);
      correctBy.set(name, (correctBy.get(name) ?? 0) + c);
      paidWinners += w;
    }

    return Math.max(0, totalFund - paidWinners); // leftover → carried (treo)
  };

  // A carried treo day: its fund = leftover, but it keeps the pool's per-person
  // slots + player count so the next settlement's max-claim formula still works.
  const makeCarry = (poolDays: DayInfo[], date: string, leftover: number): DayInfo => {
    const slots = new Map<string, number>();
    for (const d of poolDays)
      for (const [name, sl] of d.slots)
        slots.set(name, (slots.get(name) ?? 0) + sl);
    const totalSlots = [...slots.values()].reduce((a, b) => a + b, 0);
    return { date, finished: true, totalSlots, slots, correct: new Map(), carryFund: leftover };
  };

  // Seed the pool with the carried treo from previous settlements (its fund is
  // the leftover money; it keeps slots for max-claim but no correct scores).
  const carryStart: DayInfo | null =
    carryAmount > 0
      ? {
          date: watermark,
          finished: true,
          totalSlots: [...carrySlots.values()].reduce((a, b) => a + b, 0),
          slots: carrySlots,
          correct: new Map(),
          carryFund: carryAmount,
        }
      : null;

  let pool: DayInfo[] = carryStart ? [carryStart] : [];
  const paidReal = new Set<string>(); // NEW real days whose pot has been settled
  let settledFund = 0; // NEW real money that entered settled pools this period

  for (const info of infos) {
    if (!info.finished) break; // chronological — wait for the day's results
    pool.push(info);
    const hasWinner = [...info.correct.values()].some((c) => c > 0);
    if (!hasWinner) continue; // keep accumulating to the next day
    const leftover = settlePool(pool, info);
    for (const d of pool) {
      if (d.carryFund !== undefined) continue; // skip the synthetic carry day
      paidReal.add(d.date);
      settledFund += d.totalSlots * STAKE;
    }
    // Carry the leftover forward (treo) instead of refunding it.
    pool = leftover > 0 ? [makeCarry(pool, info.date, leftover)] : [];
  }

  // What's left after the last winning day: real no-winner days (shown per-day)
  // + any carried treo amount (kept in the fund for the next settlement).
  const pendingReal = pool.filter((d) => d.carryFund === undefined);
  const carryDay = pool.find((d) => d.carryFund !== undefined);
  const carried = carryDay?.carryFund ?? 0;
  // The carried treo as a fund-by-day entry: dated at the settlement day, with
  // the participants from the just-settled period.
  const carriedTreo = carryDay
    ? {
        date: carryDay.date,
        amount: Math.round(carryDay.carryFund ?? 0),
        participants: [...carryDay.slots.keys()],
      }
    : null;

  const payouts = [...pay.entries()].map(([k, amount]) => {
    const [player_name, pay_date] = k.split("|");
    return { player_name, pay_date, amount: Math.round(amount) };
  });

  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
  const pendingOut = pendingReal.map((e) => ({
    date: e.date,
    pot: e.totalSlots * STAKE,
  }));

  const paidDates = [...paidReal];
  const settledDays = paidDates.length;

  // Win breakdown + carried treo. Fund for THIS settlement = carried leftover
  // from before + the new days' money settled now (never re-adds old days).
  const round = (n: number) => Math.round(n);
  const winTotal = round([...winBy.values()].reduce((s, v) => s + v, 0));
  const breakdown = {
    fund: round(carryAmount + settledFund),
    winTotal,
    carried: round(carried),
    winners: [...winBy.entries()]
      .map(([name, amount]) => ({
        name,
        correct: correctBy.get(name) ?? 0,
        amount: round(amount),
      }))
      .sort((a, b) => b.amount - a.amount),
  };

  return {
    settledDays,
    totalPaid,
    payouts,
    pending: pendingOut,
    paidDates,
    breakdown,
    carriedTreo,
  };
}

// Persist a settlement: APPEND this settlement's payouts to the rewards table
// (incremental — previous payouts stay).
export async function applySettlement(
  payouts: SettleResult["payouts"]
): Promise<void> {
  if (payouts.length > 0) {
    await supabase
      .from("rewards")
      .insert(payouts.map((p) => ({ ...p, match_id: null })));
  }
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

// Log a settlement event (cumulative net snapshot + the rewards snapshot taken
// before this settlement, for revert). Skips if the net is unchanged.
export async function logSettlement(prevRewards: Reward[]): Promise<void> {
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
    .insert({ cum, prev_rewards: prevRewards });
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
