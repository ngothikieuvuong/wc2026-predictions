"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getStats } from "@/lib/queries";
import { getTheme } from "@/lib/admin";

type Ctx = {
  profile: string | null;
  setProfile: (n: string | null) => void;
  net: number | null; // current profile's lời/lỗ (null until known / no profile)
};
const ProfileCtx = createContext<Ctx>({
  profile: null,
  setProfile: () => {},
  net: null,
});
export const useProfile = () => useContext(ProfileCtx);

const KEY = "wc-profile";

function applyTheme(t: "green" | "red") {
  const el = document.documentElement;
  if (t === "red") el.setAttribute("data-theme", "red");
  else el.removeAttribute("data-theme");
}

// Holds the per-device "profile" (which player is using this device) in
// localStorage, and auto-skins the app from it: a losing profile → red, a
// winning/even profile → green. With no profile, falls back to the admin theme.
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setP] = useState<string | null>(null);
  const [net, setNet] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setP(localStorage.getItem(KEY));
    setReady(true);
  }, []);

  const setProfile = (n: string | null) => {
    if (n) localStorage.setItem(KEY, n);
    else localStorage.removeItem(KEY);
    setP(n);
  };

  // Re-skin whenever the profile changes (and on first load).
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      if (profile) {
        try {
          const stats = await getStats();
          const me = stats.find(
            (s) => s.name.toLowerCase() === profile.toLowerCase()
          );
          if (alive) {
            setNet(me ? me.loiLo : 0);
            applyTheme(me && me.loiLo < 0 ? "red" : "green");
          }
          return;
        } catch {
          /* fall through to admin theme */
        }
      }
      if (alive) setNet(null);
      const t = await getTheme();
      if (alive) applyTheme(t);
    })();
    return () => {
      alive = false;
    };
  }, [profile, ready]);

  return (
    <ProfileCtx.Provider value={{ profile, setProfile, net }}>
      {children}
    </ProfileCtx.Provider>
  );
}
