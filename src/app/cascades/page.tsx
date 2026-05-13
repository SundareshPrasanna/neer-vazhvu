import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHENNAI } from "@/lib/cities/chennai";
import { loadCascadeHealth } from "@/lib/cascade-health-loader";
import { CascadeHealthPanel } from "@/components/cascade/cascade-health-panel";

export const metadata: Metadata = {
  title: "Tank cascades at risk - Chennai | Neer Vazhvu",
  description:
    "Health and priority of historic tank cascades in Chennai, scored against current OpenStreetMap and the terrain-derived cascade graph.",
  alternates: { canonical: "/cascades" },
};

export default function ChennaiCascadesPage() {
  if (!CHENNAI.hasCascadeOverlay) {
    notFound();
  }
  const data = loadCascadeHealth("chennai");
  if (!data) {
    notFound();
  }
  return <CascadeHealthPanel data={data} cityDisplayName={CHENNAI.displayName} />;
}
