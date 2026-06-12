import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { CatchmentAtlasClient } from "@/components/cascade/catchment-atlas-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Catchments | Neer Vazhvu" };
  return {
    title: `Lake catchments — ${config.displayName} | Neer Vazhvu`,
    description: `Click any lake in ${config.displayName} to see its catchment — the area of influence it collects rain from, the lakes that feed it, and where it drains. Terrain-derived from FABDEM 30 m elevation.`,
    alternates: { canonical: `/${cityId}/cascades` },
  };
}

export default async function CityCascadesPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  if (!config.hasCascadeOverlay) notFound();

  return (
    <CatchmentAtlasClient
      cityId={cityId}
      cityDisplayName={config.displayName}
      center={[config.center.lat, config.center.lng]}
    />
  );
}
