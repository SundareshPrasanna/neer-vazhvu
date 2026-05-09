import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { tryGetPlaceConfig } from "@/lib/cities";
import { MyWardPage } from "@/components/my-ward/my-ward-page";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "My Ward | Neer Vazhvu" };
  return {
    title: `My Ward (${config.displayName}) | Neer Vazhvu`,
    description: `Ward-level water context for ${config.displayName} - groundwater, water bodies, flood risk, infrastructure, river adjacency, and representatives.`,
    alternates: { canonical: `/${cityId}/my-ward` },
  };
}

export default async function CityMyWardPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Loading...
        </div>
      }
    >
      <MyWardPage cityId={cityId} />
    </Suspense>
  );
}
