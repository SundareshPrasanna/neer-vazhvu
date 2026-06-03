import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ cityId: string }>;
}

/**
 * Server-side bypass for the `enabled` route guard. Reads either env var
 * (NEXT_PUBLIC_PREVIEW_CITIES preferred; legacy PREVIEW_CITIES still
 * honoured). The NEXT_PUBLIC_ one is required for the client-side city
 * switcher + nav to also surface the preview city - so use that on
 * branch deploys.
 *
 *   Local dev:       NEXT_PUBLIC_PREVIEW_CITIES=bangalore npm run dev
 *   Vercel branch:   set NEXT_PUBLIC_PREVIEW_CITIES=bangalore env
 *   Production:      leave the vars unset (404 disabled cities)
 *
 * Using NEXT_PUBLIC_ does leak the city-id list into the bundle - that's
 * fine because the layout guard is the actual gate; this var just tells
 * the UI to surface the link.
 */
function isPreviewCity(cityId: string): boolean {
  const raw =
    process.env.NEXT_PUBLIC_PREVIEW_CITIES ??
    process.env.PREVIEW_CITIES ??
    "";
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
