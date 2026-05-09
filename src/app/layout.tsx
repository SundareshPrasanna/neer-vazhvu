import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  metadataBase: new URL("https://neervazhvu.org"),
  title: "Neer Vazhvu | Tamil Nadu Water Intelligence",
  description:
    "Open-source platform tracking reservoirs, groundwater, river health, flood risk, drainage, and water bodies across Tamil Nadu cities - starting with Chennai and Madurai - with AI-powered summaries in English and Tamil.",
  keywords: [
    "Tamil Nadu water",
    "Chennai water",
    "Madurai water",
    "reservoir levels",
    "groundwater",
    "water crisis",
    "Day Zero",
    "CMWSSB",
    "TWAD",
    "flood risk",
    "river pollution",
    "water bodies",
    "civic tech",
  ],
  openGraph: {
    title: "Neer Vazhvu | Tamil Nadu Water Intelligence",
    description: "Reservoirs, groundwater, rivers, flood risk, and water bodies across Tamil Nadu cities - Chennai and Madurai live, more on the way.",
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neervazhvu.org",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neer Vazhvu | Tamil Nadu Water Intelligence",
    description: "Reservoirs, groundwater, rivers, flood risk, and water bodies across Tamil Nadu cities - Chennai and Madurai live, more on the way.",
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
        {/* JSON-LD via next/script avoids the React 19 "script tag inside
            React component" warning. strategy="beforeInteractive" injects
            into <head> before hydration, which is what crawlers want. */}
        <Script
          id="json-ld-webapp"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Neer Vazhvu",
              url: "https://neervazhvu.org",
              description:
                "Open-source platform tracking reservoirs, groundwater, river health, flood risk, drainage, and water bodies across Tamil Nadu cities - starting with Chennai and Madurai.",
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
                "@type": "State",
                name: "Tamil Nadu",
                containedInPlace: {
                  "@type": "Country",
                  name: "India",
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
