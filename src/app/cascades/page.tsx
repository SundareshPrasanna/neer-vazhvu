import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHENNAI } from "@/lib/cities/chennai";
import { CatchmentAtlasClient } from "@/components/cascade/catchment-atlas-client";

export const metadata: Metadata = {
  title: "Lake catchments - Chennai | Neer Vazhvu",
  description:
    "Click any lake in Chennai to see its catchment - the area of influence it collects rain from, the lakes that feed it, and where it drains. Terrain-derived from FABDEM 30 m elevation.",
  alternates: { canonical: "/cascades" },
};

export default function ChennaiCascadesPage() {
  if (!CHENNAI.hasCascadeOverlay) {
    notFound();
  }
  return (
    <CatchmentAtlasClient
      cityId="chennai"
      cityDisplayName={CHENNAI.displayName}
      center={[CHENNAI.center.lat, CHENNAI.center.lng]}
    />
  );
}
