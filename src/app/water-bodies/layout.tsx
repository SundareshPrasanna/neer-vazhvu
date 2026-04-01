import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Water Bodies & Lake Restoration | Neer Vazhvu",
  description:
    "Explore 1,787 water bodies across Chennai - lakes, tanks, ponds, and marshlands. View restoration priority scores, lost water bodies, and census records.",
  openGraph: {
    title: "Water Bodies & Lake Restoration | Neer Vazhvu",
    description:
      "Explore 1,787 water bodies across Chennai with restoration priority scores and historical census data.",
  },
};

export default function WaterBodiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
