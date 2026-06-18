import type { Metadata } from "next";
import CoastalClient from "./coastal-client";

export const metadata: Metadata = {
  title: "Chennai Coast: Shoreline Change | Neer Vazhvu",
  description:
    "Shoreline erosion and accretion along the 86 km Chennai-Ennore-Pulicat coast (1990-2024): port-driven down-drift erosion, six study zones, and named hotspots, from Anagha, Singh & Frappart (2026).",
  alternates: { canonical: "/coastal" },
  openGraph: {
    title: "Chennai Coast: Shoreline Change | Neer Vazhvu",
    description:
      "Where the Chennai coast is eroding and why. Six zones, port-driven down-drift erosion (Ennore -21.3 m/yr, Kattupalli -16 m/yr), and seawater-intrusion context.",
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neervazhvu.org/coastal",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chennai Coast: Shoreline Change | Neer Vazhvu",
    description:
      "Six zones of the Chennai coast, port-driven down-drift erosion, and seawater intrusion - 1990-2024.",
  },
};

export default function CoastalPage() {
  return <CoastalClient />;
}
