"use client";

import { Suspense } from "react";
import { WardReportCard } from "@/components/my-ward/ward-report-card";
import { useLanguage } from "@/lib/i18n/context";

export default function ReportPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          {t("report.loading_report")}
        </div>
      }
    >
      <WardReportCard />
    </Suspense>
  );
}
