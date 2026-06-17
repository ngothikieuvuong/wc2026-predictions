// Client helper for the on-demand /api/team-news route (injuries + lineups).
export type TeamNews = {
  found: boolean;
  kickoff?: string;
  injuries: { team: string; player: string; reason: string }[];
  lineups: { team: string; formation: string; xi: string[] }[];
};

export type TeamNewsResult =
  | ({ ok: true } & TeamNews)
  | { ok: false; reason: string };

export async function getTeamNews(
  team1: string,
  team2: string
): Promise<TeamNewsResult> {
  try {
    const r = await fetch(
      `/api/team-news?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(
        team2
      )}`
    );
    return (await r.json()) as TeamNewsResult;
  } catch {
    return { ok: false, reason: "error" };
  }
}
