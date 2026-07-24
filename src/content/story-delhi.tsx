"use client";

/**
 * Delhi story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * English only at launch; the Hindi (hi) renderer lands with the i18n
 * pass (pending native-speaker review). Hindi falls back to English
 * silently until then - mirrors the Mumbai launch posture.
 */

import dynamic from "next/dynamic";

const DelhiStoryEn = dynamic(() =>
  import("./story-delhi-en").then((mod) => mod.DelhiStoryEn),
);

export function DelhiStory() {
  return <DelhiStoryEn />;
}
