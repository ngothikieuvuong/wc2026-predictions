// In-memory stand-in for the Supabase client, used only in DEMO mode
// (when no Supabase env vars are configured). It implements just enough of
// the supabase-js query-builder surface that this app uses, backed by plain
// arrays seeded with fake data. State lives for the browser session and
// resets on a hard refresh.

import { SCHEDULE } from "./schedule";

type Row = Record<string, any>;
type Store = Record<string, Row[]>;

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2);

const now = Date.now();
const hours = (h: number) => new Date(now + h * 3600_000).toISOString();

// ---- Seed data --------------------------------------------------------------

function seed(): Store {
  // All 72 group-stage matches from the real schedule (kickoff already in UTC+7).
  const matches: Row[] = SCHEDULE.map(([kickoff, team1, team2]) => ({
    id: uid(),
    team1,
    team2,
    kickoff_time: kickoff,
    home_score: null,
    away_score: null,
    status: "upcoming",
    created_at: hours(-400),
  }));

  // Mark the first three (already-played) matches as finished with scores so the
  // jackpot / leaderboard / latest-winner have something to show in demo mode.
  const f1 = matches[0]; // Mexico 2–1 Nam Phi
  const f2 = matches[1]; // Hàn Quốc 1–1 CH Séc
  const f3 = matches[2]; // Canada 3–0 Bosnia (no exact winner)
  Object.assign(f1, { home_score: 2, away_score: 1, status: "finished" });
  Object.assign(f2, { home_score: 1, away_score: 1, status: "finished" });
  Object.assign(f3, { home_score: 3, away_score: 0, status: "finished" });

  const up1 = matches[7]; // Haiti – Scotland (upcoming)
  const up2 = matches[6]; // Brazil – Maroc (upcoming)

  const pred = (
    player: string,
    matchId: string,
    h: number,
    a: number,
    ageH: number
  ): Row => ({
    id: uid(),
    player_name: player,
    match_id: matchId,
    predicted_home: h,
    predicted_away: a,
    created_at: hours(ageH),
  });

  const predictions: Row[] = [
    // F1 Mexico 2–1 Nam Phi → Minh & Khoa đoán đúng
    pred("Minh", f1.id, 2, 1, -60),
    pred("Linh", f1.id, 1, 0, -60),
    pred("Khoa", f1.id, 2, 1, -60),
    pred("Bố", f1.id, 0, 0, -60),
    // F2 Hàn Quốc 1–1 CH Séc → Trang đoán đúng
    pred("Minh", f2.id, 2, 1, -52),
    pred("Trang", f2.id, 1, 1, -52),
    pred("Huy", f2.id, 0, 2, -52),
    // F3 Canada 3–0 Bosnia → không ai đúng (cộng dồn)
    pred("An", f3.id, 1, 1, -40),
    pred("Mẹ", f3.id, 2, 2, -40),
    // Sắp diễn ra
    pred("Minh", up1.id, 2, 0, -10),
    pred("Linh", up1.id, 1, 1, -9),
    pred("Khoa", up2.id, 3, 1, -8),
    pred("An", up2.id, 2, 2, -7),
    pred("Bố", up2.id, 1, 0, -6),
  ];

  // Rewards simulated in finish order (each payout = whole pot at that moment):
  //   F1 (4 preds = 80k)  → Minh & Khoa chia đôi → 40k mỗi người
  //   F2 (7 preds − 80k paid = 60k) → Trang một mình → 60k
  //   F3 (9 preds − 140k paid = 40k) → không ai đúng → cộng dồn
  // Tổng chi 140k; tổng thu 14×20k = 280k → hũ thưởng hiện tại = 140,000₫.
  const rewards: Row[] = [
    { id: uid(), player_name: "Minh", match_id: f1.id, amount: 40000, created_at: hours(-58) },
    { id: uid(), player_name: "Khoa", match_id: f1.id, amount: 40000, created_at: hours(-58) },
    { id: uid(), player_name: "Trang", match_id: f2.id, amount: 60000, created_at: hours(-50) },
  ];

  const players: Row[] = ["Minh", "Linh", "Khoa", "Trang", "Huy", "An", "Bố", "Mẹ"].map(
    (name, i) => ({ id: uid(), name, created_at: hours(-300 + i) })
  );

  return { matches, predictions, rewards, players };
}

// ---- Query builder ----------------------------------------------------------

class Query implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: any = null;
  private _count = false;
  private _head = false;
  private _single = false;
  private _order: { col: string; ascending: boolean } | null = null;
  private _limit: number | null = null;

  constructor(private store: Store, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    this.op = "select";
    if (opts?.count) this._count = true;
    if (opts?.head) this._head = true;
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push((r) => r[col] >= val);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }
  maybeSingle() {
    this._single = true;
    return this;
  }

  private table_(): Row[] {
    return this.store[this.table] ?? (this.store[this.table] = []);
  }

  private match(): Row[] {
    return this.table_().filter((r) => this.filters.every((f) => f(r)));
  }

  private exec(): { data: any; count: number | null; error: any } {
    if (this.op === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      // Simulate the one-prediction-per-player-per-match unique index.
      if (this.table === "predictions") {
        for (const it of items) {
          const dup = this.table_().some(
            (r) =>
              r.match_id === it.match_id &&
              r.player_name.toLowerCase() === it.player_name.toLowerCase()
          );
          if (dup)
            return {
              data: null,
              count: null,
              error: { code: "23505", message: "duplicate key value" },
            };
        }
      }
      const created = items.map((it) => ({
        id: uid(),
        created_at: new Date().toISOString(),
        ...it,
      }));
      this.table_().push(...created);
      return { data: created, count: created.length, error: null };
    }

    if (this.op === "update") {
      const rows = this.match();
      rows.forEach((r) => Object.assign(r, this.payload));
      return { data: rows, count: rows.length, error: null };
    }

    if (this.op === "delete") {
      const keep = this.table_().filter(
        (r) => !this.filters.every((f) => f(r))
      );
      this.store[this.table] = keep;
      return { data: null, count: null, error: null };
    }

    // select
    let rows = this.match();
    if (this._order) {
      const { col, ascending } = this._order;
      rows = [...rows].sort((a, b) => {
        if (a[col] < b[col]) return ascending ? -1 : 1;
        if (a[col] > b[col]) return ascending ? 1 : -1;
        return 0;
      });
    }
    const count = rows.length;
    if (this._limit != null) rows = rows.slice(0, this._limit);

    if (this._head) return { data: null, count, error: null };
    if (this._single) return { data: rows[0] ?? null, count, error: null };
    return { data: rows, count, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: any) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
  }
}

export function createMockClient() {
  const store = seed();
  return {
    from(table: string) {
      return new Query(store, table);
    },
  };
}
