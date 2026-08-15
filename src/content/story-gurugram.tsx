"use client";

/**
 * Gurugram story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * English only at launch; the Hindi (hi) renderer lands with the i18n pass.
 * Hindi falls back to English silently until then - mirrors the Kolkata,
 * Mumbai and Delhi launch posture.
 */

import dynamic from "next/dynamic";

const GurugramStoryEn = dynamic(() =>
  import("./story-gurugram-en").then((mod) => mod.GurugramStoryEn),
);

export function GurugramStory() {
  return <GurugramStoryEn />;
}
