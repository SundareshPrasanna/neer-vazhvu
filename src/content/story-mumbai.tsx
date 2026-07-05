"use client";

/**
 * Mumbai story entrypoint - delegates to the language-specific
 * sub-component based on the current `useLanguage()` selection.
 *
 * English only at launch; the Marathi (mr) renderer lands with the i18n
 * pass (pending native-speaker review). Marathi falls back to English
 * silently until then.
 */

import dynamic from "next/dynamic";

const MumbaiStoryEn = dynamic(() =>
  import("./story-mumbai-en").then((mod) => mod.MumbaiStoryEn),
);

export function MumbaiStory() {
  return <MumbaiStoryEn />;
}
