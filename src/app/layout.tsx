import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Dự đoán World Cup 2026",
  description: "Game dự đoán tỉ số World Cup 2026 cho gia đình",
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
            ⚽ Game gia đình · 20.000₫ mỗi lượt dự đoán · đoán đúng tỉ số thắng
          </footer>
        </div>
      </body>
    </html>
  );
}
