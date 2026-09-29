"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { parsePath } from "@/lib/cities/routing";
import { tryGetPlaceConfig } from "@/lib/cities";

/** Full-screen map pages where the footer would cause a second scrollbar */
const FULL_SCREEN_PAGES = ["/rivers", "/groundwater", "/water-bodies"];

export function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();

  // /embed/* (third-party iframe namespace) carries its own credit bar.
  if (pathname.startsWith("/embed")) return null;
  if (FULL_SCREEN_PAGES.some((p) => pathname === p || pathname.endsWith(p))) {
    return null;
  }

  // Outside a city (landing, atlas, waterways) there is no city source list;
  // on a waterway "all sources" points at the page's own methods panel.
  const isWaterway = pathname.startsWith("/waterways");
  const { cityId } = parsePath(pathname);
  // Fall back to NOTHING, not to Chennai. The old `?? CITY_FOOTER_SOURCES.chennai`
  // meant any city missing from the map above told its readers that CMWSSB -
  // Chennai's utility - was one of their core live sources. Kolkata shipped
  // live that way, and Gurugram would have. A city with no entry now renders
  // no source list, which is merely incomplete rather than false.
  const sources = cityId ? (tryGetPlaceConfig(cityId)?.footerSources ?? []) : [];
  const aboutHref = isWaterway ? "#methods" : cityId ? `/${cityId}/about#data-sources` : null;

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
            {sources.length > 0 && aboutHref && " - "}
            {aboutHref && (
              <a
                href={aboutHref}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("footer.all_sources")}
              </a>
            )}
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
