import { supabase } from "./supabase";
import type { Match, Prediction } from "./types";

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

// VN-date (UTC+7) key for a kickoff timestamp, e.g. "2026-06-15".
function dayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

export type SettleResult = {
  settledDays: number;
  totalPaid: number;
  payouts: { player_name: string; pay_date: string; amount: number }[];
  pending: { date: string; pot: number }[];
};

// Day-based settlement, recomputed from scratch (idempotent). Rules:
//  - Each prediction = 1 slot (20k). A day's pot = its slots × 20k.
//  - Process days chronologically; stop at the first day not fully finished.
//  - Day with winners: split the day pot by each winner's CORRECT slots. Then
//    take the combined pot of earlier no-winner days that any winner joined,
//    split by each winner's TOTAL slots across those days. No-winner days that
//    none of the winners joined stay pending (money stays in the quỹ).
export async function settleAll(): Promise<SettleResult> {
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
  let settledDays = 0;

  for (const info of infos) {
    if (!info.finished) break; // chronological — wait for the full day's results
    settledDays++;
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

  // Rewrite the rewards table (delete all → insert fresh) for idempotency.
  await supabase.from("rewards").delete().gte("amount", 0);
  if (payouts.length > 0) {
    await supabase
      .from("rewards")
      .insert(payouts.map((p) => ({ ...p, match_id: null })));
  }

  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
  const pendingOut = pending.map((e) => ({ date: e.date, pot: e.totalSlots * STAKE }));
  return { settledDays, totalPaid, payouts, pending: pendingOut };
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
