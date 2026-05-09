"use client";

/**
 * Madurai story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * Long-form prose lives in two parallel files instead of being
 * fragmented across translations.ts keys, so translators can edit
 * whole chapters at once and the structure (Hero/Lede/Chapter/Figure/
 * PullQuote/CTA/ThenNow) stays identical between languages.
 */

import { useLanguage } from "@/lib/i18n/context";
import { MaduraiStoryEn } from "./story-madurai-en";
import { MaduraiStoryTa } from "./story-madurai-ta";

export function MaduraiStory() {
  const { language } = useLanguage();
  return language === "ta" ? <MaduraiStoryTa /> : <MaduraiStoryEn />;
}
