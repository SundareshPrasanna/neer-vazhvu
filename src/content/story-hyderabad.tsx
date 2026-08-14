"use client";

/**
 * Hyderabad story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * English only at launch; the Telugu (te) renderer lands with the i18n pass
 * (pending native-speaker review). Telugu falls back to English silently
 * until then - mirrors the Mumbai and Delhi launch posture.
 */

import dynamic from "next/dynamic";

const HyderabadStoryEn = dynamic(() =>
  import("./story-hyderabad-en").then((mod) => mod.HyderabadStoryEn),
);

export function HyderabadStory() {
  return <HyderabadStoryEn />;
}
