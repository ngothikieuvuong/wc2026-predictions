"use client";

import { useState } from "react";
import { getTeamInfo } from "@/lib/queries";
import LineupView from "@/components/LineupView";

type Info = Awaited<ReturnType<typeof getTeamInfo>>;

export default function TeamInfoButton({
  team1,
  team2,
}: {
  team1: string;
  team2: string;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);

  async function show() {
    setOpen(true);
    setInfo(null);
    setInfo(await getTeamInfo(team1, team2));
  }

  return (
    <>
      <button
        onClick={show}
        className="text-xs font-semibold text-grass underline"
      >
        ℹ️ Thêm thông tin
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Thông tin 2 đội</h2>
              <button
                className="text-2xl leading-none text-white/50 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {info === null ? (
              <p className="text-white/40">Đang tải…</p>
            ) : (
              <div className="space-y-4">
                {info.map((t) => (
                  <div key={t.team} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="font-bold">
                      {t.team}{" "}
                      <span className="text-xs font-normal text-white/40">
                        · Hạng FIFA ~{t.rank ?? "?"}
                      </span>
                    </p>
                    {t.played === 0 ? (
                      <p className="mt-1 text-sm text-white/50">
                        Chưa đá trận nào ở giải.
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-white/70">
                          Đã đá {t.played} trận: {t.w} thắng, {t.d} hòa, {t.l} thua
                          · ghi {t.gf}, thủng {t.ga}
                        </p>
                        <ul className="mt-1.5 space-y-1 text-sm">
                          {t.results.map((r, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span
                                className={`w-12 shrink-0 font-semibold ${
                                  r.res === "T"
                                    ? "text-grass"
                                    : r.res === "H"
                                    ? "text-amber-300"
                                    : "text-red-400"
                                }`}
                              >
                                {r.res === "T" ? "Thắng" : r.res === "H" ? "Hòa" : "Thua"}
                              </span>
                              <span className="text-white/70">
                                {r.opp} {r.gf}–{r.ga}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
                <p className="text-xs text-white/30">
                  Phong độ tại giải (theo kết quả chính thức). Chỉ để tham khảo.
                </p>
              </div>
            )}

            {/* Lineups */}
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Đội hình
              </p>
              <LineupView team1={team1} team2={team2} />
            </div>

            <button className="btn mt-4 w-full" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
