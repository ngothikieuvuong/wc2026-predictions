import { supabase } from "./supabase";
import type { Match, Prediction, Reward, Reaction } from "./types";
import { dayKey, dayLabel, activeDay } from "./day";

// Current jackpot: counts days up to the active day (the day currently in
// play). Future days aren't in the pot yet; once a day's matches finish with
// no winner, the next day rolls in. Minus what's been paid out.
export async function getJackpot(): Promise<number> {
  const { getStake } = await import("./admin");
  const STAKE = await getStake();
  const [{ data: preds }, { data: matches }, { data: rewards }, { data: adjustments }] =
    await Promise.all([
      supabase.from("predictions").select("match_id"),
      supabase.from("matches").select("id, kickoff_time, home_score, away_score"),
      supabase.from("rewards").select("amount"),
      // Only pool corrections (player_name null) move the jackpot; per-person
      // cộng/trừ don't.
      supabase.from("adjustments").select("amount").is("player_name", null),
    ]);
  const P = (preds as { match_id: string }[]) ?? [];
  const M = (matches as Match[]) ?? [];
  const active = activeDay(M, P);
  const dayOf = new Map(M.map((m) => [m.id, dayKey(m.kickoff_time)]));
  let collected = 0;
  for (const p of P) {
    const d = dayOf.get(p.match_id);
    if (d && d <= active) collected += STAKE;
  }
  const paid = (rewards ?? []).reduce(
    (s: number, r: { amount: number }) => s + Number(r.amount),
    0
  );
  // Manual withdrawals from the pool (admin "trích quỹ" / "sửa quỹ treo").
  const adjusted = ((adjustments as { amount: number }[]) ?? []).reduce(
    (s, a) => s + Number(a.amount),
    0
  );
  return collected - paid - adjusted;
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

// The most recent winners (newest first) for the home "đã trúng thưởng" list.
export async function getLatestWinners(limit = 4): Promise<
  { player_name: string; amount: number; pay_date: string | null }[]
> {
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false })
    .order("amount", { ascending: false })
    .limit(limit);
  return ((data as (Reward & { pay_date: string | null })[]) ?? []).map((r) => ({
    player_name: r.player_name,
    amount: Number(r.amount),
    pay_date: r.pay_date ?? null,
  }));
}

// The most-recently chốt'd settlement, for the "Tiền về tiền về" celebration.
// Returns the winners of the latest settlement batch (with the match they
// nailed) plus `until` = kickoff of the next match after the chốt — the banner
// shows until that match starts.
export async function getJustWon(): Promise<{
  wins: { player_name: string; amount: number; team1: string | null; team2: string | null }[];
  until: string | null;
}> {
  const { data } = await supabase
    .from("rewards")
    .select("player_name, amount, match_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const R =
    (data as { player_name: string; amount: number; match_id: string | null; created_at: string }[]) ??
    [];
  if (R.length === 0) return { wins: [], until: null };

  // All rewards from one chốt share the exact same created_at (single insert),
  // so the most-recent settlement = rows whose created_at equals the newest.
  const settledAt = R[0].created_at;
  const batch = R.filter((r) => r.created_at === settledAt);

  const ids = [...new Set(batch.map((r) => r.match_id).filter((x): x is string => !!x))];
  const teamById = new Map<string, { team1: string; team2: string }>();
  if (ids.length) {
    const { data: ms } = await supabase
      .from("matches")
      .select("id, team1, team2")
      .in("id", ids);
    for (const m of (ms as { id: string; team1: string; team2: string }[]) ?? [])
      teamById.set(m.id, { team1: m.team1, team2: m.team2 });
  }
  const wins = batch.map((r) => {
    const m = r.match_id ? teamById.get(r.match_id) : undefined;
    return {
      player_name: r.player_name,
      amount: Number(r.amount),
      team1: m?.team1 ?? null,
      team2: m?.team2 ?? null,
    };
  });

  // Hide once the next match OPEN FOR PREDICTION (is_open) kicks off — matches
  // not opened for the group don't count as "trận tiếp theo".
  const { data: nextOpen } = await supabase
    .from("matches")
    .select("kickoff_time")
    .eq("is_open", true)
    .gt("kickoff_time", settledAt)
    .order("kickoff_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  const until = (nextOpen as { kickoff_time: string } | null)?.kickoff_time ?? null;

  return { wins, until };
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

// Upcoming matches grouped by game-day (21h rule), the next 2 days. Includes
// matches not yet open for prediction (the home page highlights the open ones).
export async function getUpcomingByDay(): Promise<
  { day: string; matches: Match[] }[]
> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
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

  // Per-day fund: not-yet-played matches' pots + any treo carried on that day.
  const { getStake, computeSettlement } = await import("./admin");
  const STAKE = await getStake();
  const { treoMatches } = await computeSettlement();

  type Agg = { pot: number; names: Set<string> };
  const agg = new Map<string, Agg>();
  const bump = (date: string, pot: number, names: string[]) => {
    let a = agg.get(date);
    if (!a) {
      a = { pot: 0, names: new Set() };
      agg.set(date, a);
    }
    a.pot += pot;
    names.forEach((n) => a!.names.add(n));
  };

  for (const p of P) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    if (m.home_score != null && m.away_score != null) continue; // resolved → out
    bump(dayKey(m.kickoff_time), STAKE, [p.player_name]);
  }
  for (const t of treoMatches ?? []) bump(t.date, t.pot, t.participants);

  return [...agg.entries()]
    .map(([date, a]) => ({
      date,
      participants: [...a.names],
      pot: a.pot,
      counted: date <= active,
    }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

// Fund broken down by MATCH, grouped by day. Each day box lists its matches:
//  - matches NOT yet played (money still coming in), and
//  - no-winner matches still in treo (marked treo: true) — listed individually,
//    not lumped, so you can see exactly which matches are carried.
export async function getFundByMatch(): Promise<
  {
    date: string;
    counted: boolean;
    matches: {
      team1: string | null;
      team2: string | null;
      participants: string[];
      pot: number;
      treo: boolean;
    }[];
  }[]
> {
  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase.from("matches").select("*"),
    supabase.from("predictions").select("*"),
  ]);
  const M = (matches as Match[]) ?? [];
  const P = (preds as Prediction[]) ?? [];
  const active = activeDay(M, P);
  const byId = new Map(M.map((m) => [m.id, m]));

  const { getStake, computeSettlement } = await import("./admin");
  const STAKE = await getStake();
  const { treoMatches } = await computeSettlement();

  type Entry = {
    team1: string | null;
    team2: string | null;
    participants: string[];
    pot: number;
    treo: boolean;
    sort: string;
  };
  const byDay = new Map<string, Entry[]>();
  const push = (date: string, e: Entry) => {
    const arr = byDay.get(date) ?? [];
    arr.push(e);
    byDay.set(date, arr);
  };

  // Not-yet-played predicted matches (money still in play).
  const perMatch = new Map<string, { match: Match; names: Set<string>; slots: number }>();
  for (const p of P) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    if (m.home_score != null && m.away_score != null) continue; // resolved → out
    let e = perMatch.get(m.id);
    if (!e) {
      e = { match: m, names: new Set(), slots: 0 };
      perMatch.set(m.id, e);
    }
    e.names.add(p.player_name);
    e.slots++;
  }
  for (const e of perMatch.values()) {
    push(dayKey(e.match.kickoff_time), {
      team1: e.match.team1,
      team2: e.match.team2,
      participants: [...e.names].sort((a, b) => a.localeCompare(b, "vi")),
      pot: e.slots * STAKE,
      treo: false,
      sort: e.match.kickoff_time,
    });
  }

  // No-winner matches still in treo — each listed under its day.
  for (const t of treoMatches ?? []) {
    push(t.date, {
      team1: t.team1,
      team2: t.team2,
      participants: [...t.participants].sort((a, b) => a.localeCompare(b, "vi")),
      pot: t.pot,
      treo: true,
      sort: "~" + t.date, // treo (finished) sorts after upcoming within a day
    });
  }

  const out = [...byDay.entries()].map(([date, arr]) => ({
    date,
    counted: date <= active,
    // A day still has money in play (upcoming) if any of its entries isn't treo.
    pending: arr.some((e) => !e.treo),
    matches: arr
      .sort((a, b) => (a.sort < b.sort ? -1 : 1))
      .map(({ sort, ...m }) => m),
  }));

  // Upcoming days first (soonest kickoff on top → further later), then the
  // treo days (no-winner pots), newest to oldest.
  const upcoming = out
    .filter((g) => g.pending)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const treo = out
    .filter((g) => !g.pending)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return [...upcoming, ...treo].map(({ pending, ...g }) => g);
}

// Group-stage standings computed from OUR match results (the game's source of
// truth). Groups are derived by clustering the round-robin: each group's 4
// teams all play each other, so connected components of size 4 are the groups.
// Labelled A.. by earliest kickoff (approx. real order).
export async function getGroupStandings(): Promise<
  {
    name: string;
    rows: {
      name: string;
      P: number;
      W: number;
      D: number;
      L: number;
      GF: number;
      GA: number;
      GD: number;
      Pts: number;
    }[];
  }[]
> {
  const { data } = await supabase.from("matches").select("*");
  const M = (data as Match[]) ?? [];

  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const m of M) {
    link(m.team1, m.team2);
    link(m.team2, m.team1);
  }

  // Connected components.
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const t of adj.keys()) {
    if (seen.has(t)) continue;
    const stack = [t];
    const comp: string[] = [];
    seen.add(t);
    while (stack.length) {
      const x = stack.pop()!;
      comp.push(x);
      for (const n of adj.get(x) ?? [])
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
    }
    comps.push(comp);
  }
  const groups = comps.filter((c) => c.length === 4); // a proper group of 4

  const rowsFor = (teams: string[]) => {
    const tset = new Set(teams);
    const row = new Map<
      string,
      { name: string; P: number; W: number; D: number; L: number; GF: number; GA: number; GD: number; Pts: number }
    >();
    teams.forEach((t) =>
      row.set(t, { name: t, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 })
    );
    for (const m of M) {
      if (!tset.has(m.team1) || !tset.has(m.team2)) continue;
      if (m.status !== "finished" || m.home_score == null || m.away_score == null)
        continue;
      const h = row.get(m.team1)!;
      const a = row.get(m.team2)!;
      h.P++; a.P++;
      h.GF += m.home_score; h.GA += m.away_score;
      a.GF += m.away_score; a.GA += m.home_score;
      if (m.home_score > m.away_score) { h.W++; a.L++; h.Pts += 3; }
      else if (m.home_score < m.away_score) { a.W++; h.L++; a.Pts += 3; }
      else { h.D++; a.D++; h.Pts++; a.Pts++; }
      h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
    }
    return [...row.values()].sort(
      (x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.name.localeCompare(y.name)
    );
  };

  const earliest = (teams: string[]) =>
    Math.min(
      ...M.filter((m) => teams.includes(m.team1)).map((m) =>
        new Date(m.kickoff_time).getTime()
      )
    );
  groups.sort((a, b) => earliest(a) - earliest(b));
  const LETTERS = "ABCDEFGHIJKL".split("");
  return groups.map((teams, i) => ({
    name: LETTERS[i] ?? String(i + 1),
    rows: rowsFor(teams),
  }));
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
    match_no: number | null;
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
    match_no: m.match_no ?? null,
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

// Status banner for home / Mọi người / Tổng kết. With per-match settlement,
// every finished match with a winner can be chốt'd right away — so the only
// pending state is "đã trúng, chờ admin chốt sổ" (mode "admin"). The match_ids
// computeSettlement is about to pay are exactly the unsettled winning matches.
export async function getPendingWinners(): Promise<{
  mode: "admin" | "";
  matches: WinMatch[];
}> {
  const [{ data: preds }, { data: matches }] = await Promise.all([
    supabase.from("predictions").select("*"),
    supabase.from("matches").select("*"),
  ]);
  const P = (preds as Prediction[]) ?? [];
  const M = (matches as Match[]) ?? [];

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

  const { computeSettlement } = await import("./admin");
  const settle = await computeSettlement();
  const ids = new Set(
    settle.payouts.map((p) => p.match_id).filter((x): x is string => !!x)
  );
  if (ids.size === 0) return { mode: "", matches: [] };

  const wm = M.filter((m) => ids.has(m.id))
    .sort((a, b) => (a.kickoff_time < b.kickoff_time ? -1 : 1))
    .map(toWinMatch)
    .filter((x) => x.winners.length > 0);
  return wm.length > 0 ? { mode: "admin", matches: wm } : { mode: "", matches: [] };
}

// One person's money ledger (credit/debit): each prediction is −20.000đ
// ("dự đoán tỷ số"), each settlement payout is +amount ("trúng tỷ số").
export async function getPlayerLedger(name: string): Promise<{
  total: number;
  items: { kind: "stake" | "win"; label: string; sub: string; amount: number; time: string }[];
}> {
  const { getStake } = await import("./admin");
  const STAKE = await getStake();
  const [{ data: preds }, { data: matches }, { data: rewards }, { data: adjustments }] =
    await Promise.all([
      supabase.from("predictions").select("*").eq("player_name", name),
      supabase.from("matches").select("*"),
      supabase.from("rewards").select("*").eq("player_name", name),
      supabase.from("adjustments").select("*").eq("player_name", name),
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
      amount: -STAKE,
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

  // Manual payouts from the fund (admin gave this person money).
  for (const a of (adjustments as { amount: number; note: string | null; created_at: string }[]) ??
    []) {
    items.push({
      kind: "win",
      label: a.note || "Điều chỉnh",
      sub: "admin điều chỉnh",
      amount: Number(a.amount),
      time: a.created_at,
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
  const { getStake } = await import("./admin");
  const STAKE = await getStake();
  const [{ data: players }, { data: preds }, { data: rewards }, { data: adjustments }] =
    await Promise.all([
      supabase.from("players").select("name"),
      supabase.from("predictions").select("player_name"),
      supabase.from("rewards").select("player_name, amount"),
      supabase.from("adjustments").select("player_name, amount"),
    ]);

  const chiByName = new Map<string, number>(); // count of predictions
  for (const p of (preds as { player_name: string }[]) ?? []) {
    chiByName.set(p.player_name, (chiByName.get(p.player_name) ?? 0) + 1);
  }
  const thuByName = new Map<string, number>();
  for (const r of (rewards as { player_name: string; amount: number }[]) ?? []) {
    thuByName.set(r.player_name, (thuByName.get(r.player_name) ?? 0) + Number(r.amount));
  }
  // Manual payouts count as money received by that person.
  for (const a of (adjustments as { player_name: string | null; amount: number }[]) ?? []) {
    if (!a.player_name) continue; // general corrections aren't anyone's income
    thuByName.set(a.player_name, (thuByName.get(a.player_name) ?? 0) + Number(a.amount));
  }

  // Union of roster + anyone who has activity.
  const names = new Set<string>([
    ...((players as { name: string }[]) ?? []).map((p) => p.name),
    ...chiByName.keys(),
    ...thuByName.keys(),
  ]);

  return [...names]
    .map((name) => {
      const chi = (chiByName.get(name) ?? 0) * STAKE;
      const thu = thuByName.get(name) ?? 0;
      return { name, chi, thu, loiLo: thu - chi };
    })
    .sort((a, b) => b.loiLo - a.loiLo);
}

// Per-player accuracy: total predictions, exact-score hits, hit-rate, plus money
// received (how many times, total, biggest single win).
export async function getPlayerStats(): Promise<
  {
    name: string;
    predictions: number;
    correct: number;
    rate: number;
    winCount: number;
    won: number;
    best: number;
  }[]
> {
  const [{ data: players }, { data: preds }, { data: matches }, { data: rewards }] =
    await Promise.all([
      supabase.from("players").select("name"),
      supabase.from("predictions").select("*"),
      supabase.from("matches").select("*"),
      supabase.from("rewards").select("player_name, amount"),
    ]);
  const byId = new Map(((matches as Match[]) ?? []).map((m) => [m.id, m]));

  const predCount = new Map<string, number>();
  const correct = new Map<string, number>();
  for (const p of (preds as Prediction[]) ?? []) {
    predCount.set(p.player_name, (predCount.get(p.player_name) ?? 0) + 1);
    const m = byId.get(p.match_id);
    if (
      m &&
      m.status === "finished" &&
      m.home_score != null &&
      m.away_score != null &&
      p.predicted_home === m.home_score &&
      p.predicted_away === m.away_score
    ) {
      correct.set(p.player_name, (correct.get(p.player_name) ?? 0) + 1);
    }
  }

  const winCount = new Map<string, number>();
  const won = new Map<string, number>();
  const best = new Map<string, number>();
  for (const r of (rewards as { player_name: string; amount: number }[]) ?? []) {
    const a = Number(r.amount);
    winCount.set(r.player_name, (winCount.get(r.player_name) ?? 0) + 1);
    won.set(r.player_name, (won.get(r.player_name) ?? 0) + a);
    best.set(r.player_name, Math.max(best.get(r.player_name) ?? 0, a));
  }

  const names = new Set<string>([
    ...((players as { name: string }[]) ?? []).map((p) => p.name),
    ...predCount.keys(),
  ]);

  return [...names]
    .map((name) => {
      const predictions = predCount.get(name) ?? 0;
      const c = correct.get(name) ?? 0;
      return {
        name,
        predictions,
        correct: c,
        rate: predictions ? c / predictions : 0,
        winCount: winCount.get(name) ?? 0,
        won: won.get(name) ?? 0,
        best: best.get(name) ?? 0,
      };
    })
    .filter((s) => s.predictions > 0)
    .sort((a, b) => b.correct - a.correct || b.rate - a.rate || b.won - a.won);
}

// Payouts grouped per settlement batch (one "lần chốt" = rewards sharing a
// created_at), newest first. Each group expands to show who received what.
export async function getReceipts(): Promise<
  {
    time: string;
    total: number;
    items: { name: string; amount: number; label: string }[];
  }[]
> {
  const [{ data: rewards }, { data: matches }] = await Promise.all([
    supabase.from("rewards").select("*").order("created_at", { ascending: false }),
    supabase.from("matches").select("id, team1, team2"),
  ]);
  const label = new Map(
    ((matches as { id: string; team1: string; team2: string }[]) ?? []).map((m) => [
      m.id,
      `${m.team1} – ${m.team2}`,
    ])
  );
  const groups = new Map<
    string,
    { time: string; total: number; items: { name: string; amount: number; label: string }[] }
  >();
  for (const r of (rewards as Reward[]) ?? []) {
    const g = groups.get(r.created_at) ?? { time: r.created_at, total: 0, items: [] };
    const amt = Number(r.amount);
    g.total += amt;
    g.items.push({
      name: r.player_name,
      amount: amt,
      label: r.match_id
        ? label.get(r.match_id) ?? ""
        : r.pay_date
        ? `ngày ${dayLabel(r.pay_date)}`
        : "",
    });
    groups.set(r.created_at, g);
  }
  return [...groups.values()].sort((a, b) => (a.time < b.time ? 1 : -1));
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
