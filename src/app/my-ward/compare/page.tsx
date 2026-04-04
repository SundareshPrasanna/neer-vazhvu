import { Suspense } from "react";
import type { Metadata } from "next";
import { WardComparisonPage } from "@/components/my-ward/ward-comparison-page";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";
import { parseWardsParam } from "@/lib/utils/parse-wards-param";

interface Props {
  searchParams: Promise<{ wards?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const wardNumbers = parseWardsParam(params.wards ?? null);

  if (wardNumbers.length === 0) {
    return { title: "Ward Comparison | Neer Vazhvu" };
  }

  const profiles = loadProfilesServer();
  const rankings = wardNumbers
    .map((w) => computeWardRankings(w, profiles))
    .filter(Boolean);

  const wardList = wardNumbers.join(", ");
  const title = `Comparing Wards ${wardList} | Neer Vazhvu`;
  const description =
    rankings.length > 0
      ? `Side-by-side comparison: ${rankings.map((r) => `Ward ${r!.wardNumber} (Grade ${r!.overallGrade})`).join(", ")}`
      : "Side-by-side water infrastructure comparison for Chennai wards.";
  const ogImage = `/api/og/compare?wards=${wardNumbers.join(",")}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Loading comparison...
        </div>
      }
    >
      <WardComparisonPage />
    </Suspense>
  );
}
