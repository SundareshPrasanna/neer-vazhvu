import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { WardComparisonPage } from "@/components/my-ward/ward-comparison-page";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";
import { parseWardsParam } from "@/lib/utils/parse-wards-param";

interface Props {
  params: Promise<{ cityId: string }>;
  searchParams: Promise<{ wards?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ cityId }, sp] = await Promise.all([params, searchParams]);
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Ward Comparison | Neer Vazhvu" };

  const wardNumbers = parseWardsParam(sp.wards ?? null);
  if (wardNumbers.length === 0) {
    return { title: `${config.displayName} Ward Comparison | Neer Vazhvu` };
  }

  const profiles = loadProfilesServer(cityId);
  const rankings = wardNumbers
    .map((w) => computeWardRankings(w, profiles))
    .filter(Boolean);

  const wardList = wardNumbers.join(", ");
  const title = `Comparing ${config.displayName} Wards ${wardList} | Neer Vazhvu`;
  const description =
    rankings.length > 0
      ? `Side-by-side comparison: ${rankings.map((r) => `Ward ${r!.wardNumber} (Grade ${r!.overallGrade})`).join(", ")}`
      : `Side-by-side water infrastructure comparison for ${config.displayName} wards.`;

  return {
    title,
    description,
    alternates: { canonical: `/${cityId}/my-ward/compare?wards=${wardNumbers.join(",")}` },
  };
}

export default async function CityComparePage({ params }: Props) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Loading comparison...
        </div>
      }
    >
      <WardComparisonPage cityId={cityId} />
    </Suspense>
  );
}
