"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DEMO } from "@/lib/supabase";
import RulesButton from "@/components/RulesButton";

const SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET;

// The two tabs shown on every page.
const mainTabs = [
  { href: "/", label: "🏠 Trang chủ" },
  { href: "/predictions", label: "👥 Mọi người đoán" },
];

// Everything else lives in the menu.
const menuLinks = [
  { href: "/predict", label: "⚽ Đoán ngay" },
  { href: "/giai", label: "📅 Lịch & Kết quả" },
  { href: "/leaderboard", label: "🏆 Tổng kết" },
  { href: "/history", label: "📜 Lịch sử chia quỹ" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click / route change.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function goAdmin() {
    setMenuOpen(false);
    const p = window.prompt("Nhập mật khẩu:");
    if (p === null) return;
    if (p === "123") router.push(`/admin/${SECRET}`);
    else alert("Sai mật khẩu");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto max-w-3xl px-3">
        {/* Brand + menu */}
        <div className="flex items-center justify-between py-2.5">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight"
          >
            <span className="text-xl">🏆</span>
            <span>Nhà Tiên Tri WC</span>
            {DEMO && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Bản thử
              </span>
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Menu"
            >
              ☰
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur">
                {menuLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className={`block px-4 py-3 text-sm font-medium transition hover:bg-white/10 ${
                      pathname === l.href ? "bg-grass/15 text-grass" : "text-white/80"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
                <RulesButton className="block w-full px-4 py-3 text-left text-sm font-medium text-white/80 transition hover:bg-white/10">
                  📖 Luật chơi
                </RulesButton>
                <button
                  onClick={goAdmin}
                  className="block w-full border-t border-white/10 px-4 py-3 text-left text-sm font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  ⚙️ Quản trị
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Two main tabs — on every page */}
        <nav className="flex gap-1 pb-2">
          {mainTabs.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  active ? "bg-grass text-black" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
