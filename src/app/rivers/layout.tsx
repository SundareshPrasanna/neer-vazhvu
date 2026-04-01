import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "River Health & Pollution | Neer Vazhvu",
  description:
    "Track water quality of Chennai's rivers - Adyar, Cooum, Kosasthalaiyar, and Buckingham Canal. View pollution sources, dissolved oxygen levels, and industrial discharge points.",
  openGraph: {
    title: "River Health & Pollution | Neer Vazhvu",
    description:
      "Track water quality of Chennai's rivers and view pollution sources on an interactive map.",
  },
};

export default function RiversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
