"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DEMO } from "@/lib/supabase";
import RulesButton from "@/components/RulesButton";
import { useHideMoney } from "@/components/Money";

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
  const { hidden: moneyHidden, toggle: toggleMoney } = useHideMoney();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Condense the header once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // Expose the header height so pages can pin sticky bars right under it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--nav-h",
        `${el.offsetHeight}px`
      );
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function goAdmin() {
    setMenuOpen(false);
    const p = window.prompt("Nhập mật khẩu:");
    if (p === null) return;
    if (p === "123") router.push(`/admin/${SECRET}`);
    else alert("Sai mật khẩu");
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b border-white/10 bg-[#08160e]/80 shadow-lux backdrop-blur-xl"
    >
      <div className="mx-auto max-w-3xl px-4">
        {/* Brand (centered) + menu */}
        <div
          className={`relative flex items-center justify-center transition-all duration-200 ${
            scrolled ? "py-1.5" : "py-2.5"
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="logo-float relative flex shrink-0 items-center justify-center"
              style={{ perspective: "300px" }}
            >
              <span className="logo-glow" aria-hidden />
              {/* Two trophy faces back-to-back → spins like a solid 3D object */}
              <span
                className="logo-spin relative inline-block"
                style={{ transformStyle: "preserve-3d" }}
              >
                <Image
                  src="/trophy.webp"
                  alt="World Cup 2026"
                  width={63}
                  height={141}
                  className={`block w-auto object-contain drop-shadow-[0_2px_10px_rgba(233,201,124,0.55)] transition-all duration-200 ${
                    scrolled ? "h-8" : "h-12"
                  }`}
                  style={{ backfaceVisibility: "hidden" }}
                  priority
                />
                <Image
                  src="/trophy.webp"
                  alt=""
                  aria-hidden
                  width={63}
                  height={141}
                  className="absolute left-0 top-0 block h-full w-auto object-contain drop-shadow-[0_2px_10px_rgba(233,201,124,0.55)]"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                />
              </span>
            </span>
            <span
              className={`title-lux whitespace-nowrap transition-all duration-200 ${
                scrolled ? "text-lg" : "text-2xl"
              }`}
            >
              Nhà Tiên Tri WC
            </span>
            {DEMO && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Bản thử
              </span>
            )}
          </Link>

          <div className="absolute right-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Menu"
            >
              ☰
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 shadow-lux backdrop-blur-xl">
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
                  onClick={() => {
                    toggleMoney();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-white/80 transition hover:bg-white/10"
                >
                  {moneyHidden ? "👁️ Hiện số tiền" : "🙈 Ẩn số tiền"}
                </button>
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
        <nav
          className={`flex gap-1.5 transition-all duration-200 ${
            scrolled ? "pb-1.5" : "pb-2.5"
          }`}
        >
          {mainTabs.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex-1 whitespace-nowrap rounded-xl px-3 text-center font-semibold transition-all duration-200 ${
                  scrolled ? "py-1 text-xs" : "py-2 text-sm"
                } ${
                  active
                    ? "bg-gradient-to-b from-[#28d567] to-grass text-black shadow-glow"
                    : "border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
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
