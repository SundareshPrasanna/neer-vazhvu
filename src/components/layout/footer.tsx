"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";

/** Full-screen map pages where the footer would cause a second scrollbar */
const FULL_SCREEN_PAGES = ["/rivers", "/groundwater", "/water-bodies"];

export function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();

  if (FULL_SCREEN_PAGES.includes(pathname)) return null;

  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>
            {t("footer.data_sources")}{" "}
            <a
              href="https://cmwssb.tn.gov.in/lake-level"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              CMWSSB
            </a>
            {" · "}
            <a
              href="https://power.larc.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              NASA POWER
            </a>
            {" · "}
            <a
              href="https://data.opencity.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              OpenCity Chennai
            </a>
            {" · "}
            <a
              href="/about#data-sources"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("footer.all_sources")}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span>{t("footer.open_source")}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
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
