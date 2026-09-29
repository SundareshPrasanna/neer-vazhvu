"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useLanguage } from "@/lib/i18n/context";
import type { LanguageCode } from "@/lib/i18n/translations";
import type { CityId } from "@/lib/cities/ids";
import { ComingSoonStory } from "./coming-soon";

/** Each city's Origins long-read, one component per language. Prose lives in
 *  src/content/story-<city>-<lang>.tsx; a language without its own file falls
 *  back to English until its native-reviewed pass lands. */
const STORIES: Partial<Record<CityId, { en: ComponentType } & Partial<Record<LanguageCode, ComponentType>>>> = {
  chennai: {
    en: dynamic(() => import("@/content/story-chennai-en").then((m) => m.ChennaiStoryEn)),
    ta: dynamic(() => import("@/content/story-chennai-ta").then((m) => m.ChennaiStoryTa)),
  },
  madurai: {
    en: dynamic(() => import("@/content/story-madurai-en").then((m) => m.MaduraiStoryEn)),
    ta: dynamic(() => import("@/content/story-madurai-ta").then((m) => m.MaduraiStoryTa)),
  },
  bangalore: {
    en: dynamic(() => import("@/content/story-bangalore-en").then((m) => m.BangaloreStoryEn)),
    kn: dynamic(() => import("@/content/story-bangalore-kn").then((m) => m.BangaloreStoryKn)),
  },
  mumbai: {
    en: dynamic(() => import("@/content/story-mumbai-en").then((m) => m.MumbaiStoryEn)),
  },
  delhi: {
    en: dynamic(() => import("@/content/story-delhi-en").then((m) => m.DelhiStoryEn)),
  },
  hyderabad: {
    en: dynamic(() => import("@/content/story-hyderabad-en").then((m) => m.HyderabadStoryEn)),
  },
  kolkata: {
    en: dynamic(() => import("@/content/story-kolkata-en").then((m) => m.KolkataStoryEn)),
  },
  gurugram: {
    en: dynamic(() => import("@/content/story-gurugram-en").then((m) => m.GurugramStoryEn)),
  },
  pune: {
    en: dynamic(() => import("@/content/story-pune-en").then((m) => m.PuneStoryEn)),
  },
  surat: {
    en: dynamic(() => import("@/content/story-surat-en").then((m) => m.SuratStoryEn)),
  },
};

export function CityStory({ cityId, cityDisplayName }: { cityId: CityId; cityDisplayName: string }) {
  const { language } = useLanguage();
  const byLanguage = STORIES[cityId];
  if (!byLanguage) return <ComingSoonStory cityDisplayName={cityDisplayName} />;
  const Story = byLanguage[language] ?? byLanguage.en;
  return <Story />;
}
