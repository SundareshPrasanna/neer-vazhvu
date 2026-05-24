import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ cityId: string }>;
}

/**
 * Server-side bypass for the `enabled` route guard. When the PREVIEW_CITIES
 * env var contains the cityId (comma-separated), the layout renders even
 * though config.enabled === false. Lets us develop a not-yet-launched city's
 * pages on preview/branch deploys without flipping the canonical enabled flag.
 *
 * - Local dev:        PREVIEW_CITIES=bangalore npm run dev
 * - Vercel preview:   set PREVIEW_CITIES=bangalore on the branch deploy env
 * - Production:       leave the var unset (default behaviour - 404 disabled cities)
 *
 * Not NEXT_PUBLIC_ on purpose: keep this server-side so a malicious client
 * can't force-render a disabled city by tampering with bundled values.
 */
function isPreviewCity(cityId: string): boolean {
  const raw = process.env.PREVIEW_CITIES;
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(cityId.toLowerCase());
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Neer Vazhvu" };
  if (config.enabled === false && !isPreviewCity(cityId)) {
    return { title: "Neer Vazhvu" };
  }

  return {
    title: `${config.displayName} Water Clock | Neer Vazhvu`,
    description: `Live tracker for ${config.displayName}'s water year - reservoirs, groundwater, and basin context. Built for journalists, district officials, and planners.`,
    alternates: { canonical: `/${cityId}` },
    openGraph: {
      title: `${config.displayName} Water Clock | Neer Vazhvu`,
      description: `Where does ${config.displayName} stand right now in the water year?`,
      url: `/${cityId}`,
    },
  };
}

export default async function CityLayout({ children, params }: LayoutProps) {
  const { cityId } = await params;

  // Chennai's home lives at / for legacy/SEO reasons (the historical entry point
  // for media coverage). /chennai 301-redirects to / to keep one canonical URL.
  if (cityId === "chennai") {
    redirect("/");
  }

  // Registered-but-disabled cities (config.enabled === false) are scaffolded
  // in code for data ingestion + scraper work but not yet exposed publicly.
  // 404 them at the route boundary so no user-facing surface leaks. The
  // PREVIEW_CITIES env var bypasses this for branch deploys (see isPreviewCity).
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();
  if (config.enabled === false && !isPreviewCity(cityId)) notFound();

  return <>{children}</>;
}
