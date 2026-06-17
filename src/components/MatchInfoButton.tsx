"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import MatchDetails from "@/components/MatchDetails";
import { matchSlug } from "@/lib/format";

export default function MatchInfoButton({
  team1,
  team2,
  started = false,
  showPredictionsLink = true,
  children,
}: {
  team1: string;
  team2: string;
  started?: boolean;
  showPredictionsLink?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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

              {showPredictionsLink && (
                <button
                  className="btn mb-3 w-full"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/predictions#${matchSlug(team1, team2)}`);
                  }}
                >
                  👥 Xem các dự đoán
                </button>
              )}

              <MatchDetails team1={team1} team2={team2} started={started} />

              <button
                className="btn-ghost mt-4 w-full"
                onClick={() => setOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
