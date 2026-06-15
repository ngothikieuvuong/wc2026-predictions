import type { OddsRow } from "./odds";

// Fetch the scraped odds once per page load (cached promise) via our server
// route, so multiple match popups don't each re-hit the source.
let cache: Promise<OddsRow[]> | null = null;

export function getOdds(): Promise<OddsRow[]> {
  if (!cache) {
    cache = fetch("/api/odds")
      .then((r) => r.json())
      .then((j) => (j.ok ? (j.odds as OddsRow[]) : []))
      .catch(() => []);
  }
  return cache;
}

export { findOdds } from "./odds";
export type { OddsRow } from "./odds";
