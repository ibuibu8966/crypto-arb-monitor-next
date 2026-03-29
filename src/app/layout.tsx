import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Sidebar } from "@/features/layout/sidebar";

export const metadata: Metadata = {
  title: "Crypto Arb Monitor",
  description: "MEXC / Bitget / CoinEX 差率モニター",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 lg:ml-56">
              <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 lg:py-6 pt-14 lg:pt-6">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
