"use client";

import { useLanguage } from "@/lib/i18n/context";
import type { CityId } from "@/lib/cities/ids";
import { CITY_STORIES } from "@/cities/generated/pages";
import { ComingSoonStory } from "./coming-soon";

/** Each city's Origins long-read, from src/cities/<city>/story-<lang>.tsx. A
 *  language without its own file falls back to English until its
 *  native-reviewed pass lands. */
export function CityStory({ cityId, cityDisplayName }: { cityId: CityId; cityDisplayName: string }) {
  const { language } = useLanguage();
  const byLanguage = CITY_STORIES[cityId];
  if (!byLanguage) return <ComingSoonStory cityDisplayName={cityDisplayName} />;
  const Story = byLanguage[language] ?? byLanguage.en;
  return <Story />;
}
