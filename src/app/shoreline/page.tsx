import type { Metadata } from "next";
import CoastalClient from "./coastal-client";

export const metadata: Metadata = {
  title: "Chennai Shoreline Change | Neer Vazhvu",
  description:
    "Shoreline erosion and accretion along the Chennai coast, Mahabalipuram to Pulicat (1990-2026): our own satellite measurement (1,100+ transects, MNDWI on Landsat + Sentinel-2), corroborated by Anagha, Singh & Frappart (2026). About 72% of the eroding coast is eroding faster than before.",
  alternates: { canonical: "/shoreline" },
  openGraph: {
    title: "Chennai Shoreline Change | Neer Vazhvu",
    description:
      "Where Chennai's coast is eroding and how fast - a satellite shoreline-change measurement 1990-2026, with port-driven down-drift erosion (Ennore, Kattupalli) and an acceleration check.",
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neervazhvu.org/shoreline",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chennai Shoreline Change | Neer Vazhvu",
    description:
      "Chennai coastal erosion/accretion 1990-2026; ~72% of the eroding coast is eroding faster than before.",
  },
};

export default function CoastalPage() {
  return <CoastalClient />;
}
