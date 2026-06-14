# ⚽ WC2026 Predictor

A dead-simple private family mini-game for World Cup 2026 score predictions.
Next.js (App Router) + TypeScript + Tailwind + Supabase. No auth, no fuss.

## How it works

- Each prediction adds **20,000₫** to the jackpot.
- Predict the **exact** final score to win.
- Multiple exact winners **split the jackpot** equally.
- No winner → the jackpot **carries over** to the next paid-out match.
- Admin enters the final score and pays out from a secret URL.

## Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a project, then open
**SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
and run it.

Then (optional) load the full 72-match group-stage schedule: open a new query,
paste [`supabase/seed-matches.sql`](supabase/seed-matches.sql), and run it. Kickoff
times are in Vietnam time (UTC+7).

### 2. Configure env
```bash
cp .env.local.example .env.local
```
Fill in from **Supabase → Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ADMIN_SECRET` — any secret string; the admin page lives at `/admin/<that-secret>`

### 3. Install & run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Pages

| Path | What |
|------|------|
| `/` | Jackpot, next match, latest winner |
| `/predict` | Name + match + predicted score |
| `/leaderboard` | Wins & total reward per player |
| `/admin/<secret>` | Create/edit matches, enter scores, pay out |

## Admin flow

1. **Create match** — teams + kickoff time.
2. Family members predict at `/predict` (closes automatically at kickoff).
3. After the match, open `/admin/<secret>`, type the final score, hit
   **Enter score & pay out**.
4. Winners are computed, the jackpot is split, and everything shows up on the
   home page and leaderboard. Re-running with a corrected score safely
   recalculates.

## Notes

- One prediction per person per match is enforced by a DB unique index
  (case-insensitive on name).
- This is intentionally insecure (public anon key, secret-URL admin) — it's a
  private family game, not a production app.
