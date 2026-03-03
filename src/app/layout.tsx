import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n/context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neer Vazhvu — Chennai Water Intelligence",
  description:
    "Real-time dashboard tracking Chennai's water reserves, groundwater health, and days of water remaining. Built with open data from CMWSSB, NASA, and OpenCity.",
  keywords: [
    "Chennai water",
    "reservoir levels",
    "groundwater",
    "water crisis",
    "Day Zero",
    "CMWSSB",
    "Tamil Nadu",
  ],
  openGraph: {
    title: "Neer Vazhvu — Chennai Water Intelligence",
    description: "How many days of water does Chennai have left?",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <LanguageProvider>
          <ThemeProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
