"use client";

import { useEffect, useState } from "react";
import { getJustWon } from "@/lib/queries";
import { Money } from "@/components/Money";

type Data = Awaited<ReturnType<typeof getJustWon>>;

// "Tiền về tiền về" celebration after a chốt — shows the latest settlement's
// winners (and the match they nailed) until the next match kicks off.
export default function JustWonBanner() {
  const [data, setData] = useState<Data | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    getJustWon().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  // Auto-hide the moment the next match kicks off.
  useEffect(() => {
    if (!data?.until) return;
    const ms = new Date(data.until).getTime() - Date.now();
    if (ms <= 0) {
      setHidden(true);
      return;
    }
    const t = setTimeout(() => setHidden(true), ms);
    return () => clearTimeout(t);
  }, [data]);

  if (!data || data.wins.length === 0 || hidden) return null;

  return (
    <section className="card border-neon/50 bg-gradient-to-br from-neon/15 to-grass/5 shadow-glow">
      <p className="text-center text-base font-extrabold tracking-wide text-neon">
        💸 Tiền về tiền về 💸
      </p>
      <ul className="mt-2 space-y-1.5">
        {data.wins.map((w, i) => (
          <li key={i} className="text-center text-sm">
            🎉 <b className="text-grass">{w.player_name}</b> vừa trúng{" "}
            <b className="text-neon">
              <Money value={w.amount} />
            </b>
            {w.team1 && w.team2 ? (
              <>
                {" "}
                từ trận <b>{w.team1} – {w.team2}</b>
              </>
            ) : null}
            !
          </li>
        ))}
      </ul>
    </section>
  );
}
