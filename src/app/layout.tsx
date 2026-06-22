import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import PageTransition from "@/components/PageTransition";
import { HideMoneyProvider } from "@/components/Money";
import { RefreshProvider } from "@/components/Refresh";

// Premium Vietnamese-friendly type — lifts the whole UI vs system-ui.
const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="vi" className={sans.variable}>
      <body className="text-white antialiased">
        <HideMoneyProvider>
          <RefreshProvider>
            <div className="pitch-stripes min-h-screen">
              <NavBar />
              <main className="mx-auto max-w-3xl px-4 py-6">
                <PageTransition>{children}</PageTransition>
              </main>
            </div>
          </RefreshProvider>
        </HideMoneyProvider>
      </body>
    </html>
  );
}
