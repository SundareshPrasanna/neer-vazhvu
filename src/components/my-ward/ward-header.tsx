"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import type { GroundwaterData } from "@/lib/hooks/use-my-ward-data";
import type { RepresentativeData } from "@/lib/hooks/use-ward-representatives";
import { generateWardCSV, downloadCSV } from "@/lib/utils/ward-export";
import { ShareMenu } from "@/components/share-menu";
import { useMyWardCity } from "./city-context";

interface WardHeaderProps {
  wardNumber: number;
  zoneName: string;
  profile: WardProfile;
  groundwater: GroundwaterData | null;
  representatives: RepresentativeData | null;
}

export function WardHeader({ wardNumber, zoneName, profile, groundwater, representatives }: WardHeaderProps) {
  const { t } = useLanguage();
  const { cityPrefix } = useMyWardCity();

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${cityPrefix}/my-ward?ward=${wardNumber}`
    : `${cityPrefix}/my-ward?ward=${wardNumber}`;

  const handleExport = () => {
    const csv = generateWardCSV(
      wardNumber,
      zoneName,
      profile,
      groundwater ? { depthM: groundwater.depthM, trend: groundwater.trend, riskLevel: groundwater.riskLevel, riskScore: groundwater.riskScore } : null,
      representatives ? {
        councillor: { name: representatives.councillor.name, party: representatives.councillor.party, phone: representatives.councillor.phone },
        // MLA/MP are optional - cities may publish councillors only (Delhi).
        mla: representatives.mla
          ? { name: representatives.mla.name, party: representatives.mla.party, constituency: representatives.mla.constituency }
          : undefined,
        mp: representatives.mp
          ? { name: representatives.mp.name, party: representatives.mp.party, constituency: representatives.mp.constituency }
          : undefined,
      } : null,
    );
    downloadCSV(csv, `ward-${wardNumber}-report.csv`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t("ward.ward")} {wardNumber} - {zoneName}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("my_ward.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2 print:hidden">
        {/* Report Card */}
        <Link
          href={`${cityPrefix}/my-ward/report?ward=${wardNumber}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t("report.button")}
        </Link>

        {/* Compare Wards */}
        <Link
          href={`${cityPrefix}/my-ward/compare?wards=${wardNumber}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          {t("compare.button")}
        </Link>

        {/* Share */}
        <ShareMenu
          url={shareUrl}
          title={`Ward ${wardNumber} - ${zoneName} | Neer Vazhvu`}
          description={t("share.ward_report")}
          ogImageUrl={`/api/og/ward?ward=${wardNumber}`}
        />

        {/* Export CSV */}
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t("my_ward.export_csv")}
        </button>

        {/* Print */}
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {t("my_ward.print")}
        </button>
      </div>
    </div>
  );
}
