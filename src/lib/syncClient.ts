// Auto-pull finished scores from FIFA on page load (once per load, cached),
// so results refresh by reloading the page — no manual button needed.
// Returns true if any match score was updated.
let p: Promise<boolean> | null = null;

export function autoSync(): Promise<boolean> {
  if (!p) {
    p = fetch("/api/sync", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !!j?.ok && ((Array.isArray(j.updated) && j.updated.length > 0) || j.imported > 0))
      .catch(() => false);
  }
  return p;
}

// Force a fresh sync (bypasses the per-load cache) — for the manual refresh
// button. Stores the new promise so a later autoSync() reuses it.
export function runSync(): Promise<boolean> {
  p = fetch("/api/sync", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => !!j?.ok && ((Array.isArray(j.updated) && j.updated.length > 0) || j.imported > 0))
    .catch(() => false);
  return p;
}
