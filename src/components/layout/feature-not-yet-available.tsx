import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlaceConfig } from "@/lib/cities";

export type FeatureScope =
  | "city-admin"
  | "district-admin"
  | "ward-admin"
  | "basin-system"
  | "cross-state";

const SCOPE_LABEL: Record<FeatureScope, string> = {
  "city-admin": "City scope",
  "district-admin": "Madurai district",
  "ward-admin": "Ward scope (MMC)",
  "basin-system": "Vaigai system",
  "cross-state": "TN + Kerala (cross-state)",
};

interface FeatureNotYetAvailableProps {
  config: PlaceConfig;
  feature: string;
  scope: FeatureScope;
  /** Short human-readable description of what this page covers in Chennai. */
  whatItShowsForChennai: string;
  /** What data is needed for this place; null = not blocked, just not built yet. */
  dataGapNote?: string;
  /** Source URL or research-memo reference for the parity status. */
  parityVerdict?: "FULL" | "EASY" | "MEDIUM" | "HARD" | "GAP";
  /** Cross-link back to a related page that's live, e.g. /madurai or /madurai/groundwater. */
  relatedLinks?: { href: string; label: string }[];
}

export function FeatureNotYetAvailable({
  config,
  feature,
  scope,
  whatItShowsForChennai,
  dataGapNote,
  parityVerdict,
  relatedLinks,
}: FeatureNotYetAvailableProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant="outline" className="text-xs">
          {config.displayName} · {feature}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {SCOPE_LABEL[scope]}
        </Badge>
        {parityVerdict && (
          <Badge variant="outline" className="text-xs">
            parity: {parityVerdict}
          </Badge>
        )}
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          Not yet available for {config.displayName}
        </Badge>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
        {feature} for {config.displayName}
      </h1>
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6">
        Chennai&apos;s version of this page shows {whatItShowsForChennai}. The
        equivalent for {config.displayName} hasn&apos;t shipped yet - the rest
        of the dashboard is being decoupled to be place-aware before this page
        gets its data layer.
      </p>

      {dataGapNote && (
        <Card className="mb-6">
          <CardContent>
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
              What we need to ship this
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {dataGapNote}
            </p>
          </CardContent>
        </Card>
      )}

      {relatedLinks && relatedLinks.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            What&apos;s live now for {config.displayName}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {link.label}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
