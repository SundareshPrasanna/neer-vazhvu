import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Facts | Neer Vazhvu" };
  return {
    title: `${config.displayName} Water Facts | Neer Vazhvu`,
    alternates: { canonical: `/${cityId}/facts` },
  };
}

export default async function CityFactsPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Facts derive from other pages (reservoirs, groundwater, rivers, water
  // bodies, etc.) so this page lights up automatically as those pages ship.
  // Until then, the existing reservoir + groundwater story already flows
  // into the home page.

  return (
    <FeatureNotYetAvailable
      config={config}
      feature="Water facts"
      scope="city-admin"
      parityVerdict="MEDIUM"
      whatItShowsForChennai="quotable findings derived from reservoirs, groundwater, rivers, water bodies, and demographics - tagged by category and citable for journalists"
      dataGapNote="Facts are derived from the other feature pages. Once water-bodies / rivers / flood-risk land for Madurai, the same fact-builder logic produces Madurai facts (Vaigai capacity, Mullaperiyar lease, % over-exploited blocks, etc.) automatically. Some facts will need manual curation - e.g. the 1886 lease deed, 999-year term."
      relatedLinks={[
        { href: `/${cityId}`, label: `${config.displayName} home` },
        { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        { href: `/${cityId}/about`, label: "Methodology + data sources" },
      ]}
    />
  );
}
