import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Neer Vazhvu" };

  return {
    title: `${config.displayName} Water Clock | Neer Vazhvu`,
    description: `Live tracker for ${config.displayName}'s water year - reservoirs, groundwater, and basin context. Built for journalists, district officials, and planners.`,
    openGraph: {
      title: `${config.displayName} Water Clock | Neer Vazhvu`,
      description: `Where does ${config.displayName} stand right now in the water year?`,
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

  const config = tryGetPlaceConfig(cityId);
  if (!config) {
    notFound();
  }

  return <>{children}</>;
}
