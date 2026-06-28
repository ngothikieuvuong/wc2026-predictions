"use client";

import { useEffect, useState } from "react";

type Absence = { name: string; team: string; stat: string; reason: string };

// Warns that a top-10 scorer/assister of either team is missing from the
// announced lineup. Renders nothing until the lineup is published (or if none).
export default function StarAlert({ team1, team2 }: { team1: string; team2: string }) {
  const [abs, setAbs] = useState<Absence[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(
      `/api/star-absence?t1=${encodeURIComponent(team1)}&t2=${encodeURIComponent(team2)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((j) => alive && j.ok && setAbs(j.absences ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [team1, team2]);

  if (abs.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs">
      <p className="font-bold text-amber-300">⚠️ Ngôi sao vắng mặt đội hình</p>
      <ul className="mt-1 space-y-0.5 text-amber-100/90">
        {abs.map((a, i) => (
          <li key={i}>
            <b>{a.name}</b>{" "}
            <span className="text-white/45">
              ({a.team} · {a.stat})
            </span>{" "}
            — {a.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
