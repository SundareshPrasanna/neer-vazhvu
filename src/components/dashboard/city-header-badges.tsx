"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n/context";

interface Props {
  displayName: string;
  stateCode: string;
  /** Show the amber "preview" pill when the city's daily ingestion has
   *  not yet produced a fresh reservoir reading. */
  preview: boolean;
}

/**
 * Client wrapper for the city dashboard's badge row. Lives as its own
 * component so the "PREVIEW" pill can read the active language from the
 * LanguageContext - the parent page (/[cityId]/page.tsx) is a Server
 * Component, so it can't call useLanguage() directly.
 */
export function CityHeaderBadges({ displayName, stateCode, preview }: Props) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="text-xs">
        {displayName} - {stateCode}
      </Badge>
      {preview && (
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          {t("city.preview_badge")}
        </Badge>
      )}
    </div>
  );
}
