import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import AdminLink from "@/components/AdminLink";

export const metadata: Metadata = {
  title: "Happy Corner",
  description: "Trò chơi đoán vui cho gia đình",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="text-white antialiased">
        <div className="pitch-stripes min-h-screen">
          <NavBar />
          <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-white/30">
            <p>🎯 Trò chơi gia đình · góp 20.000₫ mỗi lượt · đoán trúng nhận quỹ</p>
            <p className="mt-2">
              <AdminLink />
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
