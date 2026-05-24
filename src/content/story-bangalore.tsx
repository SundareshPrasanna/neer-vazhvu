"use client";

/**
 * Bangalore story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * Kannada (kn) translation isn't shipped yet - the entrypoint falls
 * back to English regardless of language until story-bangalore-kn.tsx
 * lands. The fallback is silent so an unsupported language doesn't
 * 500 the page.
 */

import { useLanguage } from "@/lib/i18n/context";
import dynamic from "next/dynamic";

const BangaloreStoryEn = dynamic(() =>
  import("./story-bangalore-en").then((mod) => mod.BangaloreStoryEn),
);

export function BangaloreStory() {
  const { language } = useLanguage();
  // Kannada translation not yet drafted; fall back to English silently.
  void language;
  return <BangaloreStoryEn />;
}
