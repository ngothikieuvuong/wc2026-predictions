import { supabase, STAKE_VND } from "./supabase";
import type { Match, Prediction, Reward, Reaction } from "./types";
import { dayKey, dayLabel, activeDay } from "./day";

// Current jackpot: counts days up to the active day (the day currently in
// play). Future days aren't in the pot yet; once a day's matches finish with
// no winner, the next day rolls in. Minus what's been paid out.
export async function getJackpot(): Promise<number> {
  const [{ data: preds }, { data: matches }, { data: rewards }] = await Promise.all([
    supabase.from("predictions").select("match_id"),
    supabase.from("matches").select("id, kickoff_time, home_score, away_score"),
    supabase.from("rewards").select("amount"),
  ]);
  const P = (preds as { match_id: string }[]) ?? [];
  const M = (matches as Match[]) ?? [];
  const active = activeDay(M, P);
  const dayOf = new Map(M.map((m) => [m.id, dayKey(m.kickoff_time)]));
  let collected = 0;
  for (const p of P) {
    const d = dayOf.get(p.match_id);
    if (d && d <= active) collected += STAKE_VND;
  }
  const paid = (rewards ?? []).reduce(
    (s: number, r: { amount: number }) => s + Number(r.amount),
    0
  );
  return collected - paid;
}

export async function getNextMatch(): Promise<Match | null> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .gte("kickoff_time", new Date().toISOString())
    .order("kickoff_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Match) ?? null;
}

export async function getLatestWinner(): Promise<{
  player_name: string;
  amount: number;
  pay_date: string | null;
} | null> {
  // Highest payout of the most recently settled day.
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .order("pay_date", { ascending: false })
    .order("amount", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const reward = data as Reward & { pay_date: string | null };

  return {
    player_name: reward.player_name,
    amount: Number(reward.amount),
    pay_date: reward.pay_date ?? null,
  };
}

// Upcoming matches kicking off from now through the end of tomorrow (viewer's
// local day). Falls back to the single next match if nothing in that window.
export async function getUpcomingSoon(): Promise<Match[]> {
  const now = new Date();
  const endOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23,
    59,
    59,
    999
  );

  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .gte("kickoff_time", now.toISOString())
    .lte("kickoff_time", endOfTomorrow.toISOString())
    .order("kickoff_time", { ascending: true });

  const list = (data as Match[]) ?? [];
  if (list.length > 0) return list;

  const next = await getNextMatch();
  return next ? [next] : [];
}

// Upcoming matches grouped by game-day (21h rule), the next 2 days.
export async function getUpcomingByDay(): Promise<
  { day: string; matches: Match[] }[]
> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .eq("is_open", true)
    .gte("kickoff_time", new Date().toISOString())
    .order("kickoff_time", { ascending: true });

  const groups: { day: string; matches: Match[] }[] = [];
  for (const m of (data as Match[]) ?? []) {
    const d = dayKey(m.kickoff_time);
    const last = groups[groups.length - 1];
    if (!last || last.day !== d) groups.push({ day: d, matches: [m] });
    else last.matches.push(m);
  }
  return groups.slice(0, 2);
}

// Matches open for prediction (admin-selected), for the predict dropdown.
export async function getOpenMatches(): Promise<Match[]> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .eq("is_open", true)
    .order("kickoff_time", { ascending: true });
  return (data as Match[]) ?? [];
}

export async function getLeaderboard(): Promise<
  { player_name: string; wins: number; total: number }[]
> {
  const { data } = await supabase.from("rewards").select("player_name, amount");
  const rows = (data as Pick<Reward, "player_name" | "amount">[]) ?? [];

  const map = new Map<string, { player_name: string; wins: number; total: number }>();
  for (const r of rows) {
    const key = r.player_name.toLowerCase();
    const entry = map.get(key) ?? { player_name: r.player_name, wins: 0, total: 0 };
    entry.wins += 1;
    entry.total += Number(r.amount);
    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => b.total - a.total || b.wins - a.wins);
}

// All predictions grouped by match (for the "everyone's predictions" view).
// Only includes matches that have at least one prediction, newest match first.
export async function getPredictionsByMatch(): Promise<
  { match: Match; predictions: Prediction[] }[]
> {
  const [{ data: matches }, { data: preds }] = await Promise.all([
    // Sort by match time (soonest/most-recent first).
    supabase.from("matches").select("*").order("kickoff_time", { ascending: true }),
    supabase.from("predictions").select("*").order("created_at", { ascending: true }),
  ]);

  const byMatch = new Map<string, Prediction[]>();
  for (const p of (preds as Prediction[]) ?? []) {
    const list = byMatch.get(p.match_id) ?? [];
    list.push(p);
    byMatch.set(p.match_id, list);
  }

  return ((matches as Match[]) ?? [])
    .filter((m) => byMatch.has(m.id))
    .map((m) => ({ match: m, predictions: byMatch.get(m.id)! }));
}

// Fund broken down by day: each day still "in play" (not yet won) with its pot
// and who's in it. `counted` = already part of the current fund (day ≤ active);
// later days are shown but not yet counted.
export async function getFundByDay(): Promise<
  { date: string; participants: string[]; pot: number; counted: boolean }[]
> {
  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase.from("matches").select("*"),
    supabase.from("predictions").select("*"),
  ]);
  const M = (matches as Match[]) ?? [];
  const P = (preds as Prediction[]) ?? [];
  const active = activeDay(M, P);
  const byId = new Map(M.map((m) => [m.id, m]));

  // Days already chốt'd (≤ watermark) drop out; the leftover treo shows once.
  const { settlementState } = await import("./admin");
  const { watermark, carryAmount, carrySlots } = await settlementState(M, P);

  type Agg = { slots: number; names: Set<string> };
  const agg = new Map<string, Agg>();
  for (const p of P) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    const d = dayKey(m.kickoff_time);
    if (watermark && d <= watermark) continue; // already settled
    let a = agg.get(d);
    if (!a) {
      a = { slots: 0, names: new Set() };
      agg.set(d, a);
    }
    a.slots++;
    a.names.add(p.player_name);
  }

  const out = [...agg.entries()].map(([date, a]) => ({
    date,
    participants: [...a.names],
    pot: a.slots * STAKE_VND,
    counted: date <= active,
  }));

  // The carried-over leftover (treo) from past settlements as its own entry.
  if (carryAmount > 0) {
    out.push({
      date: watermark,
      participants: [...carrySlots.keys()],
      pot: carryAmount,
      counted: true,
    });
  }

  return out.sort((x, y) => (x.date < y.date ? -1 : 1));
}

// Quick info for two teams: FIFA rank + their results so far in the tournament.
export async function getTeamInfo(
  teamA: string,
  teamB: string
): Promise<
  {
    team: string;
    rank: number | null;
    played: number;
    w: number;
    d: number;
    l: number;
    gf: number;
    ga: number;
    results: { opp: string; gf: number; ga: number; res: "T" | "H" | "B" }[];
  }[]
> {
  const { teamRank } = await import("./strength");
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "finished");
  const M = (data as Match[]) ?? [];

  const build = (team: string) => {
    const ms = M.filter(
      (m) =>
        (m.team1 === team || m.team2 === team) &&
        m.home_score != null &&
        m.away_score != null
    ).sort((a, b) => (a.kickoff_time < b.kickoff_time ? 1 : -1));
    let w = 0,
      d = 0,
      l = 0,
      gf = 0,
      ga = 0;
    const results = ms.map((m) => {
      const isHome = m.team1 === team;
      const my = (isHome ? m.home_score : m.away_score) as number;
      const opp = (isHome ? m.away_score : m.home_score) as number;
      gf += my;
      ga += opp;
      const res: "T" | "H" | "B" = my > opp ? "T" : my === opp ? "H" : "B";
      if (res === "T") w++;
      else if (res === "H") d++;
      else l++;
      return { opp: isHome ? m.team2 : m.team1, gf: my, ga: opp, res };
    });
    return { team, rank: teamRank(team), played: ms.length, w, d, l, gf, ga, results };
  };

  return [build(teamA), build(teamB)];
}

// All finished matches with their result + names of anyone who nailed the
// exact score (most recently played first).
export async function getMatchResults(): Promise<
  {
    id: string;
    team1: string;
    team2: string;
    home_score: number;
    away_score: number;
    kickoff_time: string;
    winners: string[];
  }[]
> {
  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("status", "finished")
      .order("kickoff_time", { ascending: false }),
    supabase.from("predictions").select("*"),
  ]);
  const M = (matches as Match[]) ?? [];
  const byId = new Map(M.map((m) => [m.id, m]));
  const winnersByMatch = new Map<string, string[]>();
  for (const p of (preds as Prediction[]) ?? []) {
    const m = byId.get(p.match_id);
    if (!m || m.home_score == null || m.away_score == null) continue;
    if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) {
      const arr = winnersByMatch.get(m.id) ?? [];
      arr.push(p.player_name);
      winnersByMatch.set(m.id, arr);
    }
  }
  return M.map((m) => ({
    id: m.id,
    team1: m.team1,
    team2: m.team2,
    home_score: m.home_score!,
    away_score: m.away_score!,
    kickoff_time: m.kickoff_time,
    winners: winnersByMatch.get(m.id) ?? [],
  }));
}

// Correct predictions across finished matches (most recently played first).
export async function getCorrectPredictions(): Promise<
  {
    player_name: string;
    team1: string;
    team2: string;
    home_score: number;
    away_score: number;
    kickoff_time: string;
  }[]
> {
  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase.from("matches").select("*").eq("status", "finished"),
    supabase.from("predictions").select("*"),
  ]);
  const byId = new Map(((matches as Match[]) ?? []).map((m) => [m.id, m]));
  const out: {
    player_name: string;
    team1: string;
    team2: string;
    home_score: number;
    away_score: number;
    kickoff_time: string;
  }[] = [];
  for (const p of (preds as Prediction[]) ?? []) {
    const m = byId.get(p.match_id);
    if (!m || m.home_score == null || m.away_score == null) continue;
    if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) {
      out.push({
        player_name: p.player_name,
        team1: m.team1,
        team2: m.team2,
        home_score: m.home_score,
        away_score: m.away_score,
        kickoff_time: m.kickoff_time,
      });
    }
  }
  out.sort((a, b) => (a.kickoff_time < b.kickoff_time ? 1 : -1));
  return out;
}

// One person's full prediction history (most recent match first), with the
// match result and whether they nailed the exact score.
export async function getPlayerHistory(name: string): Promise<
  {
    team1: string;
    team2: string;
    predicted_home: number;
    predicted_away: number;
    home_score: number | null;
    away_score: number | null;
    finished: boolean;
    win: boolean;
    kickoff_time: string;
    created_at: string;
  }[]
> {
  const [{ data: preds }, { data: matches }] = await Promise.all([
    supabase.from("predictions").select("*").eq("player_name", name),
    supabase.from("matches").select("*"),
  ]);
  const byId = new Map(((matches as Match[]) ?? []).map((m) => [m.id, m]));
  return ((preds as Prediction[]) ?? [])
    .map((p) => {
      const m = byId.get(p.match_id);
      const finished =
        m?.status === "finished" && m.home_score != null && m.away_score != null;
      const win =
        finished &&
        p.predicted_home === m!.home_score &&
        p.predicted_away === m!.away_score;
      return {
        team1: m?.team1 ?? "?",
        team2: m?.team2 ?? "?",
        predicted_home: p.predicted_home,
        predicted_away: p.predicted_away,
        home_score: m?.home_score ?? null,
        away_score: m?.away_score ?? null,
        finished: !!finished,
        win: !!win,
        kickoff_time: m?.kickoff_time ?? "",
        created_at: p.created_at,
      };
    })
    .sort((a, b) => (a.kickoff_time < b.kickoff_time ? 1 : -1));
}

type WinMatch = {
  team1: string;
  team2: string;
  home_score: number;
  away_score: number;
  winners: string[];
};

// Status banner for home / Mọi người / Tổng kết:
//  - "matches": someone already nailed a score but the day still has matches to
//    finish (keep playing / wait for the last match).
//  - "admin": all of the period's matches are finished and there's a winner, but
//    admin hasn't chốt sổ yet (wait for admin to settle).
export async function getPendingWinners(): Promise<{
  mode: "matches" | "admin" | "";
  lastMatch: { team1: string; team2: string } | null;
  matches: WinMatch[];
}> {
  const [{ data: preds }, { data: matches }] = await Promise.all([
    supabase.from("predictions").select("*"),
    supabase.from("matches").select("*"),
  ]);
  const P = (preds as Prediction[]) ?? [];
  const M = (matches as Match[]) ?? [];
  const byId = new Map(M.map((m) => [m.id, m]));

  const winnersOf = (m: Match): string[] =>
    m.status === "finished" && m.home_score != null && m.away_score != null
      ? P.filter(
          (p) =>
            p.match_id === m.id &&
            p.predicted_home === m.home_score &&
            p.predicted_away === m.away_score
        ).map((p) => p.player_name)
      : [];

  const toWinMatch = (m: Match): WinMatch => ({
    team1: m.team1,
    team2: m.team2,
    home_score: m.home_score as number,
    away_score: m.away_score as number,
    winners: winnersOf(m),
  });

  // 1) A fully-finished pool with a winner that admin hasn't chốt'd yet
  //    (computeSettlement is incremental, so winners here = not yet settled).
  const { computeSettlement } = await import("./admin");
  const settle = await computeSettlement();
  if (settle.breakdown.winners.length > 0) {
    const paid = new Set(settle.paidDates);
    const wm = M.filter((m) => paid.has(dayKey(m.kickoff_time)))
      .map(toWinMatch)
      .filter((x) => x.winners.length > 0);
    if (wm.length > 0) return { mode: "admin", lastMatch: null, matches: wm };
  }

  // 2) Early winners on the active day while it still has matches to finish.
  const active = activeDay(M, P);
  const dayIds = new Set<string>();
  for (const p of P) {
    const m = byId.get(p.match_id);
    if (m && dayKey(m.kickoff_time) === active) dayIds.add(m.id);
  }
  const dayMatches = [...dayIds]
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .sort((a, b) => (a.kickoff_time < b.kickoff_time ? -1 : 1));

  const allFinished =
    dayMatches.length > 0 &&
    dayMatches.every(
      (m) => m.status === "finished" && m.home_score != null && m.away_score != null
    );
  const last = dayMatches[dayMatches.length - 1];
  const out = dayMatches.map(toWinMatch).filter((x) => x.winners.length > 0);

  if (!allFinished && out.length > 0) {
    return {
      mode: "matches",
      lastMatch: last ? { team1: last.team1, team2: last.team2 } : null,
      matches: out,
    };
  }

  return { mode: "", lastMatch: null, matches: [] };
}

// One person's money ledger (credit/debit): each prediction is −20.000đ
// ("dự đoán tỷ số"), each settlement payout is +amount ("trúng tỷ số").
export async function getPlayerLedger(name: string): Promise<{
  total: number;
  items: { kind: "stake" | "win"; label: string; sub: string; amount: number; time: string }[];
}> {
  const [{ data: preds }, { data: matches }, { data: rewards }] = await Promise.all([
    supabase.from("predictions").select("*").eq("player_name", name),
    supabase.from("matches").select("*"),
    supabase.from("rewards").select("*").eq("player_name", name),
  ]);
  const byId = new Map(((matches as Match[]) ?? []).map((m) => [m.id, m]));

  const items: {
    kind: "stake" | "win";
    label: string;
    sub: string;
    amount: number;
    time: string;
  }[] = [];

  for (const p of (preds as Prediction[]) ?? []) {
    const m = byId.get(p.match_id);
    items.push({
      kind: "stake",
      label: "Dự đoán tỷ số",
      sub: m
        ? `${m.team1} – ${m.team2} · đoán ${p.predicted_home}–${p.predicted_away}`
        : "",
      amount: -STAKE_VND,
      time: p.created_at,
    });
  }

  for (const r of (rewards as Reward[]) ?? []) {
    items.push({
      kind: "win",
      label: "Trúng tỷ số",
      sub: r.pay_date ? `tất toán ngày ${dayLabel(r.pay_date)}` : "",
      amount: Number(r.amount),
      time: r.created_at,
    });
  }

  items.sort((a, b) => (a.time < b.time ? 1 : -1)); // newest first
  const total = items.reduce((s, i) => s + i.amount, 0);
  return { total, items };
}

// Existing predictions for one match (to show others' picks on the predict form).
export async function getPredictionsForMatch(
  matchId: string
): Promise<Prediction[]> {
  const { data } = await supabase
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  return (data as Prediction[]) ?? [];
}

// Roster of player names (for the predict dropdown), in the order added.
export async function getPlayers(): Promise<string[]> {
  const { data } = await supabase
    .from("players")
    .select("name")
    .order("created_at", { ascending: true });
  return ((data as { name: string }[]) ?? []).map((p) => p.name);
}

// Add a new name to the roster (ignores if it already exists).
export async function addPlayer(name: string): Promise<void> {
  await supabase.from("players").insert({ name: name.trim() });
}

// Settlement events (cumulative net snapshots), oldest first.
export async function getSettlements(): Promise<
  { created_at: string; cum: { name: string; value: number }[] }[]
> {
  const { data } = await supabase
    .from("settlements")
    .select("created_at, cum")
    .order("created_at", { ascending: true });
  return (
    (data as { created_at: string; cum: { name: string; value: number }[] }[]) ?? []
  );
}

// Per-player money stats: Chi (staked) vs Thu (received) → Lời/Lỗ (profit).
export async function getStats(): Promise<
  { name: string; chi: number; thu: number; loiLo: number }[]
> {
  const [{ data: players }, { data: preds }, { data: rewards }] = await Promise.all([
    supabase.from("players").select("name"),
    supabase.from("predictions").select("player_name"),
    supabase.from("rewards").select("player_name, amount"),
  ]);

  const chiByName = new Map<string, number>(); // count of predictions
  for (const p of (preds as { player_name: string }[]) ?? []) {
    chiByName.set(p.player_name, (chiByName.get(p.player_name) ?? 0) + 1);
  }
  const thuByName = new Map<string, number>();
  for (const r of (rewards as { player_name: string; amount: number }[]) ?? []) {
    thuByName.set(r.player_name, (thuByName.get(r.player_name) ?? 0) + Number(r.amount));
  }

  // Union of roster + anyone who has activity.
  const names = new Set<string>([
    ...((players as { name: string }[]) ?? []).map((p) => p.name),
    ...chiByName.keys(),
    ...thuByName.keys(),
  ]);

  return [...names]
    .map((name) => {
      const chi = (chiByName.get(name) ?? 0) * STAKE_VND;
      const thu = thuByName.get(name) ?? 0;
      return { name, chi, thu, loiLo: thu - chi };
    })
    .sort((a, b) => b.loiLo - a.loiLo);
}

// All emoji reactions, grouped by the prediction they belong to.
export async function getReactionsByPrediction(): Promise<
  Map<string, Reaction[]>
> {
  const { data } = await supabase
    .from("reactions")
    .select("*")
    .order("created_at", { ascending: true });
  const map = new Map<string, Reaction[]>();
  for (const r of (data as Reaction[]) ?? []) {
    const list = map.get(r.prediction_id) ?? [];
    list.push(r);
    map.set(r.prediction_id, list);
  }
  return map;
}

// Add one emoji reaction for a person on a prediction. A person can have many
// different emojis on the same prediction, but not the same emoji twice — so
// we clear that exact (person, emoji) first to stay idempotent.
export async function addReaction(
  predictionId: string,
  playerName: string,
  emoji: string
): Promise<void> {
  await supabase
    .from("reactions")
    .delete()
    .eq("prediction_id", predictionId)
    .eq("player_name", playerName)
    .eq("emoji", emoji);
  const { error } = await supabase.from("reactions").insert({
    prediction_id: predictionId,
    player_name: playerName,
    emoji,
  });
  if (error) throw new Error(error.message ?? "Không lưu được cảm xúc");
}

// Remove one specific emoji reaction of a person from a prediction.
export async function removeReaction(
  predictionId: string,
  playerName: string,
  emoji: string
): Promise<void> {
  await supabase
    .from("reactions")
    .delete()
    .eq("prediction_id", predictionId)
    .eq("player_name", playerName)
    .eq("emoji", emoji);
}

export type { Match, Prediction, Reward, Reaction };
