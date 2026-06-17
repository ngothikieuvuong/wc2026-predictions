"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MatchDetails from "@/components/MatchDetails";
import Modal from "@/components/Modal";
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

  // Close the popup first, then navigate after the close animation — smoother
  // than a hard cut straight to the next page.
  const goToPredictions = () => {
    setOpen(false);
    setTimeout(() => router.push(`/predictions#${matchSlug(team1, team2)}`), 120);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      {open && (
        <Modal
          title={
            <>
              {team1} <span className="text-white/40">vs</span> {team2}
            </>
          }
          onClose={() => setOpen(false)}
        >
          {showPredictionsLink && (
            <button className="btn mb-3 w-full" onClick={goToPredictions}>
              👥 Xem các dự đoán
            </button>
          )}

          <MatchDetails team1={team1} team2={team2} started={started} />
        </Modal>
      )}
    </>
  );
}
