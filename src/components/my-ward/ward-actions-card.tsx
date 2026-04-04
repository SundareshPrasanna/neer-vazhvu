"use client";

import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WardRepresentatives } from "@/components/insights/ward-representatives";

interface Props {
  wardNumber: number;
}

export function WardActionsCard({ wardNumber }: Props) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t("my_ward.actions")}
        </h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:hidden">
          <a
            href="https://gccservices.in/pgr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("my_ward.report_issue")}</p>
              <p className="text-[10px] text-slate-400">GCC Online Services</p>
            </div>
          </a>

          <a
            href="https://www.cmwssb.tn.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("my_ward.cmwssb_portal")}</p>
              <p className="text-[10px] text-slate-400">CMWSSB</p>
            </div>
          </a>
        </div>

        {/* Representatives */}
        <WardRepresentatives wardNumber={wardNumber} />
      </CardContent>
    </Card>
  );
}
