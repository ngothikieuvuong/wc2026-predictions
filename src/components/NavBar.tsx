"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEMO } from "@/lib/supabase";

const links = [
  { href: "/", label: "Trang chủ" },
  { href: "/predict", label: "Dự đoán" },
  { href: "/predictions", label: "Mọi người" },
  { href: "/leaderboard", label: "Xếp hạng" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">⚽</span>
          <span>Dự đoán WC2026</span>
          {DEMO && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Bản thử
            </span>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-grass text-black" : "text-white/70 hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
