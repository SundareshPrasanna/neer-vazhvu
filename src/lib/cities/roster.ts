import { listAllPlaces } from "./index";

/**
 * City roster strings for site-wide metadata, derived from the registry so
 * they can never go stale the way the hard-coded "Chennai, Madurai, and
 * onboarding Bengaluru" string did. That string survived three launches
 * because it was copied into several places while only one read the registry.
 *
 * These return a COUNT, not a list of names. An enumerated roster is stale the
 * moment it is written and unreadable once the platform passes a handful of
 * cities: "Chennai, Madurai, Bengaluru, Mumbai, Delhi and Hyderabad" is already
 * most of a description, and every onboarding adds to it. "six Indian cities"
 * stays the same length forever and is still true the day the seventh lands.
 *
 * City NAMES still belong in `cityKeywords()`, where a search engine wants
 * them individually and where a list is the right shape.
 */

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

function liveCities() {
  return listAllPlaces().filter((p) => p.enabled !== false);
}

/** How many cities are live right now. */
export function liveCityCount(): number {
  return liveCities().length;
}

/**
 * "six Indian cities" - the phrase that goes in prose descriptions.
 * Spelled out through twelve, then numerals, which is ordinary prose style.
 */
export function liveCityPhrase(): string {
  const n = liveCityCount();
  const word = n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
  return `${word} Indian ${n === 1 ? "city" : "cities"}`;
}

/**
 * Same phrase, plus a stable tail when any registered city is still
 * preview-gated. "more onboarding" does not grow with the roster.
 */
export function liveCityPhraseWithOnboarding(): string {
  const onboarding = listAllPlaces().some((p) => p.enabled === false);
  return onboarding ? `${liveCityPhrase()}, more onboarding` : liveCityPhrase();
}

/** Search keywords for the live cities: ["Chennai water", "Madurai water", ...] */
export function cityKeywords(): string[] {
  return liveCities().map((p) => `${p.displayName} water`);
}
