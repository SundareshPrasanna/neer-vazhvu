"use client";

/**
 * Surat story entrypoint - delegates to the language-specific sub-component
 * based on the current `useLanguage()` selection.
 *
 * English only at launch; the Gujarati (gu) renderer lands with the i18n pass.
 * Gujarati falls back to English silently until then - mirrors the Kolkata,
 * Gurugram, Mumbai and Delhi launch posture.
 */

import dynamic from "next/dynamic";

const SuratStoryEn = dynamic(() =>
  import("./story-surat-en").then((mod) => mod.SuratStoryEn),
);

export function SuratStory() {
  return <SuratStoryEn />;
}
