"use client";

import { useEffect } from "react";
import { getTheme } from "@/lib/admin";

// Reads the admin-set site theme and applies it to <html data-theme>. Green is
// the default (no attribute); red re-skins the whole app via CSS vars.
export default function ThemeApplier() {
  useEffect(() => {
    getTheme().then((t) => {
      const el = document.documentElement;
      if (t === "red") el.setAttribute("data-theme", "red");
      else el.removeAttribute("data-theme");
    });
  }, []);
  return null;
}
