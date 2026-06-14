"use client";

import { useRouter } from "next/navigation";

const SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET;

// Tiny footer link to the admin page. The "123" prompt is only a misclick
// guard (not real security) — the real gate is the secret URL segment.
export default function AdminLink() {
  const router = useRouter();

  function go() {
    const p = window.prompt("Nhập mật khẩu:");
    if (p === null) return;
    if (p === "123") {
      router.push(`/admin/${SECRET}`);
    } else {
      alert("Sai mật khẩu");
    }
  }

  return (
    <button
      onClick={go}
      className="text-white/20 underline transition hover:text-white/50"
    >
      Quản trị
    </button>
  );
}
