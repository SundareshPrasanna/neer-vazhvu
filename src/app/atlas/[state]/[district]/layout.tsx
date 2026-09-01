import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findAtlasDistrict, isAtlasDistrictVisible } from "@/lib/atlas/registry";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ state: string; district: string }>;
};

/**
 * The route guard for a district, the twin of src/app/[cityId]/layout.tsx.
 * A district that is neither published nor listed in
 * NEXT_PUBLIC_PREVIEW_DISTRICTS does not exist as a route: the landing board
 * and the place switcher read the same isAtlasDistrictVisible(), so nothing
 * can link to a page this guard would 404.
 */
export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { state, district } = await params;
  const entry = findAtlasDistrict(state, district);
  if (!entry || !isAtlasDistrictVisible(entry)) return { title: "Neer Vazhvu" };
  return {
    title: `${entry.name} district water | Neer Vazhvu Atlas`,
    description: `${entry.name}, ${entry.stateName}: one reading of the district's water, then its blocks and every Gram Panchayat, with the gaps named.`,
    robots: entry.published ? undefined : { index: false, follow: false },
  };
}

export default async function AtlasDistrictLayout({ children, params }: LayoutProps) {
  const { state, district } = await params;
  const entry = findAtlasDistrict(state, district);
  if (!entry || !isAtlasDistrictVisible(entry)) notFound();
  return children;
}
