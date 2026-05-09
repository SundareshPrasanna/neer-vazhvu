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
  return <CityGroundwaterClient />;
}
