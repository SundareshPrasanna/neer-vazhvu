import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { tryGetPlaceConfig } from "@/lib/cities";
import { CityWardReportCard } from "./city-ward-report-card";

interface PageProps {
  params: Promise<{ cityId: string }>;
  searchParams: Promise<{ ward?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ cityId }, sp] = await Promise.all([params, searchParams]);
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Ward Report Card | Neer Vazhvu" };
  const wardNumber = sp.ward ? parseInt(sp.ward, 10) : null;
  const baseTitle = wardNumber
    ? `Ward ${wardNumber} - ${config.displayName} Report Card | Neer Vazhvu`
    : `${config.displayName} Ward Report Card | Neer Vazhvu`;
  return {
    title: baseTitle,
    description: `Per-ward water risk grade for ${config.displayName} based on groundwater depth, water-body density, and water-body health.`,
    alternates: { canonical: `/${cityId}/my-ward/report${wardNumber ? `?ward=${wardNumber}` : ""}` },
  };
}

export default async function CityWardReportPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Loading report...
        </div>
      }
    >
      <CityWardReportCard cityId={cityId} cityDisplayName={config.displayName} />
    </Suspense>
  );
}
