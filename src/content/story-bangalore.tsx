"use client";

/**
 * Bangalore story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * Kannada renderer lands June 2026 (pending native-speaker review).
 * Tamil falls back to English silently.
 */

import { useLanguage } from "@/lib/i18n/context";
import dynamic from "next/dynamic";

const BangaloreStoryEn = dynamic(() =>
  import("./story-bangalore-en").then((mod) => mod.BangaloreStoryEn),
);
const BangaloreStoryKn = dynamic(() =>
  import("./story-bangalore-kn").then((mod) => mod.BangaloreStoryKn),
);

export function BangaloreStory() {
  const { language } = useLanguage();
  if (language === "kn") return <BangaloreStoryKn />;
  return <BangaloreStoryEn />;
}
