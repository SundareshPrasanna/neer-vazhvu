"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WardRepresentatives } from "@/components/insights/ward-representatives";
import { useMyWardCity } from "./city-context";
import { MY_WARD_CONTENT } from "@/cities/generated/my-ward";
import type { CityId } from "@/lib/cities/ids";

interface Props {
  wardNumber: number;
}

export function WardActionsCard({ wardNumber }: Props) {
  const { t } = useLanguage();
  const { cityId } = useMyWardCity();
  const [helpOpen, setHelpOpen] = useState(false);
  // NO FALLBACK. This used to read `?? ACTIONS_BY_CITY.chennai`, on the
  // reasoning that a city onboarded without an entry would "at least render
  // something sensible". What it actually rendered was ANOTHER CITY'S
  // EMERGENCY NUMBERS: a Gurugram resident opening this card was shown
  // CMWSSB's complaint line, Chennai's water utility, 1,900 km away. That is
  // not a degraded experience, it is wrong information presented with the same
  // confidence as right information - the one failure mode a card full of
  // helplines must not have.
  //
  // Rendering nothing is the honest degradation: the ward page keeps its other
  // sections, and a missing city is VISIBLY missing rather than silently
  // wearing Chennai's. Adding a city here is a launch step, and now it fails
  // loudly enough to notice. See issue #286.
  const actionsConfig = MY_WARD_CONTENT[cityId as CityId]?.actions;
  if (!actionsConfig) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t("my_ward.actions")}
        </h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick actions - the city's own, from src/cities/<id>/my-ward.ts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:hidden">
          {actionsConfig.quickActions.map((action) => (
            <a
              key={action.labelKey}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {action.icon === "complaint" ? (
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t(action.labelKey)}</p>
                <p className="text-[10px] text-slate-400">{action.subLabel}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Helplines & Resources - collapsible */}
        <div className="print:hidden">
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${helpOpen ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            {t("my_ward.hl_title")}
          </button>
          {helpOpen && (
            <div className="mt-2 ml-4.5 space-y-1.5">
              {actionsConfig.helplines.map((h) => (
                <a
                  key={h.labelKey}
                  href={h.href}
                  target={h.href.startsWith("http") ? "_blank" : undefined}
                  rel={h.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex items-center justify-between text-xs py-0.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span>{t(h.labelKey)}</span>
                  <span className="font-mono text-[11px]">{h.value ?? "→"}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Representatives */}
        <WardRepresentatives wardNumber={wardNumber} />
      </CardContent>
    </Card>
  );
}
