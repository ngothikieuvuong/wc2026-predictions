// Fetch lineups + card suspensions for a match from FIFA (free, no key, server-only).
import { viTeam } from "./fifa";

const UA = { "User-Agent": "Mozilla/5.0" };
const pairKey = (a: string, b: string) =>
  [a.toLowerCase(), b.toLowerCase()].sort().join("|");
const nm = (arr: { Description?: string }[] | undefined) => arr?.[0]?.Description ?? "";
const liveUrl = (stage: string, match: string) =>
  `https://api.fifa.com/api/v3/live/football/17/285023/${stage}/${match}?language=en`;

export type LineupPlayer = { num: number; name: string; captain: boolean };
export type TeamLineup = {
  name: string;
  xi: LineupPlayer[];
  bench: LineupPlayer[];
  suspended: { name: string; reason: string }[];
};
export type MatchInfo =
  | { home: TeamLineup; away: TeamLineup; lineupReady: boolean }
  | { error: string };

const playerName = (p: any) => nm(p.PlayerName) || nm(p.ShortName) || "?";

// Players banned (by cards) for the upcoming match = red / second-yellow in the
// team's most recent match, or a 2nd accumulated yellow there.
async function teamSuspensions(
  idTeam: string,
  finished: { IdStage: string; IdMatch: string; Date: string }[]
): Promise<{ name: string; reason: string }[]> {
  if (finished.length === 0) return [];
  const sorted = [...finished].sort((a, b) => (a.Date < b.Date ? -1 : 1));
  const last = sorted[sorted.length - 1];

  const sideOf = (d: any) =>
    [d.HomeTeam, d.AwayTeam].find((t: any) => t?.IdTeam === idTeam);

  // Yellows in earlier matches (for 2-yellow accumulation).
  const priorYellow = new Map<string, number>();
  for (const m of sorted.slice(0, -1)) {
    const d = await (await fetch(liveUrl(m.IdStage, m.IdMatch), { headers: UA, next: { revalidate: 86400 } })).json();
    const side = sideOf(d);
    for (const bk of side?.Bookings ?? []) {
      if (bk.Card === 1 && bk.IdPlayer)
        priorYellow.set(bk.IdPlayer, (priorYellow.get(bk.IdPlayer) ?? 0) + 1);
    }
  }

  const dLast = await (await fetch(liveUrl(last.IdStage, last.IdMatch), { headers: UA, next: { revalidate: 86400 } })).json();
  const side = sideOf(dLast);
  if (!side) return [];
  const nameById = new Map<string, string>(
    (side.Players ?? []).map((p: any) => [p.IdPlayer, playerName(p)])
  );

  const out = new Map<string, { name: string; reason: string }>();
  for (const bk of side.Bookings ?? []) {
    const id = bk.IdPlayer;
    if (!id) continue;
    const name = nameById.get(id) ?? "?";
    if (bk.Card >= 2) {
      out.set(id, { name, reason: "🟥 thẻ đỏ" });
    } else if (bk.Card === 1 && (priorYellow.get(id) ?? 0) >= 1) {
      if (!out.has(id)) out.set(id, { name, reason: "🟨🟨 2 thẻ vàng" });
    }
  }
  return [...out.values()];
}

// ---- Live match detail (score, minute, goals, cards, possession) -----------

export type LiveGoal = { player: string; minute: string; note?: string };
export type LiveCard = { player: string; minute: string; red: boolean };
export type TeamLiveDetail = {
  name: string;
  score: number;
  goals: LiveGoal[];
  cards: LiveCard[];
};
export type MatchLive =
  | {
      found: true;
      status: number; // FIFA: 0 finished, 1 scheduled, 3 live
      minute: string;
      possession: { home: number; away: number } | null;
      home: TeamLiveDetail;
      away: TeamLiveDetail;
    }
  | { found: false };

const CAL_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200" +
  "&idCompetition=17&idSeason=285023&from=2026-06-01T00:00:00Z&to=2026-07-31T00:00:00Z";

export async function getMatchLive(
  team1: string,
  team2: string
): Promise<MatchLive> {
  const cal = await (await fetch(CAL_URL, { headers: UA, next: { revalidate: 60 } })).json();
  const all: any[] = cal.Results ?? [];
  const want = pairKey(team1, team2);
  const fm = all.find((m) => {
    const h = viTeam(m.Home?.IdCountry);
    const a = viTeam(m.Away?.IdCountry);
    return h && a && pairKey(h, a) === want;
  });
  if (!fm) return { found: false };

  const live = await (
    await fetch(liveUrl(fm.IdStage, fm.IdMatch), { headers: UA, next: { revalidate: 30 } })
  ).json();

  const buildSide = (side: any, viName: string): TeamLiveDetail => {
    const byId = new Map<string, string>(
      (side?.Players ?? []).map((p: any) => [p.IdPlayer, playerName(p)])
    );
    const nm2 = (id: string) => byId.get(id) ?? "?";
    const goals: LiveGoal[] = (side?.Goals ?? []).map((g: any) => ({
      player: nm2(g.IdPlayer),
      minute: g.Minute ?? "",
      note: g.Type === 2 ? "pen" : g.Type === 3 ? "phản lưới" : undefined,
    }));
    const cards: LiveCard[] = (side?.Bookings ?? []).map((b: any) => ({
      player: nm2(b.IdPlayer),
      minute: b.Minute ?? "",
      red: b.Card >= 2,
    }));
    return { name: viName, score: Number(side?.Score ?? 0), goals, cards };
  };

  // Ball possession comes in a few shapes across FIFA feeds; read defensively.
  let possession: { home: number; away: number } | null = null;
  const bp = live.BallPossession;
  if (bp && typeof bp.OverallHome === "number" && typeof bp.OverallAway === "number") {
    possession = { home: Math.round(bp.OverallHome), away: Math.round(bp.OverallAway) };
  } else if (bp && typeof bp.Home === "number" && typeof bp.Away === "number") {
    possession = { home: Math.round(bp.Home), away: Math.round(bp.Away) };
  }

  return {
    found: true,
    status: typeof live.MatchStatus === "number" ? live.MatchStatus : fm.MatchStatus,
    minute: typeof live.MatchTime === "string" ? live.MatchTime : fm.MatchTime ?? "",
    possession,
    home: buildSide(live.HomeTeam, viTeam(fm.Home?.IdCountry)),
    away: buildSide(live.AwayTeam, viTeam(fm.Away?.IdCountry)),
  };
}

export async function getMatchInfo(team1: string, team2: string): Promise<MatchInfo> {
  const calUrl =
    "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200" +
    "&idCompetition=17&idSeason=285023&from=2026-06-01T00:00:00Z&to=2026-07-31T00:00:00Z";
  const cal = await (await fetch(calUrl, { headers: UA, next: { revalidate: 600 } })).json();
  const all: any[] = cal.Results ?? [];
  const want = pairKey(team1, team2);
  const fm = all.find((m) => {
    const h = viTeam(m.Home?.IdCountry);
    const a = viTeam(m.Away?.IdCountry);
    return h && a && pairKey(h, a) === want;
  });
  if (!fm) return { error: "Không tìm thấy trận." };

  const live = await (await fetch(liveUrl(fm.IdStage, fm.IdMatch), { headers: UA, next: { revalidate: 120 } })).json();

  const finishedOf = (idTeam: string) =>
    all
      .filter(
        (m) =>
          m.MatchStatus === 0 &&
          (m.Home?.IdTeam === idTeam || m.Away?.IdTeam === idTeam)
      )
      .map((m) => ({ IdStage: m.IdStage, IdMatch: m.IdMatch, Date: m.Date }));

  const build = async (t: any, fmSide: any, viName: string): Promise<TeamLineup> => {
    const players: any[] = t?.Players ?? [];
    const mk = (p: any): LineupPlayer => ({
      num: p.ShirtNumber ?? 0,
      name: playerName(p),
      captain: !!p.Captain,
    });
    const byNum = (a: LineupPlayer, b: LineupPlayer) => a.num - b.num;
    const xi = players.filter((p) => p.Status === 1).map(mk).sort(byNum);
    const bench = players.filter((p) => p.Status === 2).map(mk).sort(byNum);
    const suspended = fmSide?.IdTeam
      ? await teamSuspensions(fmSide.IdTeam, finishedOf(fmSide.IdTeam))
      : [];
    return { name: viName, xi, bench, suspended };
  };

  const [home, away] = await Promise.all([
    build(live.HomeTeam, fm.Home, viTeam(fm.Home?.IdCountry)),
    build(live.AwayTeam, fm.Away, viTeam(fm.Away?.IdCountry)),
  ]);

  return { home, away, lineupReady: home.xi.length >= 11 && away.xi.length >= 11 };
}
