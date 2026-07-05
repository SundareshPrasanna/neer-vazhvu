import { tryGetPlaceConfig } from "@/lib/cities";
import type { LanguageCode } from "./translations";

/**
 * Map a URL pathname to the language set the UI should offer there.
 *
 * Routing today:
 *   - "/" and legacy unscoped routes ("/water-bodies", "/about", etc.)
 *     belong to Chennai (the historical default city).
 *   - "/<cityId>/..." belongs to that city.
 *
 * Resolver:
 *   1. Take the first non-empty path segment.
 *   2. If it matches a known city config, return that city's
 *      `availableLanguages`.
 *   3. Otherwise treat the request as Chennai-scoped (legacy routes).
 *
 * Always returns a list with at least 'en' so the toggle and the
 * fallback `t()` lookup always have something usable.
 */
export function resolveAvailableLanguagesForPath(
  pathname: string,
): readonly LanguageCode[] {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const cityFromSegment = tryGetPlaceConfig(firstSegment);
  if (cityFromSegment?.availableLanguages?.length) {
    return cityFromSegment.availableLanguages;
  }

  // Legacy unscoped routes are Chennai-implicit.
  const chennai = tryGetPlaceConfig("chennai");
  if (chennai?.availableLanguages?.length) {
    return chennai.availableLanguages;
  }

  return ["en"];
}

/**
 * Languages a city advertises as coming soon (greyed in the switcher).
 * No Chennai fallback: legacy routes have no upcoming set.
 */
export function resolveUpcomingLanguagesForPath(
  pathname: string,
): readonly LanguageCode[] {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  return tryGetPlaceConfig(firstSegment)?.upcomingLanguages ?? [];
}
