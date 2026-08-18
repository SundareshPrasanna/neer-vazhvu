"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { parsePath } from "@/lib/cities/routing";

/** Full-screen map pages where the footer would cause a second scrollbar */
const FULL_SCREEN_PAGES = ["/rivers", "/groundwater", "/water-bodies"];

/** Top three live sources we surface in the footer per city. The full
 *  per-city catalogue lives on the city's about page; this is the
 *  recognisable shorthand readers see on every other surface. */
const CITY_FOOTER_SOURCES: Record<
  string,
  { label: string; href: string }[]
> = {
  chennai: [
    { label: "CMWSSB", href: "https://cmwssb.tn.gov.in/lake-level" },
    { label: "NASA POWER", href: "https://power.larc.nasa.gov/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
  madurai: [
    { label: "TN Agriculture", href: "https://www.tnagrisnet.tn.gov.in/" },
    { label: "India WRIS", href: "https://indiawris.gov.in/wris/" },
    { label: "CPCB NWMP", href: "https://cpcb.gov.in/water-quality-data/" },
  ],
  bangalore: [
    { label: "BWSSB", href: "https://bwssb.karnataka.gov.in/" },
    { label: "India WRIS", href: "https://indiawris.gov.in/wris/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
  pune: [
    { label: "PMC", href: "https://webadmin.pmc.gov.in/en/jsonapi/node/reports_and_dpr" },
    { label: "WRD Pravah", href: "https://mwrdpravah.in/damsafety/control/main" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
  ],
  mumbai: [
    { label: "WRD Pravah", href: "https://mwrdpravah.in/damsafety/control/main" },
    { label: "MPCB", href: "https://mpcb.gov.in/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
  delhi: [
    { label: "DJB", href: "https://delhijalboard.delhi.gov.in/" },
    { label: "DPCC", href: "https://dpcc.delhi.gov.in/dpcc/analysis-reports" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
  hyderabad: [
    { label: "HMWSSB", href: "https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx" },
    { label: "HMDA Lakes", href: "https://lakes.hmda.gov.in/" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
  kolkata: [
    { label: "KMC", href: "https://www.kmcgov.in/" },
    { label: "WBPCB EMIS", href: "https://emis.wbpcb.gov.in/" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
  ],
  gurugram: [
    { label: "GMDA", href: "https://www.gmda.gov.in/" },
    { label: "GMDA OneMap", href: "https://onemapdepts.gmda.gov.in/" },
    { label: "HSPCB", href: "https://hspcb.gov.in/" },
  ],
};

export function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();

  // /embed/* (third-party iframe namespace) carries its own credit bar.
  if (pathname.startsWith("/embed")) return null;
  if (FULL_SCREEN_PAGES.some((p) => pathname === p || pathname.endsWith(p))) {
    return null;
  }

  const { cityId } = parsePath(pathname);
  // Fall back to NOTHING, not to Chennai. The old `?? CITY_FOOTER_SOURCES.chennai`
  // meant any city missing from the map above told its readers that CMWSSB -
  // Chennai's utility - was one of their core live sources. Kolkata shipped
  // live that way, and Gurugram would have. A city with no entry now renders
  // no source list, which is merely incomplete rather than false.
  const sources = CITY_FOOTER_SOURCES[cityId] ?? [];
  const aboutHref = cityId === "chennai" ? "/about#data-sources" : `/${cityId}/about#data-sources`;

  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>
            {/* Label only when there is a list to label - an empty city would
                otherwise render "Core live sources:" followed by nothing. */}
            {sources.length > 0 && <>{t("footer.data_sources")}{" "}</>}
            {sources.map((s, i) => (
              <span key={s.label}>
                {i > 0 && " - "}
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {s.label}
                </a>
              </span>
            ))}
            {sources.length > 0 && " - "}
            <a
              href={aboutHref}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("footer.all_sources")}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span>{t("footer.open_source")}</span>
            <span className="text-slate-300 dark:text-slate-600">-</span>
            <a
              href="https://www.patreon.com/NeerVazhvu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("footer.support")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
