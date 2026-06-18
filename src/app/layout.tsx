import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import PageTransition from "@/components/PageTransition";
import { HideMoneyProvider } from "@/components/Money";

export const metadata: Metadata = {
  title: "Nhà Tiên Tri WC",
  description: "Trò chơi đoán tỉ số vui cho gia đình",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="text-white antialiased">
        <HideMoneyProvider>
          <div className="pitch-stripes min-h-screen">
            <NavBar />
            <main className="mx-auto max-w-3xl px-4 py-6">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </HideMoneyProvider>
      </body>
    </html>
  );
}
