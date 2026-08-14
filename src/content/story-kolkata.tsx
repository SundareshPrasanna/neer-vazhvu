"use client";

/**
 * Kolkata story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * English only at launch; the Bengali (bn) renderer lands with the i18n
 * pass (pending native-speaker review). Bengali falls back to English
 * silently until then - mirrors the Mumbai and Delhi launch posture.
 */

import dynamic from "next/dynamic";

const KolkataStoryEn = dynamic(() =>
  import("./story-kolkata-en").then((mod) => mod.KolkataStoryEn),
);

export function KolkataStory() {
  return <KolkataStoryEn />;
}
