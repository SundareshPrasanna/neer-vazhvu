import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  metadataBase: new URL("https://neervazhvu.org"),
  title: "Neer Vazhvu | Chennai Water Intelligence",
  description:
    "Open-source platform tracking Chennai's reservoirs, groundwater, river health, flood risk, drainage, and 1,787 water bodies across 200 wards - with AI-powered summaries in English and Tamil.",
  keywords: [
    "Chennai water",
    "reservoir levels",
    "groundwater",
    "water crisis",
    "Day Zero",
    "CMWSSB",
    "Tamil Nadu",
    "flood risk",
    "river pollution",
    "water bodies",
    "civic tech",
  ],
  openGraph: {
    title: "Neer Vazhvu | Chennai Water Intelligence",
    description: "Reservoirs, groundwater, rivers, flood risk, and 1,787 water bodies - all of Chennai's water data in one place.",
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neervazhvu.org",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neer Vazhvu | Chennai Water Intelligence",
    description: "Reservoirs, groundwater, rivers, flood risk, and 1,787 water bodies - all of Chennai's water data in one place.",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Neer Vazhvu",
              url: "https://neervazhvu.org",
              description:
                "Open-source platform tracking Chennai's reservoirs, groundwater, river health, flood risk, drainage, and 1,787 water bodies across 200 wards.",
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
                "@type": "City",
                name: "Chennai",
                containedInPlace: {
                  "@type": "State",
                  name: "Tamil Nadu",
                },
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
      </body>
    </html>
  );
}
