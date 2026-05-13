import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { loadCascadeHealth } from "@/lib/cascade-health-loader";
import { CascadeHealthPanel } from "@/components/cascade/cascade-health-panel";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Cascades | Neer Vazhvu" };
  return {
    title: `Tank cascades at risk - ${config.displayName} | Neer Vazhvu`,
    description: `Health and priority of historic tank cascades in ${config.displayName}, scored against current OpenStreetMap and the terrain-derived cascade graph.`,
    alternates: { canonical: `/${cityId}/cascades` },
  };
}

export default async function CityCascadesPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  if (!config.hasCascadeOverlay) {
    notFound();
  }

  const data = loadCascadeHealth(cityId);
  if (!data) {
    notFound();
  }

  return (
    <CascadeHealthPanel data={data} cityDisplayName={config.displayName} />
  );
}
