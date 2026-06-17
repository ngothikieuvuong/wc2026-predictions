// Server-only. Pulls injuries + projected lineups from API-Football
// (api-sports.io). Requires the API_FOOTBALL_KEY env var; the league/season
// default to the 2026 FIFA World Cup but can be overridden via env.
//
// Free tier ≈ 100 requests/day, so this is only ever called on demand. The
// full fixture list is cached per warm instance to spend at most ~1 request on
// lookup, then 2 (injuries + lineups) per match viewed.

const KEY = process.env.API_FOOTBALL_KEY;
const BASE = "https://v3.football.api-sports.io";
const LEAGUE = process.env.API_FOOTBALL_LEAGUE || "1"; // FIFA World Cup
const SEASON = process.env.API_FOOTBALL_SEASON || "2026";

// Our Vietnamese team names → English aliases used by API-Football. Matching is
// accent-insensitive and tolerant (equality or containment), so a few aliases
// cover the naming variants between sources.
const EN: Record<string, string[]> = {
  "Ả Rập Xê Út": ["Saudi Arabia"],
  "Ai Cập": ["Egypt"],
  Algeria: ["Algeria"],
  Anh: ["England"],
  Áo: ["Austria"],
  Argentina: ["Argentina"],
  Bỉ: ["Belgium"],
  "Bờ Biển Ngà": ["Ivory Coast", "Cote d'Ivoire"],
  "Bồ Đào Nha": ["Portugal"],
  "Bosnia & Herzegovina": ["Bosnia and Herzegovina", "Bosnia"],
  Brazil: ["Brazil"],
  Canada: ["Canada"],
  "Cape Verde": ["Cape Verde Islands", "Cape Verde", "Cabo Verde"],
  "CH Séc": ["Czech Republic", "Czechia"],
  "CHDC Congo": ["Congo DR", "DR Congo", "Congo-Kinshasa"],
  Colombia: ["Colombia"],
  Croatia: ["Croatia"],
  Curaçao: ["Curacao"],
  Đức: ["Germany"],
  Ecuador: ["Ecuador"],
  Ghana: ["Ghana"],
  "Hà Lan": ["Netherlands"],
  Haiti: ["Haiti"],
  "Hàn Quốc": ["South Korea", "Korea Republic"],
  Iran: ["Iran"],
  Iraq: ["Iraq"],
  Jordan: ["Jordan"],
  Maroc: ["Morocco"],
  Mexico: ["Mexico"],
  Mỹ: ["USA", "United States"],
  "Na Uy": ["Norway"],
  "Nam Phi": ["South Africa"],
  "New Zealand": ["New Zealand"],
  "Nhật Bản": ["Japan"],
  Panama: ["Panama"],
  Paraguay: ["Paraguay"],
  Pháp: ["France"],
  Qatar: ["Qatar"],
  Scotland: ["Scotland"],
  Senegal: ["Senegal"],
  "Tây Ban Nha": ["Spain"],
  "Thổ Nhĩ Kỳ": ["Turkey", "Turkiye"],
  "Thụy Điển": ["Sweden"],
  "Thụy Sĩ": ["Switzerland"],
  Tunisia: ["Tunisia"],
  Úc: ["Australia"],
  Uruguay: ["Uruguay"],
  Uzbekistan: ["Uzbekistan"],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

function teamMatches(apiName: string, vn: string): boolean {
  const a = norm(apiName);
  const aliases = EN[vn] ?? [vn];
  return aliases.some((al) => {
    const n = norm(al);
    return n === a || (n.length >= 4 && (a.includes(n) || n.includes(a)));
  });
}

async function call(path: string): Promise<unknown[]> {
  const res = await fetch(BASE + path, {
    headers: { "x-apisports-key": KEY as string },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`api-football ${res.status}`);
  const j = (await res.json()) as { response?: unknown[] };
  return j.response ?? [];
}

// Cache the (slow-moving) fixture list per warm instance to save quota.
let fxCache: { at: number; data: any[] } | null = null;
async function fixtures(now: number): Promise<any[]> {
  if (fxCache && now - fxCache.at < 3_600_000) return fxCache.data;
  const data = (await call(
    `/fixtures?league=${LEAGUE}&season=${SEASON}`
  )) as any[];
  fxCache = { at: now, data };
  return data;
}

export type TeamNews = {
  found: boolean;
  kickoff?: string;
  injuries: { team: string; player: string; reason: string }[];
  lineups: { team: string; formation: string; xi: string[] }[];
};

export async function getTeamNews(
  team1: string,
  team2: string,
  now: number
): Promise<TeamNews> {
  if (!KEY) throw new Error("missing-key");
  const fx = await fixtures(now);
  const f = fx.find((x) => {
    const h = x?.teams?.home?.name;
    const a = x?.teams?.away?.name;
    if (!h || !a) return false;
    return (
      (teamMatches(h, team1) && teamMatches(a, team2)) ||
      (teamMatches(h, team2) && teamMatches(a, team1))
    );
  });
  if (!f) return { found: false, injuries: [], lineups: [] };

  const fid = f.fixture?.id;
  const [injR, lnR] = await Promise.all([
    call(`/injuries?fixture=${fid}`).catch(() => [] as unknown[]),
    call(`/fixtures/lineups?fixture=${fid}`).catch(() => [] as unknown[]),
  ]);

  const injuries = (injR as any[]).map((i) => ({
    team: i?.team?.name ?? "",
    player: i?.player?.name ?? "",
    reason: i?.player?.reason ?? i?.player?.type ?? "",
  }));
  const lineups = (lnR as any[]).map((l) => ({
    team: l?.team?.name ?? "",
    formation: l?.formation ?? "",
    xi: ((l?.startXI ?? []) as any[])
      .map((p) => p?.player?.name)
      .filter(Boolean),
  }));

  return { found: true, kickoff: f.fixture?.date, injuries, lineups };
}
