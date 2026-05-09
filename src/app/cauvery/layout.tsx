import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kaveri Water Clock | Neer Vazhvu",
  description:
    "Live tracker for the Kaveri Delta water year - Mettur dam, Karnataka 4-dam total, CWMA Biligundlu realisation, and Cauvery basin rainfall. Built for journalists, FPO secretaries, and agri planners.",
  openGraph: {
    title: "Kaveri Water Clock | Neer Vazhvu",
    description:
      "Where do we stand right now in the Kaveri water year? Mettur, Karnataka, Biligundlu, and basin rainfall in one page.",
  },
};

export default function CauveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
