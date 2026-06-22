"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveScore } from "@/lib/liveClient";

// A compact live-score bar that freezes under the nav once you scroll down —
// keeps the in-play match(es) score + minute visible. Used on Home + Mọi người.
export default function LiveBar({ live }: { live: LiveScore[] }) {
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const show = live.length > 0 && scrolled;

  // Expose the bar's height so a stacked bar (e.g. the fund bar) can sit below.
  useEffect(() => {
    const h = show && ref.current ? ref.current.offsetHeight : 0;
    document.documentElement.style.setProperty("--live-h", `${h}px`);
    return () => document.documentElement.style.setProperty("--live-h", "0px");
  }, [show, live.length]);

  return (
    <div
      ref={ref}
      className={`fixed inset-x-0 z-20 transition-all duration-300 ${
        show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      style={{ top: "var(--nav-h)" }}
    >
      <div className="mx-auto max-w-3xl px-4">
        <div className="space-y-0.5 rounded-b-xl border border-t-0 border-red-500/30 bg-[#1a0d0d]/90 px-4 py-1.5 shadow-lux backdrop-blur-xl">
          {live.slice(0, 3).map((m, i) => {
            const fmt = (g: { player: string; minute: string; note?: string }) =>
              `${g.player} ${g.minute}${g.note ? ` (${g.note})` : ""}`.trim();
            const hg = m.homeGoals ?? [];
            const ag = m.awayGoals ?? [];
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-400" />
                  <span className="truncate font-medium text-white/80">{m.home}</span>
                  <span className="shrink-0 font-mono font-extrabold text-red-300">
                    {m.homeScore}–{m.awayScore}
                  </span>
                  <span className="truncate font-medium text-white/80">{m.away}</span>
                  {m.minute && (
                    <span className="shrink-0 font-semibold text-red-300">
                      {m.minute}
                    </span>
                  )}
                </div>
                {hg.length + ag.length > 0 && (
                  <div className="flex items-start justify-center gap-2 text-[10px] leading-tight text-white/45">
                    <span className="flex-1 truncate text-right">
                      {hg.map(fmt).join(", ")}
                    </span>
                    <span className="shrink-0 text-white/25">⚽</span>
                    <span className="flex-1 truncate">{ag.map(fmt).join(", ")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
