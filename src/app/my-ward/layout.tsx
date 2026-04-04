import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Ward | Neer Vazhvu",
  description:
    "Everything about your Chennai ward in one place - groundwater, water bodies, flood risk, drainage, sewerage, and elected representatives.",
};

export default function MyWardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
