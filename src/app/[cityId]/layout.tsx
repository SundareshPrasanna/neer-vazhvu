import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Madurai Water Clock | Neer Vazhvu",
  description:
    "Live tracker for Madurai's water year - Vaigai dam, Mullaperiyar trans-basin transfer (Kerala-side dual source), Sothuparai, and Vaigai basin rainfall. Built for journalists, district officials, and planners.",
  openGraph: {
    title: "Madurai Water Clock | Neer Vazhvu",
    description:
      "Where does Madurai stand in the water year? Vaigai, Mullaperiyar (TN vs Kerala readings), and Sothuparai - one page, daily.",
  },
};

export default function MaduraiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
