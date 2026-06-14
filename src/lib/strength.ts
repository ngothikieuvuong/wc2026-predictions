// Rough relative strength (approx. FIFA ranking) per team — REFERENCE ONLY,
// to hint who's favored. Not betting odds. Keyed by our Vietnamese team names.
const RANK: Record<string, number> = {
  Argentina: 1,
  "Tây Ban Nha": 2,
  Pháp: 3,
  Anh: 4,
  "Bồ Đào Nha": 5,
  "Hà Lan": 6,
  Brazil: 7,
  Bỉ: 8,
  Đức: 9,
  Croatia: 10,
  Maroc: 12,
  Colombia: 13,
  Uruguay: 14,
  Mexico: 15,
  Mỹ: 16,
  "Nhật Bản": 17,
  Senegal: 18,
  "Thụy Sĩ": 19,
  Iran: 20,
  Áo: 22,
  "Hàn Quốc": 23,
  Úc: 24,
  Ecuador: 25,
  "Na Uy": 28,
  "Thụy Điển": 30,
  Panama: 31,
  "Ai Cập": 33,
  Qatar: 36,
  Scotland: 38,
  "Bờ Biển Ngà": 40,
  Tunisia: 41,
  "CH Séc": 42,
  Algeria: 43,
  Paraguay: 45,
  Iraq: 55,
  "CHDC Congo": 56,
  "Ả Rập Xê Út": 58,
  "Nam Phi": 60,
  Jordan: 62,
  "Cape Verde": 68,
  Ghana: 70,
  "Bosnia & Herzegovina": 74,
  Curaçao: 88,
  "New Zealand": 89,
  Haiti: 90,
  Uzbekistan: 52,
  "Thổ Nhĩ Kỳ": 26,
  Canada: 27,
};

// Approx. FIFA rank for a team (null if unknown).
export function teamRank(name: string): number | null {
  return RANK[name] ?? null;
}

// Returns a short, neutral reference line for a match, or null if unknown.
export function matchHint(team1: string, team2: string): {
  stronger: string;
  rank1: number;
  rank2: number;
  level: string;
} | null {
  const r1 = RANK[team1];
  const r2 = RANK[team2];
  if (r1 == null || r2 == null) return null;

  const gap = Math.abs(r1 - r2);
  const stronger = r1 < r2 ? team1 : team2;

  let level: string;
  if (gap <= 6) level = "cân sức";
  else if (gap <= 20) level = `${stronger} nhỉnh hơn`;
  else if (gap <= 45) level = `${stronger} mạnh hơn`;
  else level = `${stronger} vượt trội`;

  return { stronger, rank1: r1, rank2: r2, level };
}
