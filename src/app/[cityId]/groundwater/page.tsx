import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import CityGroundwaterClient from "./groundwater-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Groundwater | Neer Vazhvu" };
  return {
    title: `${config.displayName} Groundwater | Neer Vazhvu`,
    description: `CGWB Dynamic Groundwater Resource Assessment for ${config.displayName} - block-level stress classification and CGWB station coverage.`,
    alternates: { canonical: `/${cityId}/groundwater` },
  };
}

export default async function CityGroundwaterPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  // Pre-resolve the default tab server-side so SSR renders with the correct
  // active button styling. Without this, useParams() returns empty on SSR
  // and the client falls back to "exploitation" before snapping to "iisc"
  // after hydration, producing a visible flicker for Bangalore visitors.
  const initialViewMode = config.groundwaterViews?.iisc ? "iisc" : "exploitation";
  return <CityGroundwaterClient initialViewMode={initialViewMode} />;
}

