"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { runSync } from "@/lib/syncClient";
import { resetLive } from "@/lib/liveClient";

// Global "cập nhật tỉ số" — pulls fresh FIFA scores and nudges every listening
// page to re-fetch, so people don't have to reload. `tick` bumps on each
// refresh; pages include it in their data-loading effect deps.
const Ctx = createContext<{ tick: number; busy: boolean; refresh: () => void }>({
  tick: 0,
  busy: false,
  refresh: () => {},
});

export const useRefresh = () => useContext(Ctx);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runSync(); // pull FIFA → DB
    } catch {}
    resetLive(); // bust live cache so getLive() refetches
    setTick((t) => t + 1); // re-fetch client pages listening on tick
    router.refresh(); // refresh server-rendered data too
    setBusy(false);
  };

  return (
    <Ctx.Provider value={{ tick, busy, refresh }}>
      {children}
      <RefreshFab />
    </Ctx.Provider>
  );
}

function RefreshFab() {
  const { busy, refresh } = useRefresh();
  return (
    <button
      onClick={refresh}
      disabled={busy}
      aria-label="Cập nhật tỉ số"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-grass px-4 py-3 font-bold text-black shadow-glow transition hover:brightness-110 active:scale-95 disabled:opacity-70"
    >
      <span className={busy ? "inline-block animate-spin" : ""}>🔄</span>
      <span className="text-sm">{busy ? "Đang cập nhật…" : "Cập nhật tỉ số"}</span>
    </button>
  );
}
