import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n/context";
import { cityKeywords, liveCityPhrase, liveCityPhraseWithOnboarding } from "@/lib/cities/roster";

const CITIES = liveCityPhrase();
const CITIES_WITH_ONBOARDING = liveCityPhraseWithOnboarding();

export const metadata: Metadata = {
  metadataBase: new URL("https://neervazhvu.org"),
  title: "Neer Vazhvu | Urban Water Intelligence",
  description:
    `Open-source platform tracking reservoirs, groundwater, river health, flood risk, drainage, ` +
    `and water bodies across ${CITIES}, with AI-powered summaries in ` +
    `English and regional languages.`,
  keywords: [
    "urban water",
    ...cityKeywords(),
    "reservoir levels",
    "groundwater",
    "water crisis",
    "Day Zero",
    "CMWSSB",
    "BWSSB",
    "TWAD",
    "flood risk",
    "river pollution",
    "water bodies",
    "civic tech",
  ],
  openGraph: {
    title: "Neer Vazhvu | Urban Water Intelligence",
    description: `Reservoirs, groundwater, rivers, flood risk, and water bodies across ${CITIES_WITH_ONBOARDING}.`,
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neervazhvu.org",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neer Vazhvu | Urban Water Intelligence",
    description: `Reservoirs, groundwater, rivers, flood risk, and water bodies across ${CITIES_WITH_ONBOARDING}.`,
  },
  icons: {
    icon: [
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon.ico?v=3", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=3" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {/* JSON-LD for SEO. Plain <script> in a server component
            ends up in initial HTML for crawlers; React 19 doesn't warn
            on it the way it does on next/script <Script> with
            beforeInteractive in App Router (per Next.js JSON-LD docs:
            https://nextjs.org/docs/app/guides/json-ld). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Neer Vazhvu",
              url: "https://neervazhvu.org",
              description:
                `Open-source platform tracking reservoirs, groundwater, river health, flood ` +
                `risk, drainage, and water bodies across ${CITIES}.`,
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "INR",
              },
              author: {
                "@type": "Organization",
                name: "Neer Vazhvu",
                url: "https://neervazhvu.org",
              },
              areaServed: {
                "@type": "Country",
                name: "India",
              },
            }),
          }}
        />
        <LanguageProvider>
          <ThemeProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ThemeProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
