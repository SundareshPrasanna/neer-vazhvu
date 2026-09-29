import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { CityStory } from "@/components/story/city-story";
import { STORY_TAGLINES } from "@/content/story-taglines";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Origins | Neer Vazhvu" };

  const tagline = STORY_TAGLINES[config.cityId];

  return {
    title: `${tagline} | Neer Vazhvu`,
    description: `Long-read companion to ${config.displayName}'s live water dashboard. How the system worked, how it broke, where we are now, what it would take.`,
    alternates: { canonical: `/${cityId}/origins` },
    openGraph: {
      title: `${tagline} | Neer Vazhvu`,
      description: `${config.displayName} water story.`,
      url: `/${cityId}/origins`,
      type: "article",
    },
  };
}

export default async function CityStoryPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  return <CityStory cityId={config.cityId} cityDisplayName={config.displayName} />;
}
