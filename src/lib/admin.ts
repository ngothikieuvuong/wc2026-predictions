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
      }[];
    }[];
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
  paidPlayers: Set<string>;
}> {
  const { data: rewards } = await supabase
    .from("rewards")
    .select("player_name, pay_date, amount");
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
  return {
    watermark,
    carryAmount: Math.max(0, settledFund - paidTotal),
    carrySlots,
    paidPlayers,
  };
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

  // A day is split per MATCH into:
  //  - WON matches (someone nailed the score): their pot is disbursed to the
  //    day's winners by win-ratio (correct scores) — it never carries.
  //  - NO-WINNER matches: their pot + slots carry (treo capacity), to be split
  //    by slots at the next winning day.
  type DayInfo = {
    date: string;
    finished: boolean;
    wonFund: number; // won matches' pot (distributed by win-ratio)
    correct: Map<string, number>; // name -> correct scores (on won matches)
    noWinFund: number; // no-winner matches' pot (carries / "other" source)
    noWinSlots: Map<string, number>; // name -> slots on no-winner matches
    carryFund?: number; // a carried treo day: noWinFund holds the leftover.
  };

  // Predicted matches grouped by day — only days AFTER the watermark.
  const predictedIds = new Set(preds.map((p) => p.match_id));
  const matchesByDay = new Map<string, Match[]>();
  for (const m of matches) {
    if (!predictedIds.has(m.id)) continue;
    const d = dayKey(m.kickoff_time);
    if (watermark && d <= watermark) continue; // already chốt'd
    if (!matchesByDay.has(d)) matchesByDay.set(d, []);
    matchesByDay.get(d)!.push(m);
  }

  const infos: DayInfo[] = [...matchesByDay.keys()].sort().map((d) => {
    const dms = matchesByDay.get(d)!;
    const ids = new Set(dms.map((m) => m.id));
    const finished = dms.every(
      (m) => m.status === "finished" && m.home_score != null && m.away_score != null
    );
    // Which of this day's matches were won (someone nailed the exact score).
    const isWon = (m: Match) =>
      m.status === "finished" &&
      m.home_score != null &&
      m.away_score != null &&
      preds.some(
        (p) =>
          p.match_id === m.id &&
          p.predicted_home === m.home_score &&
          p.predicted_away === m.away_score
      );
    const wonIds = new Set(dms.filter(isWon).map((m) => m.id));

    const correct = new Map<string, number>();
    const noWinSlots = new Map<string, number>();
    let wonSlots = 0;
    let noWinSlotsTotal = 0;
    for (const p of preds) {
      if (!ids.has(p.match_id)) continue;
      const m = matchById.get(p.match_id)!;
      if (wonIds.has(p.match_id)) {
        wonSlots++;
        if (p.predicted_home === m.home_score && p.predicted_away === m.away_score)
          correct.set(p.player_name, (correct.get(p.player_name) ?? 0) + 1);
      } else {
        noWinSlotsTotal++;
        noWinSlots.set(p.player_name, (noWinSlots.get(p.player_name) ?? 0) + 1);
      }
    }
    return {
      date: d,
      finished,
      wonFund: wonSlots * STAKE,
      correct,
      noWinFund: noWinSlotsTotal * STAKE,
      noWinSlots,
    };
  });

  const pay = new Map<string, number>(); // "name|date" -> amount
  const addPay = (name: string, date: string, amount: number) =>
    pay.set(name + "|" + date, (pay.get(name + "|" + date) ?? 0) + amount);

  // Win breakdown (for the admin congrats + Tổng kết history).
  const winBy = new Map<string, number>();
  const correctBy = new Map<string, number>();
  const maxClaimBy = new Map<string, number>(); // each winner's max-claim cap
  let scaledFlag = false; // whether any pool was scaled down (over the fund)
  // Per-winner, per-source breakdown for the preview explanation.
  //  - "win": the winning day, split by win-ratio (correct scores),
  //  - "treo": the carried treo, split by slots (max-claim), prioritised,
  //  - "other": a carried no-winner day, split by slots (max-claim).
  type DayLine = {
    kind: "win" | "treo" | "other";
    date: string;
    slots: number; // winner's slots that day
    players: number; // players that day (for "other")
    correct: number; // correct scores (for "win")
    totalWin: number; // total correct scores among winners (for "win")
    amount: number; // this source's share of the winner's payout
  };
  const winnerDays = new Map<string, DayLine[]>();

  // Settle one pool with THREE separate fund sources, each on its own rule:
  //  - WON MATCHES of the winning day: their pot is split by win-ratio (correct
  //    scores) — winners share by how many scores each nailed.
  //  - TREO (carried leftover): split by slots (max-claim = slots × players ×
  //    stake), prioritised — paid out in full if the winners' max-claim covers
  //    it, otherwise scaled down to exactly the treo (the rest still carries).
  //  - OTHER no-winner matches (carried no-winner days + the winning day's own
  //    unwon matches): split by slots (max-claim), scaled down if the winners'
  //    max-claim exceeds that fund. Whatever isn't claimed here carries.
  // Winners who got paid drop out of the next carry (see makeCarry).
  const settlePool = (poolDays: DayInfo[], winDay: DayInfo): number => {
    const winners = [...winDay.correct.entries()].filter(([, c]) => c > 0);
    const totalWin = winners.reduce((s, [, c]) => s + c, 0);

    const treoDays = poolDays.filter((d) => d.carryFund !== undefined);
    // Real days (incl. the winning day) contribute their NO-WINNER matches to
    // the "other" source; the winning day's WON matches are the winFund.
    const otherDays = poolDays.filter((d) => d.carryFund === undefined);
    const treoFund = treoDays.reduce((s, d) => s + (d.carryFund ?? 0), 0);
    const otherFund = otherDays.reduce((s, d) => s + d.noWinFund, 0);
    const winFund = winDay.wonFund;

    // Max-claim per winner from the treo and from the no-winner matches.
    const treoMax = new Map<string, number>();
    const otherMax = new Map<string, number>();
    for (const d of treoDays) {
      const np = d.noWinSlots.size;
      for (const [name, sl] of d.noWinSlots)
        treoMax.set(name, (treoMax.get(name) ?? 0) + sl * np * STAKE);
    }
    for (const d of otherDays) {
      const np = d.noWinSlots.size;
      for (const [name, sl] of d.noWinSlots)
        otherMax.set(name, (otherMax.get(name) ?? 0) + sl * np * STAKE);
    }
    let sumTreo = 0;
    let sumOther = 0;
    for (const [name] of winners) {
      sumTreo += treoMax.get(name) ?? 0;
      sumOther += otherMax.get(name) ?? 0;
    }
    const treoScale = sumTreo > treoFund && sumTreo > 0 ? treoFund / sumTreo : 1;
    const otherScale =
      sumOther > otherFund && sumOther > 0 ? otherFund / sumOther : 1;
    if (treoScale < 1 || otherScale < 1) scaledFlag = true;

    let paidWinners = 0;
    for (const [name, c] of winners) {
      const winPay = (c / totalWin) * winFund; // won matches by win-ratio
      const treoPay = (treoMax.get(name) ?? 0) * treoScale; // treo by slots
      const otherPay = (otherMax.get(name) ?? 0) * otherScale; // no-winner by slots
      const w = winPay + treoPay + otherPay;
      addPay(name, winDay.date, w);
      winBy.set(name, (winBy.get(name) ?? 0) + w);
      correctBy.set(name, (correctBy.get(name) ?? 0) + c);
      maxClaimBy.set(
        name,
        (maxClaimBy.get(name) ?? 0) + (treoMax.get(name) ?? 0) + (otherMax.get(name) ?? 0)
      );
      paidWinners += w;

      const lines = winnerDays.get(name) ?? [];
      lines.push({
        kind: "win",
        date: winDay.date,
        slots: 0,
        players: 0,
        correct: c,
        totalWin,
        amount: winPay,
      });
      const treoSlots = treoDays.reduce(
        (s, d) => s + (d.noWinSlots.get(name) ?? 0),
        0
      );
      if (treoSlots > 0)
        lines.push({
          kind: "treo",
          date: treoDays[0].date,
          slots: treoSlots,
          players: 0,
          correct: 0,
          totalWin: 0,
          amount: treoPay,
        });
      for (const d of otherDays) {
        const sl = d.noWinSlots.get(name) ?? 0;
        if (sl <= 0) continue;
        lines.push({
          kind: "other",
          date: d.date,
          slots: sl,
          players: d.noWinSlots.size,
          correct: 0,
          totalWin: 0,
          amount: sl * d.noWinSlots.size * STAKE * otherScale,
        });
      }
      winnerDays.set(name, lines);
    }

    // Each source's leftover carries (the winning day is always fully paid).
    return Math.max(0, treoFund + otherFund + winFund - paidWinners);
  };

  // A carried treo day: its fund = leftover, slots = the pool's NO-WINNER-match
  // slots (won matches were disbursed, never carried; winners drop out too).
  const makeCarry = (
    poolDays: DayInfo[],
    date: string,
    leftover: number,
    winnerNames: Set<string>
  ): DayInfo => {
    const slots = new Map<string, number>();
    for (const d of poolDays)
      for (const [name, sl] of d.noWinSlots) {
        if (winnerNames.has(name)) continue; // exclude just-paid winners
        slots.set(name, (slots.get(name) ?? 0) + sl);
      }
    return {
      date,
      finished: true,
      wonFund: 0,
      correct: new Map(),
      noWinFund: leftover,
      noWinSlots: slots,
      carryFund: leftover,
    };
  };

  // Seed the pool with the carried treo as a single day: aggregated no-winner
  // slots (carrySlots already excludes paid players + won matches) + its
  // leftover fund. Its max-claim is split by slots, scaled to the leftover.
  const carryStart: DayInfo | null =
    carryAmount > 0
      ? {
          date: watermark,
          finished: true,
          wonFund: 0,
          correct: new Map(),
          noWinFund: carryAmount,
          noWinSlots: carrySlots,
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
      settledFund += d.wonFund + d.noWinFund;
    }
    // Carry the leftover forward (treo), dropping this pool's winners.
    const winnerNames = new Set(
      [...info.correct.entries()].filter(([, c]) => c > 0).map(([n]) => n)
    );
    pool = leftover > 0 ? [makeCarry(pool, info.date, leftover, winnerNames)] : [];
  }

  // What's left after the last winning day: real no-winner days (shown per-day)
  // + any carried treo amount (kept in the fund for the next settlement).
  const pendingReal = pool.filter((d) => d.carryFund === undefined);
  const carryDay = pool.find((d) => d.carryFund !== undefined);

  // Round money UP to the nearest 1.000đ (clean cash amounts). Each winner's
  // total is the sum of their rounded per-source lines, so the breakdown always
  // foots; the payout stored in rewards uses that same total.
  const round = (n: number) => Math.round(n);
  const roundK = (n: number) => Math.ceil(n / 1000) * 1000;

  // Rounded per-winner day lines + total.
  const roundedDays = new Map<string, ReturnType<typeof mapDays>>();
  function mapDays(name: string) {
    return (winnerDays.get(name) ?? []).map((d) => ({
      kind: d.kind,
      date: d.date,
      slots: d.slots,
      players: d.players,
      correct: d.correct,
      totalWin: d.totalWin,
      amount: roundK(d.amount),
    }));
  }
  const totalByName = new Map<string, number>();
  for (const name of winBy.keys()) {
    const days = mapDays(name);
    roundedDays.set(name, days);
    totalByName.set(name, days.reduce((s, d) => s + d.amount, 0));
  }

  const payouts = [...pay.entries()].map(([k]) => {
    const [player_name, pay_date] = k.split("|");
    return { player_name, pay_date, amount: totalByName.get(player_name) ?? 0 };
  });

  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
  const pendingOut = pendingReal.map((e) => ({
    date: e.date,
    pot: e.wonFund + e.noWinFund,
  }));

  const paidDates = [...paidReal];
  const settledDays = paidDates.length;

  // Win breakdown + carried treo. Fund for THIS settlement = carried leftover
  // from before + the new days' money settled now (never re-adds old days).
  const fund = round(carryAmount + settledFund);
  const winTotal = [...totalByName.values()].reduce((s, v) => s + v, 0);
  const totalCorrect = [...correctBy.values()].reduce((s, v) => s + v, 0);
  const breakdown = {
    fund,
    winTotal,
    carried: Math.max(0, fund - winTotal), // leftover after the rounded payouts
    totalCorrect,
    scaled: scaledFlag,
    winners: [...winBy.entries()]
      .map(([name]) => ({
        name,
        correct: correctBy.get(name) ?? 0,
        maxClaim: round(maxClaimBy.get(name) ?? 0),
        amount: totalByName.get(name) ?? 0,
        days: roundedDays.get(name) ?? [],
      }))
      .sort((a, b) => b.amount - a.amount),
  };

  // The carried treo as a fund-by-day entry (matches breakdown.carried after
  // the rounded payouts; null when winners absorbed everything).
  const carriedTreo =
    carryDay && breakdown.carried > 0
      ? {
          date: carryDay.date,
          amount: breakdown.carried,
          participants: [...carryDay.noWinSlots.keys()],
        }
      : null;

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
