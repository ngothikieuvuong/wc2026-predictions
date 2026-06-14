"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { MatchInfo, TeamLineup } from "@/lib/fifaLineup";

function Team({ t }: { t: TeamLineup }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="font-bold">{t.name}</p>

      {t.xi.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-grass">
            Đội hình ra sân
          </p>
          <ul className="mt-1 grid grid-cols-1 gap-x-3 text-sm">
            {t.xi.map((p) => (
              <li key={p.num} className="flex gap-2">
                <span className="w-6 shrink-0 text-right text-white/40">{p.num}</span>
                <span>
                  {p.name}
                  {p.captain && <span className="text-amber-300"> (C)</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-white/50">Đội hình chưa công bố.</p>
      )}

      {t.bench.length > 0 && (
        <p className="mt-2 text-xs text-white/40">
          <span className="font-semibold">Dự bị:</span>{" "}
          {t.bench.map((p) => p.name).join(", ")}
        </p>
      )}

      {t.cards.length > 0 && (
        <p className="mt-1 text-xs text-white/50">
          {t.cards.map((c, i) => (
            <span key={i} className="mr-2">
              {c.card} {c.name} {c.minute}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export default function MatchInfoButton({
  team1,
  team2,
  children,
}: {
  team1: string;
  team2: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MatchInfo | null>(null);

  async function show() {
    setOpen(true);
    setData(null);
    try {
      const res = await fetch(
        `/api/match-info?t1=${encodeURIComponent(team1)}&t2=${encodeURIComponent(team2)}`
      );
      setData(await res.json());
    } catch {
      setData({ error: "Lỗi kết nối" });
    }
  }

  const err = data && "error" in data ? data.error : null;
  const info = data && "home" in data ? data : null;

  return (
    <>
      <button onClick={show} className="block w-full text-left">
        {children}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {team1} <span className="text-white/40">vs</span> {team2}
                </h2>
                <button
                  className="text-2xl leading-none text-white/50 hover:text-white"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>

              {data === null ? (
                <p className="text-white/40">Đang tải đội hình…</p>
              ) : err ? (
                <p className="text-white/50">Chưa có thông tin trận này.</p>
              ) : info ? (
                <div className="space-y-3">
                  {!info.lineupReady && (
                    <p className="text-xs text-white/40">
                      Đội hình chính thức thường công bố ~1 giờ trước trận. Dưới đây
                      là đội hình dự kiến.
                    </p>
                  )}
                  <Team t={info.home} />
                  <Team t={info.away} />
                  <p className="text-center text-[11px] text-white/30">
                    Nguồn: FIFA · chỉ để tham khảo
                  </p>
                </div>
              ) : null}

              <button className="btn mt-4 w-full" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
