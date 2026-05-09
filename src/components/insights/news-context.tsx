"use client";

import { useLanguage } from "@/lib/i18n/context";
import type { NewsDomain } from "@/types/news";

/** Search terms per domain that produce relevant Google News results. */
const DOMAIN_SEARCH_TERMS: Record<NewsDomain, string> = {
  reservoirs: "water supply OR reservoir OR water cut",
  groundwater: "groundwater OR borewell OR water table",
  flood: "flood OR waterlogging OR drainage OR cyclone",
  rivers: "river pollution OR sewage OR river cleaning",
  water_bodies: "lake OR pond OR wetland OR encroachment",
};

interface NewsContextProps {
  domain: NewsDomain;
  /** Zone name (e.g. "ADYAR", "AMBATTUR") for locality-scoped searches. */
  zoneName?: string;
  /** Specific location name (e.g. river name "Adyar", water body name "Pallikaranai"). */
  locationName?: string;
  /** City name to scope the search. Defaults to Chennai for back-compat. */
  cityName?: string;
}

function buildGoogleNewsUrl(domain: NewsDomain, zoneName?: string, locationName?: string, cityName: string = "Chennai"): string {
  // Build a search query scoped to the city + domain
  const parts: string[] = [];

  // Use location name if available (e.g. "Adyar river"), otherwise zone name
  if (locationName) {
    parts.push(locationName);
  } else if (zoneName) {
    // Zone names are uppercase (ADYAR) - title-case them for search
    const titleZone = zoneName.charAt(0) + zoneName.slice(1).toLowerCase();
    parts.push(titleZone);
  }

  parts.push(cityName);
  parts.push(DOMAIN_SEARCH_TERMS[domain]);

  const query = parts.join(" ");
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

export function NewsContext({ domain, zoneName, locationName, cityName }: NewsContextProps) {
  const { t } = useLanguage();

  const url = buildGoogleNewsUrl(domain, zoneName, locationName, cityName);

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 pb-4">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
          />
        </svg>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
        >
          {t("news.search_related")} &rarr;
        </a>
      </div>
    </div>
  );
}
