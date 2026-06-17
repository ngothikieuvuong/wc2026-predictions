"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// Shared popup shell: centered on every screen size, fits within the viewport
// (scrolls inside if tall), with a sticky header whose ✕ is always visible.
export default function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Esc closes; lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-fade fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-pop flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header — ✕ always reachable */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="min-w-0 truncate text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xl leading-none text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-white/10 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
