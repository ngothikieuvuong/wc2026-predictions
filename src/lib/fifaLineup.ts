// Fetch lineups (starting XI + bench + coach + cards) for a match from FIFA.
// Server-only (FIFA API is not CORS-friendly). Free, no key.

import { viTeam } from "./fifa";

const UA = { "User-Agent": "Mozilla/5.0" };
const pairKey = (a: string, b: string) =>
  [a.toLowerCase(), b.toLowerCase()].sort().join("|");
const nm = (arr: { Description?: string }[] | undefined) => arr?.[0]?.Description ?? "";

export type LineupPlayer = { num: number; name: string; captain: boolean };
export type TeamLineup = {
  name: string;
  coach: string;
  xi: LineupPlayer[];
  bench: LineupPlayer[];
  cards: { name: string; card: string; minute: string }[];
};
export type MatchInfo =
  | { home: TeamLineup; away: TeamLineup; lineupReady: boolean }
  | { error: string };

export async function getMatchInfo(team1: string, team2: string): Promise<MatchInfo> {
  const calUrl =
    "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200" +
    "&idCompetition=17&idSeason=285023&from=2026-06-01T00:00:00Z&to=2026-07-31T00:00:00Z";
  const cal = await (await fetch(calUrl, { headers: UA, next: { revalidate: 600 } })).json();
  const want = pairKey(team1, team2);
  const fm = (cal.Results ?? []).find((m: any) => {
    const h = viTeam(m.Home?.IdCountry);
    const a = viTeam(m.Away?.IdCountry);
    return h && a && pairKey(h, a) === want;
  });
  if (!fm) return { error: "Không tìm thấy trận." };

  const liveUrl = `https://api.fifa.com/api/v3/live/football/17/285023/${fm.IdStage}/${fm.IdMatch}?language=en`;
  const live = await (await fetch(liveUrl, { headers: UA, next: { revalidate: 120 } })).json();

  const build = (t: any, viName: string): TeamLineup => {
    const players: any[] = t?.Players ?? [];
    const mk = (p: any): LineupPlayer => ({
      num: p.ShirtNumber ?? 0,
      name: nm(p.PlayerName) || nm(p.ShortName) || "?",
      captain: !!p.Captain,
    });
    const byNum = (a: LineupPlayer, b: LineupPlayer) => a.num - b.num;
    const xi = players.filter((p) => p.Status === 1).map(mk).sort(byNum);
    const bench = players.filter((p) => p.Status === 2).map(mk).sort(byNum);
    const byId = new Map(players.map((p) => [p.IdPlayer, mk(p)]));
    const coach =
      nm(t?.Coaches?.[0]?.Name) || nm(t?.Coaches?.[0]?.Alias) || "";
    const cards = (t?.Bookings ?? []).map((bk: any) => ({
      name: byId.get(bk.IdPlayer)?.name ?? "?",
      card: bk.Card === 1 ? "🟨" : "🟥",
      minute: bk.Minute ?? "",
    }));
    return { name: viName, coach, xi, bench, cards };
  };

  const home = build(live.HomeTeam, viTeam(fm.Home?.IdCountry));
  const away = build(live.AwayTeam, viTeam(fm.Away?.IdCountry));
  return { home, away, lineupReady: home.xi.length >= 11 && away.xi.length >= 11 };
}
