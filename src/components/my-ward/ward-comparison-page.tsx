"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { loadProfiles, type WardProfile } from "@/lib/hooks/use-ward-profile";
import { computeWardRankings, type WardRankings } from "@/lib/utils/ward-rankings";
import { downloadComparisonCSV } from "@/lib/utils/comparison-export";
import { parseWardsParam } from "@/lib/utils/parse-wards-param";
import { WardMultiSelector } from "@/components/my-ward/ward-multi-selector";
import { ComparisonTable } from "@/components/my-ward/comparison-table";
import { ShareMenu } from "@/components/share-menu";

export function WardComparisonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [allProfiles, setAllProfiles] = useState<WardProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const selectedWards = parseWardsParam(searchParams.get("wards"));

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    loadProfiles()
      .then((profiles) => {
        if (cancelled) return;
        setAllProfiles(profiles);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleUpdateWards = useCallback(
    (wards: number[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (wards.length > 0) {
        params.set("wards", wards.join(","));
      } else {
        params.delete("wards");
      }
      router.replace(`/my-ward/compare?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Filter to valid ward numbers that exist in profiles
  const validWards = allProfiles.length > 0
    ? selectedWards.filter((w) => allProfiles.some((p) => p.ward_number === w))
    : selectedWards;

  // Compute rankings for each valid ward
  const rankings: WardRankings[] = validWards
    .map((w) => computeWardRankings(w, allProfiles))
    .filter((r): r is WardRankings => r != null);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/my-ward/compare?wards=${validWards.join(",")}`
    : `/my-ward/compare?wards=${validWards.join(",")}`;

  const handleExport = () => {
    if (rankings.length >= 1) downloadComparisonCSV(rankings);
  };

  const handlePrint = () => window.print();

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        {t("compare.loading")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">
        {t("compare.no_data")}
      </div>
    );
  }

  return (
    <div className="comparison-card max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            href="/my-ward"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline print:hidden"
          >
            &larr; {t("compare.back")}
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {t("compare.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("compare.subtitle")}</p>
        </div>

        {/* Action buttons */}
        {rankings.length >= 1 && (
          <div className="flex items-center gap-2 print:hidden">
            <ShareMenu
              url={shareUrl}
              title={`Comparing Wards ${validWards.join(", ")} | Neer Vazhvu`}
            />
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t("compare.export_csv")}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {t("compare.print")}
            </button>
          </div>
        )}
      </div>

      {/* Ward selector */}
      {!loading && (
        <WardMultiSelector
          selectedWards={validWards}
          onUpdate={handleUpdateWards}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          {t("compare.loading")}
        </div>
      )}

      {/* Prompt when no wards selected */}
      {!loading && rankings.length === 0 && (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <p className="text-lg">{t("compare.select_prompt")}</p>
        </div>
      )}

      {/* Comparison table */}
      {!loading && rankings.length >= 1 && (
        <ComparisonTable rankings={rankings} />
      )}

      {/* Footer */}
      {rankings.length >= 1 && (
        <div className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2 print:pt-4">
          {t("compare.generated_by")}
        </div>
      )}
    </div>
  );
}
