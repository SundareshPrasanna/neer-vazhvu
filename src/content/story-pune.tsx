"use client";

/**
 * Pune story entrypoint - delegates to the language-specific sub-component
 * based on the current `useLanguage()` selection.
 *
 * English only at launch; the Marathi (mr) renderer lands with the i18n pass
 * (native review pending). Marathi falls back to English silently until then -
 * mirrors the Kolkata, Mumbai, Delhi and Gurugram launch posture.
 */

import dynamic from "next/dynamic";

const PuneStoryEn = dynamic(() =>
  import("./story-pune-en").then((mod) => mod.PuneStoryEn),
);

export function PuneStory() {
  return <PuneStoryEn />;
}
