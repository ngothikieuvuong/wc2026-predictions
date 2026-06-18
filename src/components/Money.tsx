"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { formatVND } from "@/lib/format";

// Global "hide money" mode — for sharing screenshots without revealing amounts.
const Ctx = createContext<{ hidden: boolean; toggle: () => void }>({
  hidden: false,
  toggle: () => {},
});

export const useHideMoney = () => useContext(Ctx);

export function HideMoneyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem("hideMoney") === "1");
  }, []);

  const toggle = () =>
    setHidden((h) => {
      const v = !h;
      try {
        localStorage.setItem("hideMoney", v ? "1" : "0");
      } catch {}
      return v;
    });

  return <Ctx.Provider value={{ hidden, toggle }}>{children}</Ctx.Provider>;
}

// Render a money amount; masked to ••••đ when hide-money mode is on.
export function Money({ value }: { value: number }) {
  const { hidden } = useHideMoney();
  if (hidden)
    return <span className="select-none tracking-wider">••••$</span>;
  return <>{formatVND(value)}</>;
}
