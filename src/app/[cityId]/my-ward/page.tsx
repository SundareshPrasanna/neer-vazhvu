import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import MyWardClient from "./my-ward-client";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "My Ward | Neer Vazhvu" };
  return {
    title: `My Ward (${config.displayName}) | Neer Vazhvu`,
    description: `Ward boundaries, zones, and per-ward water context for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/my-ward` },
  };
}

export default async function CityMyWardPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return (
    <MyWardClient
      cityId={cityId}
      cityDisplayName={config.displayName}
      mapCenter={[config.center.lat, config.center.lng]}
      mapZoom={12}
    />
  );
}
