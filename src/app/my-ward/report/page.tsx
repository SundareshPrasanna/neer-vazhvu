"use client";

import { Suspense } from "react";
import { WardReportCard } from "@/components/my-ward/ward-report-card";

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Loading report...
        </div>
      }
    >
      <WardReportCard />
    </Suspense>
  );
}
