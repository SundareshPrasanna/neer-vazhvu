import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { MaduraiStory } from "@/content/story-madurai";
import { ChennaiStory } from "@/content/story-chennai";
import { BangaloreStory } from "@/content/story-bangalore";
import { MumbaiStory } from "@/content/story-mumbai";
import { DelhiStory } from "@/content/story-delhi";
import { HyderabadStory } from "@/content/story-hyderabad";
import { ComingSoonStory } from "@/components/story/coming-soon";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Origins | Neer Vazhvu" };

  const tagline =
    cityId === "madurai"
      ? "City of Tanks - what is left of the cascade"
      : cityId === "chennai"
        ? "City of estuaries - what is left of the sponge"
        : cityId === "bangalore"
          ? "City of stolen kere - what Kempegowda built and what Bengaluru built over it"
          : cityId === "mumbai"
            ? "City of seven islands - a place with no river, and the forty-five litres that divide it"
            : cityId === "hyderabad"
              ? "Hyderabad"
              : cityId === "delhi"
              ? "The city that stored water for a thousand years - and the twenty-two kilometres where its river dies"
              : `${config.displayName} water story`;

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

  if (cityId === "madurai") {
    return <MaduraiStory />;
  }

  if (cityId === "chennai") {
    return <ChennaiStory />;
  }

  if (cityId === "bangalore") {
    return <BangaloreStory />;
  }

  if (cityId === "mumbai") {
    return <MumbaiStory />;
  }

  if (cityId === "delhi") {
    return <DelhiStory />;
  }

  if (cityId === "hyderabad") {
    return <HyderabadStory />;
  }

  return <ComingSoonStory cityDisplayName={config.displayName} />;
}
