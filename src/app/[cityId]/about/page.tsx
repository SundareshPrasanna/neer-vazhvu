import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
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
  };
}

export default async function CityAboutPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  return <CityAboutContent config={config} />;
}
