"use client";

import { useState } from "react";

// Small footer link to pull match results from FIFA.
export default function SyncLink() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      const j = await res.json();
      setMsg(j.ok ? `Đã cập nhật ${j.updated.length} trận` : "Lỗi cập nhật");
    } catch {
      setMsg("Lỗi kết nối");
    }
    setBusy(false);
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className="underline transition hover:text-white/50 disabled:opacity-60"
    >
      {busy ? "Đang cập nhật…" : msg ?? "Cập nhật kết quả"}
    </button>
  );
}
