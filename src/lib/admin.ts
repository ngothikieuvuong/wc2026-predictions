import { supabase } from "./supabase";
import type { Match, Prediction, Reward } from "./types";
import { dayKey } from "./day";

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
  // Cumulative net per person from days whose money has been distributed:
  // received − stake in those resolved days. Zero-sum.
  net: { name: string; value: number }[];
};

// Day-based settlement, computed from scratch (no DB writes — call
// applySettlement to persist). Rules:
//  - Each prediction = 1 slot (20k). A day's pot = its slots × 20k.
//  - Process days chronologically; stop at the first day not fully finished.
//  - Day with winners: split the day pot by each winner's CORRECT slots. Then
//    take the combined pot of earlier no-winner days that any winner joined,
//    split by each winner's TOTAL slots across those days. No-winner days that
//    none of the winners joined stay pending (money stays in the quỹ).
export async function computeSettlement(): Promise<SettleResult> {
  const [{ data: matchesData }, { data: predsData }] = await Promise.all([
    supabase.from("matches").select("*"),
    supabase.from("predictions").select("*"),
  ]);
  const matches = (matchesData as Match[]) ?? [];
  const preds = (predsData as Prediction[]) ?? [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const matchesByDay = new Map<string, Match[]>();
  for (const m of matches) {
    const d = dayKey(m.kickoff_time);
    if (!matchesByDay.has(d)) matchesByDay.set(d, []);
    matchesByDay.get(d)!.push(m);
  }

  type DayInfo = {
    date: string;
    finished: boolean;
    totalSlots: number;
    slots: Map<string, number>; // name -> slots placed that day
    correct: Map<string, number>; // name -> correct slots that day
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

  let pending: DayInfo[] = [];
  const settled: DayInfo[] = [];
  let settledDays = 0;

  for (const info of infos) {
    if (!info.finished) break; // chronological — wait for the full day's results
    settledDays++;
    settled.push(info);
    const winners = [...info.correct.entries()].filter(([, c]) => c > 0);
    if (winners.length === 0) {
      pending.push(info);
      continue;
    }

    // Day pot split by correct slots.
    const pot = info.totalSlots * STAKE;
    const totalWin = winners.reduce((s, [, c]) => s + c, 0);
    for (const [name, c] of winners) addPay(name, info.date, (pot * c) / totalWin);

    // Carryover from earlier no-winner days the winners joined.
    const winnerNames = winners.map(([n]) => n);
    const eligible = pending.filter((e) =>
      winnerNames.some((n) => (e.slots.get(n) ?? 0) > 0)
    );
    if (eligible.length > 0) {
      const combined = eligible.reduce((s, e) => s + e.totalSlots * STAKE, 0);
      const weight = new Map<string, number>();
      for (const n of winnerNames) {
        let w = 0;
        for (const e of eligible) w += e.slots.get(n) ?? 0;
        if (w > 0) weight.set(n, w);
      }
      const totalWeight = [...weight.values()].reduce((a, b) => a + b, 0);
      if (totalWeight > 0)
        for (const [n, w] of weight) addPay(n, info.date, (combined * w) / totalWeight);
      const used = new Set(eligible.map((e) => e.date));
      pending = pending.filter((e) => !used.has(e.date));
    }
  }

  const payouts = [...pay.entries()].map(([k, amount]) => {
    const [player_name, pay_date] = k.split("|");
    return { player_name, pay_date, amount: Math.round(amount) };
  });

  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
  const pendingOut = pending.map((e) => ({ date: e.date, pot: e.totalSlots * STAKE }));

  // Net per person from resolved days (settled days whose money was distributed,
  // i.e. settled days no longer pending). net = received − stake in those days.
  const pendingDates = new Set(pending.map((e) => e.date));
  const received = new Map<string, number>();
  for (const p of payouts)
    received.set(p.player_name, (received.get(p.player_name) ?? 0) + p.amount);
  const resolvedStake = new Map<string, number>();
  for (const info of settled) {
    if (pendingDates.has(info.date)) continue; // still treo → not resolved
    for (const [name, slots] of info.slots)
      resolvedStake.set(name, (resolvedStake.get(name) ?? 0) + slots * STAKE);
  }
  const names = new Set([...received.keys(), ...resolvedStake.keys()]);
  const net = [...names].map((name) => ({
    name,
    value: (received.get(name) ?? 0) - (resolvedStake.get(name) ?? 0),
  }));

  return { settledDays, totalPaid, payouts, pending: pendingOut, net };
}

// Persist a settlement: rewrite the rewards table (delete all → insert fresh).
export async function applySettlement(
  payouts: SettleResult["payouts"]
): Promise<void> {
  await supabase.from("rewards").delete().gte("amount", 0);
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

// Log a settlement event (cumulative net snapshot) — skips if unchanged.
export async function logSettlement(net: SettleResult["net"]): Promise<void> {
  const { data: last } = await supabase
    .from("settlements")
    .select("cum")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastCum =
    ((last?.cum as { name: string; value: number }[] | undefined) ?? []);
  const rounded = net.map((n) => ({ name: n.name, value: Math.round(n.value) }));
  if (normNet(lastCum) === normNet(rounded)) return; // no change → no event
  await supabase.from("settlements").insert({ cum: rounded });
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
export async function getAllPredictionsDetailed(): Promise<
  {
    id: string;
    player_name: string;
    match_id: string;
    team1: string;
    team2: string;
    predicted_home: number;
    predicted_away: number;
    kickoff_time: string;
  }[]
> {
  const [{ data: preds }, { data: matches }] = await Promise.all([
    supabase.from("predictions").select("*"),
    supabase.from("matches").select("*"),
  ]);
  const byId = new Map(((matches as Match[]) ?? []).map((m) => [m.id, m]));
  return ((preds as Prediction[]) ?? [])
    .map((p) => {
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
      };
    })
    .sort(
      (a, b) =>
        a.player_name.localeCompare(b.player_name) ||
        (a.kickoff_time < b.kickoff_time ? -1 : 1)
    );
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
