import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Groundwater Levels | Neer Vazhvu",
  description:
    "Monitor groundwater depth across Chennai's 200 wards. Track water table trends, identify stressed zones, and explore ward-level data on an interactive map.",
  openGraph: {
    title: "Groundwater Levels | Neer Vazhvu",
    description:
      "Monitor groundwater depth across Chennai's 200 wards with interactive ward-level maps and trends.",
  },
};

export default function GroundwaterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
