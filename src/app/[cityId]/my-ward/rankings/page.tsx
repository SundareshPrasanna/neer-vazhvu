import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isFeatureSupportedForCity } from "@/lib/cities/routing";
import { tryGetPlaceConfig } from "@/lib/cities";
import { loadWardRankings } from "@/lib/ward-rankings/load-rankings";
import { RankingsTable } from "@/components/my-ward/rankings-table";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// Daily revalidate. Ward rankings recompute from upstream JSONs that
// refresh at most daily.
export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Ward rankings | Neer Vazhvu" };
  return {
    title: `${config.displayName} ward rankings | Neer Vazhvu`,
    description: `All ${config.displayName} wards ranked by composite water-stress score. Sortable by grade, zone, and per-metric values.`,
    alternates: { canonical: `/${cityId}/my-ward/rankings` },
  };
}

export default async function CityWardRankingsPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  if (!isFeatureSupportedForCity("/my-ward", cityId)) notFound();

  const bundle = loadWardRankings(cityId);
  if (!bundle) {
    notFound();
  }

  return (
    <RankingsTable
      bundle={bundle}
      cityDisplayName={config.displayName}
      wardDetailPathPrefix={`/${cityId}`}
    />
  );
}
