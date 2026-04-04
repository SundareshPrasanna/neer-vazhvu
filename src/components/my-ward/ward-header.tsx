"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import type { GroundwaterData } from "@/lib/hooks/use-my-ward-data";
import type { RepresentativeData } from "@/lib/hooks/use-ward-representatives";
import { generateWardCSV, downloadCSV } from "@/lib/utils/ward-export";

interface WardHeaderProps {
  wardNumber: number;
  zoneName: string;
  profile: WardProfile;
  groundwater: GroundwaterData | null;
  representatives: RepresentativeData | null;
}

export function WardHeader({ wardNumber, zoneName, profile, groundwater, representatives }: WardHeaderProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/my-ward?ward=${wardNumber}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
      window.prompt("Copy this link:", url);
    }
  };

  const handleExport = () => {
    const csv = generateWardCSV(
      wardNumber,
      zoneName,
      profile,
      groundwater ? { depthM: groundwater.depthM, trend: groundwater.trend, riskLevel: groundwater.riskLevel, riskScore: groundwater.riskScore } : null,
      representatives ? {
        councillor: { name: representatives.councillor.name, party: representatives.councillor.party, phone: representatives.councillor.phone },
        mla: { name: representatives.mla.name, party: representatives.mla.party, constituency: representatives.mla.constituency },
        mp: { name: representatives.mp.name, party: representatives.mp.party, constituency: representatives.mp.constituency },
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
        {/* Share */}
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {copied ? t("my_ward.copied") : t("my_ward.share")}
        </button>

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
