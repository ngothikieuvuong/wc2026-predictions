import type { LiveScore } from "./fifa";

// Fetch live scores once per page load (cached promise) via our server route.
let cache: Promise<LiveScore[]> | null = null;

export function getLive(): Promise<LiveScore[]> {
  if (!cache) {
    cache = fetch("/api/live")
      .then((r) => r.json())
      .then((j) => (j.ok ? (j.live as LiveScore[]) : []))
      .catch(() => []);
  }
  return cache;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Find a live score for a match by team pair, oriented to our team1/team2.
export function findLive(
  rows: LiveScore[],
  team1: string,
  team2: string
): { t1: number; t2: number; minute: string } | null {
  const a = norm(team1);
  const b = norm(team2);
  for (const r of rows) {
    const h = norm(r.home);
    const w = norm(r.away);
    if ((h === a && w === b) || (h === b && w === a)) {
      const swap = h !== a; // FIFA home is our team2
      return {
        t1: swap ? r.awayScore : r.homeScore,
        t2: swap ? r.homeScore : r.awayScore,
        minute: r.minute,
      };
    }
  }
  return null;
}

export type { LiveScore } from "./fifa";
