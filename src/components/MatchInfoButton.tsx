"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import MatchDetails from "@/components/MatchDetails";

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

  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full text-left">
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

              <MatchDetails team1={team1} team2={team2} />

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
