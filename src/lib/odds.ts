// Scrapes reference odds (kèo chấp / tài xỉu) from kqbd.mobi. Used only via the
// /api/odds server route (the page blocks cross-origin browser fetches).
// Team names on the source are already Vietnamese, so they match our schedule
// after light normalization. Odds change constantly — treat as a snapshot.

export type OddsRow = {
  home: string;
  away: string;
  day: string; // "DD/MM" as shown on the source
  hour: string; // "HH:MM"
  hcLine: string; // Asian handicap line, e.g. "2.5/3"
  hcHome: string; // handicap odds for home
  hcAway: string; // handicap odds for away
  ouLine: string; // over/under line, e.g. "3.5"
  over: string; // over odds
  under: string; // under odds
};

const SOURCE = "https://kqbd.mobi/keo-bong-da";

// Parse the full-match Kèo chấp + Tài xỉu for every match block in the page.
export function parseOdds(html: string): OddsRow[] {
  const blocks = html.split("box-info-table");
  const out: OddsRow[] = [];
  let lastDay = "";
  const redRe =
    /ratio-red"[^>]*>\s*(?:<span>)?\s*([^<]*?)\s*(?:<\/span>)?\s*<\/div>/g;
  const blackRe =
    /ratio-black"[^>]*>\s*(?:<span>)?\s*([^<]*?)\s*(?:<\/span>)?\s*<\/div>/g;

  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const home = b.match(/name-clb-green">([^<]+)/);
    const away = b.match(/name-clb-black">([^<]+)/);
    if (!home || !away) continue;

    // First column-ratio-bet block = full match ("Cả trận"); ignore half-time.
    const parts = b.split("column-ratio-bet");
    const full = parts.length > 1 ? parts[1] : b;
    const reds = [...full.matchAll(redRe)].map((m) => m[1].trim());
    const blacks = [...full.matchAll(blackRe)].map((m) => m[1].trim());

    const day = b.match(/day-bet-time">([^<]*)/);
    const hour = b.match(/hour-bet-time">([^<]*)/);
    const d = (day && day[1].trim()) || lastDay;
    lastDay = d;

    out.push({
      home: home[1].trim(),
      away: away[1].trim(),
      day: d,
      hour: hour ? hour[1].trim() : "",
      hcLine: reds[0] || reds[1] || "",
      hcHome: blacks[0] || "",
      hcAway: blacks[1] || "",
      ouLine: reds[2] || "",
      over: blacks[2] || "",
      under: blacks[3] || "",
    });
  }
  return out;
}

export async function fetchOdds(): Promise<OddsRow[]> {
  const res = await fetch(SOURCE, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "Accept-Language": "vi,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`kqbd HTTP ${res.status}`);
  const html = await res.text();
  return parseOdds(html);
}

// Loose key for matching team names across sources: drop accents, đ→d, and
// anything that isn't a letter/digit.
export function normTeam(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Find the odds row for a match by team pair, regardless of home/away order.
export function findOdds(
  rows: OddsRow[],
  team1: string,
  team2: string
): OddsRow | null {
  const want = new Set([normTeam(team1), normTeam(team2)]);
  for (const r of rows) {
    const got = new Set([normTeam(r.home), normTeam(r.away)]);
    if (got.size === want.size && [...want].every((w) => got.has(w))) return r;
  }
  return null;
}
