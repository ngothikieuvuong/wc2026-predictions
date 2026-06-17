"use client";

import { usePathname } from "next/navigation";

// Re-keys on every route change so the content remounts and replays a soft
// fade-and-lift — gives navigation a smooth, premium feel.
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
