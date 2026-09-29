import { tryGetPlaceConfig } from "@/lib/cities";
import type { LanguageCode } from "./translations";

/**
 * Map a URL pathname to the language set the UI should offer there.
 *
 * "/<cityId>/..." offers that city's `availableLanguages`. Anything else
 * (the landing page, /atlas/*, /waterways/*) is not a city and offers
 * English only, never another city's languages.
 */
export function resolveAvailableLanguagesForPath(
  pathname: string,
): readonly LanguageCode[] {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const cityFromSegment = tryGetPlaceConfig(firstSegment);
  if (cityFromSegment?.availableLanguages?.length) {
    return cityFromSegment.availableLanguages;
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
