import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Lake Restoration | Neer Vazhvu" };
  return { title: `${config.displayName} Lake Restoration | Neer Vazhvu` };
}

// Mirrors Chennai's /lake-restoration -> /water-bodies redirect. The
// restoration-priority view lives inside the water-bodies page; we keep
// the URL alive for backward compat and CitySwitcher consistency.
export default async function CityLakeRestorationPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  redirect(`/${cityId}/water-bodies`);
}
