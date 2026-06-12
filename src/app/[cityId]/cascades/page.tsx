import { redirect, notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// The catchment atlas now lives as the "Catchments" view mode on the
// water-bodies page. Keep /<city>/cascades as a redirect for old links.
export default async function CityCascadesPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config || !config.hasCascadeOverlay) notFound();
  redirect(`/${cityId}/water-bodies?mode=catchments`);
}
