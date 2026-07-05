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
    { label: "CPCB NWMP", href: "https://cpcb.nic.in/water-quality-data/" },
  ],
  bangalore: [
    { label: "BWSSB", href: "https://bwssb.karnataka.gov.in/" },
    { label: "India WRIS", href: "https://indiawris.gov.in/wris/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
  mumbai: [
    { label: "WRD Pravah", href: "https://mwrdpravah.in/damsafety/control/main" },
    { label: "MPCB", href: "https://mpcb.gov.in/" },
    { label: "OpenCity", href: "https://data.opencity.in/" },
  ],
};

export function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();

  if (FULL_SCREEN_PAGES.some((p) => pathname === p || pathname.endsWith(p))) {
    return null;
  }

  const { cityId } = parsePath(pathname);
  const sources = CITY_FOOTER_SOURCES[cityId] ?? CITY_FOOTER_SOURCES.chennai;
  const aboutHref = cityId === "chennai" ? "/about#data-sources" : `/${cityId}/about#data-sources`;

  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>
            {t("footer.data_sources")}{" "}
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
            {" - "}
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
