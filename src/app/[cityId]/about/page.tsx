import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { loadCascadeStats } from "@/lib/cascade-stats";
import { CityAboutContent } from "./about-content";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "About | Neer Vazhvu" };
  return {
    title: `About ${config.displayName} | Neer Vazhvu`,
    description: `Methodology, data sources, and assumptions behind the ${config.displayName} Water Intelligence Dashboard.`,
    alternates: { canonical: `/${cityId}/about` },
  };
}

export default async function CityAboutPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  const cascadeStats = config.hasCascadeOverlay
    ? loadCascadeStats(cityId)
    : null;
  return <CityAboutContent config={config} cascadeStats={cascadeStats} />;
}
