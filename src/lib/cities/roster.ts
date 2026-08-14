import { listAllPlaces } from "./index";

/**
 * City roster strings for site-wide metadata, derived from the registry so
 * they can never go stale the way the hard-coded "Chennai, Madurai, and
 * onboarding Bengaluru" string did. That string survived three launches
 * (Bengaluru, Mumbai, Delhi) because it was copied into four places while
 * only one of them read the registry.
 *
 * Lives here rather than in layout.tsx because manifest.ts and the JSON-LD
 * blob need the same roster, and a second copy is how the first one rotted.
 */

/** "Chennai, Madurai, Bengaluru live; Hyderabad onboarding" */
export function cityRoster(): string {
  const all = listAllPlaces();
  const live = all.filter((p) => p.enabled !== false).map((p) => p.displayName);
  const onboarding = all.filter((p) => p.enabled === false).map((p) => p.displayName);
  const parts = [`${live.join(", ")} live`];
  if (onboarding.length) parts.push(`${onboarding.join(", ")} onboarding`);
  return parts.join("; ");
}

/**
 * Prose form for the site description, where "live; onboarding" reads as
 * machine output: "Chennai, Madurai, Bengaluru, Mumbai and Delhi".
 * Onboarding cities are omitted - a description is a promise to a reader,
 * and a preview-gated city 404s for them.
 */
export function liveCityList(): string {
  const live = listAllPlaces()
    .filter((p) => p.enabled !== false)
    .map((p) => p.displayName);
  if (live.length <= 1) return live[0] ?? "";
  return `${live.slice(0, -1).join(", ")} and ${live[live.length - 1]}`;
}

/** Search keywords for the live cities: ["Chennai water", "Madurai water", ...] */
export function cityKeywords(): string[] {
  return listAllPlaces()
    .filter((p) => p.enabled !== false)
    .map((p) => `${p.displayName} water`);
}
