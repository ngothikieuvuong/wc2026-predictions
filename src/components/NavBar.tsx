"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DEMO } from "@/lib/supabase";
import RulesButton from "@/components/RulesButton";

const SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET;

const links = [
  { href: "/predict", label: "Đoán" },
  { href: "/predictions", label: "Mọi người" },
  { href: "/leaderboard", label: "Tổng kết" },
  { href: "/giai", label: "Lịch & KQ" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  function goAdmin() {
    const p = window.prompt("Nhập mật khẩu:");
    if (p === null) return;
    if (p === "123") router.push(`/admin/${SECRET}`);
    else alert("Sai mật khẩu");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto max-w-3xl px-3">
        {/* Brand + admin */}
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
          <button
            onClick={goAdmin}
            className="shrink-0 rounded-lg px-2 py-1 text-lg text-white/50 transition hover:text-white"
            title="Quản trị"
            aria-label="Quản trị"
          >
            ⚙️
          </button>
        </div>

        {/* Nav — horizontal, scrolls if it doesn't fit */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-grass text-black" : "text-white/70 hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <RulesButton className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10">
            📖 Luật
          </RulesButton>
        </nav>
      </div>
    </header>
  );
}
