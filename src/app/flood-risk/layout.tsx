import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flood Risk Map | Neer Vazhvu",
  description:
    "Explore Chennai's flood hazard zones, 2015 and 2020 flood hotspots, and drainage infrastructure on an interactive map. Identify vulnerable wards and plan for monsoon preparedness.",
  openGraph: {
    title: "Flood Risk Map | Neer Vazhvu",
    description:
      "Explore Chennai's flood hazard zones, hotspots, and drainage infrastructure on an interactive map.",
  },
};

export default function FloodRiskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
