"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WardRepresentatives } from "@/components/insights/ward-representatives";
import { useMyWardCity } from "./city-context";

interface QuickAction {
  /** Translation key for the prominent label */
  labelKey: string;
  /** Sub-label below the action (operator/agency name, plain text) */
  subLabel: string;
  href: string;
  /** Pick the icon shape: "complaint" (warning) or "portal" (cube) */
  icon: "complaint" | "portal";
}

interface Helpline {
  labelKey: string;
  value: string | null;
  href: string;
}

interface CityActionsConfig {
  quickActions: QuickAction[];
  helplines: Helpline[];
}

/** Per-city action card configuration. Add a new entry when onboarding
 *  another city - keeps phone numbers, agency names, and portal URLs
 *  in one place rather than hardcoding Chennai everywhere. */
const ACTIONS_BY_CITY: Record<string, CityActionsConfig> = {
  chennai: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "GCC Online Services",
        href: "https://gccservices.in/pgr",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.cmwssb_portal",
        subLabel: "CMWSSB",
        href: "https://www.cmwssb.tn.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "044-2845 2572", href: "tel:04428452572" },
      { labelKey: "my_ward.hl_tanker_booking", value: "044-2845 1515", href: "tel:04428451515" },
      { labelKey: "my_ward.hl_cmwssb_whatsapp", value: "9445147200", href: "https://wa.me/919445147200" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1913", href: "tel:1913" },
      { labelKey: "my_ward.hl_rwh_info", value: null, href: "https://www.cmwssb.tn.gov.in/rain-water-harvesting" },
    ],
  },
  bangalore: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "BWSSB (helpline 1916)",
        href: "https://bwssb.karnataka.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "BBMP",
        href: "https://bbmp.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1916", href: "tel:1916" },
      { labelKey: "my_ward.hl_flood_emergency", value: "112", href: "tel:112" },
    ],
  },
  mumbai: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "BMC central helpline 1916",
        href: "https://portal.mcgm.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "BMC Hydraulic Engineer (lake levels)",
        href: "https://portal.mcgm.gov.in/irj/portal/anonymous/qllakelevel",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1916", href: "tel:1916" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1916", href: "tel:1916" },
    ],
  },
  // PUNE. Added WITH the cutover rather than after it, because line 152 reads
  // `ACTIONS_BY_CITY[cityId] ?? ACTIONS_BY_CITY.chennai` - a missing city does
  // not render an empty card, it renders CHENNAI'S HELPLINES. A Pune resident
  // would have been given CMWSSB's number.
  //
  // The toll-free number is PMC's own, read off its grievance portal
  // (complaint.pmc.gov.in) where it is captioned in Marathi as the call centre
  // for "सूचना आणि तक्रारींसाठी" - suggestions and complaints. Nothing here is
  // inferred: PMC publishes no separate water-supply or flood number that
  // could be verified, so those entries carry value:null and a URL rather than
  // a plausible-looking digit string.
  pune: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "PMC grievance portal",
        href: "https://complaint.pmc.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Pune Municipal Corporation",
        href: "https://pmc.gov.in/en/grievance",
        icon: "portal",
      },
    ],
    helplines: [
      {
        labelKey: "my_ward.hl_water_complaint",
        value: "1800 1030 222",
        href: "tel:18001030222",
      },
      {
        // PMC dispatches tankers but publishes no booking line: the daily
        // registers behind /pune/tanker are a record of what was sent, not a
        // way to ask. Points at that page rather than inventing a number.
        labelKey: "my_ward.hl_tanker_booking",
        value: null,
        href: "/pune/tanker",
      },
    ],
  },
  delhi: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "DJB grievance redressal",
        href: "https://delhijalboard.delhi.gov.in/jalboard/grievance-redressal-mechanism",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Delhi Jal Board",
        href: "https://delhijalboard.delhi.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1916", href: "tel:1916" },
      { labelKey: "my_ward.hl_tanker_booking", value: null, href: "https://djb.gov.in/DJBWaterTanker/" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1077", href: "tel:1077" },
    ],
  },
  madurai: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "Madurai Corporation (MMC)",
        href: "https://www.maduraicorporation.co.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "TWAD Board (Madurai)",
        href: "https://www.twadboard.tn.gov.in/content/madurai",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_mmc_helpline", value: "1913", href: "tel:1913" },
      { labelKey: "my_ward.hl_mmc_water", value: "0452-253 4222", href: "tel:04522534222" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1913", href: "tel:1913" },
    ],
  },
};

interface Props {
  wardNumber: number;
}

export function WardActionsCard({ wardNumber }: Props) {
  const { t } = useLanguage();
  const { cityId } = useMyWardCity();
  const [helpOpen, setHelpOpen] = useState(false);
  // Fall back to Chennai when no per-city config is registered, so a new
  // city onboarded without an entry here at least renders something
  // sensible until its config lands.
  const actionsConfig = ACTIONS_BY_CITY[cityId] ?? ACTIONS_BY_CITY.chennai;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t("my_ward.actions")}
        </h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick actions - per-city config from ACTIONS_BY_CITY */}
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
