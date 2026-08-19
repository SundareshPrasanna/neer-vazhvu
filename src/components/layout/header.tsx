"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/context";
import { LanguageToggle } from "./language-toggle";
import { CitySwitcher } from "./city-switcher";
import { parsePath, rewriteNavHref, isFeatureSupportedForCity } from "@/lib/cities/routing";
import { waterwayNavHref } from "@/lib/waterways";

const TOP_NAV = [
  { href: "/origins", key: "nav.story" },
  { href: "/",        key: "nav.dashboard" },
  { href: "/my-ward", key: "nav.my_ward" },
  { href: "/facts",   key: "nav.facts" },
  { href: "/tanker",  key: "nav.tanker" },
] as const;

const EXPLORE_ITEMS = [
  { href: "/groundwater",  key: "nav.groundwater" },
  { href: "/water-bodies", key: "nav.water_bodies" },
  { href: "/rivers",       key: "nav.rivers" },
  { href: "/flood-risk",   key: "nav.flood_risk" },
  { href: "/allocations",  key: "nav.allocations" },
  { href: "/commitments",  key: "nav.commitments" },
  { href: "/climate-risk", key: "nav.climate_risk" },
  { href: "/shoreline",    key: "nav.coastal" },
] as const;

const EXPLORE_PATHS: Set<string> = new Set(EXPLORE_ITEMS.map((i) => i.href));

const AFTER_NAV = [
  { href: "/about", key: "nav.about" },
] as const;

function ThemeToggle() {
  const { t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-11 h-11" />;
  }

  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const ariaLabel = isDark ? t("theme.switch_to_light") : t("theme.switch_to_dark");

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="p-2.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label={ariaLabel}
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function NavLink({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      {label}
    </Link>
  );
}

function ExploreDropdown({
  pathname,
  cityId,
  t,
}: {
  pathname: string;
  cityId: string;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Active when ANY explore link's city-aware href matches the current path.
  // Only features the city supports: an unsupported feature rewrites to the
  // city HOME, which would light Explore up alongside Dashboard on /<city>
  // (seen on Mumbai, which lacks climate-risk).
  const exploreCityHrefs = new Set(
    EXPLORE_ITEMS.filter((i) => isFeatureSupportedForCity(i.href, cityId)).map((i) =>
      rewriteNavHref(i.href, cityId),
    ),
  );
  const isExploreActive = exploreCityHrefs.has(pathname) || EXPLORE_PATHS.has(pathname);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "px-3 py-2.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1",
          isExploreActive
            ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        {t("nav.explore")}
        <svg className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
          {EXPLORE_ITEMS.filter((item) => isFeatureSupportedForCity(item.href, cityId)).map((item) => {
            const cityHref = rewriteNavHref(item.href, cityId);
            return (
              <Link
                key={item.href}
                href={cityHref}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-4 py-2.5 text-sm transition-colors",
                  pathname === cityHref
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
          {/* Registry-driven, no city hardcoding: appears only for cities
              with a visible waterway; new waterways (Adyar, Cooum, ...)
              join by manifest, never by editing this list. */}
          {waterwayNavHref(cityId) && (
            <Link
              href={waterwayNavHref(cityId)!}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t("nav.waterways")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  // /embed/* is the chrome-less namespace for third-party iframes; those
  // pages carry their own compact credit bar instead of the site chrome.
  // Checked in this thin wrapper (its only hook) so SiteHeader's own hooks
  // never run conditionally.
  const pathname = usePathname();
  if (pathname.startsWith("/embed")) return null;
  return <SiteHeader />;
}

function SiteHeader() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Detect the current city from the URL so all nav links preserve it.
  // Without this, clicking "Dashboard" from /madurai/groundwater would
  // navigate to / and silently reset the user back to Chennai.
  const { cityId } = parsePath(pathname);

  // Resolve current page label for mobile indicator (client-only to avoid
  // hydration mismatch). Compare against the city-aware href since that's
  // what the nav actually links to.
  const allItems = [...TOP_NAV, ...EXPLORE_ITEMS, ...AFTER_NAV];
  const currentPage = mounted
    ? allItems.find((item) => {
        const cityHref = rewriteNavHref(item.href, cityId);
        return cityHref === pathname && cityHref !== "/" && cityHref !== `/${cityId}`;
      })
    : null;
  const currentPageLabel = currentPage ? t(currentPage.key) : null;

  // Logo returns to the project landing page ("/") from any city. The
  // per-city home is still reachable via the "Dashboard" nav item.
  const homeHref = "/";

  const isExploreActive =
    EXPLORE_PATHS.has(pathname) ||
    EXPLORE_ITEMS.filter((i) => isFeatureSupportedForCity(i.href, cityId)).some(
      (i) => rewriteNavHref(i.href, cityId) === pathname,
    );

  // The root path "/" is the project landing page, not a city, and
  // /waterways/* pages span city boundaries. Render a minimal header on
  // both: brand + theme toggle, with no per-city feature nav
  // (Dashboard/Groundwater/... only make sense inside a city, and
  // parsePath would silently resolve these routes to Chennai).
  if (pathname === "/" || pathname.startsWith("/waterways")) {
    return (
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-[10000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none">
                  <path
                    d="M12 3s-5 6.1-5 9.9A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1C17 9.1 12 3 12 3z"
                    fill="currentColor"
                  />
                  <path
                    d="M8.4 12.7c1 .8 2.2 1.2 3.6 1.2s2.6-.4 3.6-1.2"
                    stroke="#0ea5e9"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {t("header.title")}
                </span>
                <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 ml-2">
                  {t("header.subtitle")}
                </span>
              </div>
            </Link>
            {/* No CitySwitcher or LanguageToggle here: the landing page is not
                a city (a switcher defaulting to Chennai would mislead), and the
                regional-language toggle is a per-city UI concern. */}
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-[10000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 min-w-0">
            <Link href={homeHref} className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-white"
                  fill="none"
                >
                  <path
                    d="M12 3s-5 6.1-5 9.9A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1C17 9.1 12 3 12 3z"
                    fill="currentColor"
                  />
                  <path
                    d="M8.4 12.7c1 .8 2.2 1.2 3.6 1.2s2.6-.4 3.6-1.2"
                    stroke="#0ea5e9"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100 hidden sm:inline">{t("header.title")}</span>
                <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 ml-2">
                  {t("header.subtitle")}
                </span>
              </div>
            </Link>
            {/* Mobile: show current page name instead of app title. Truncates
                so a long label can never push into the city switcher. */}
            {currentPageLabel && (
              <span className="sm:hidden text-sm font-semibold text-slate-700 dark:text-slate-300 truncate min-w-0">
                {currentPageLabel}
              </span>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-2">
            {TOP_NAV.filter((item) => isFeatureSupportedForCity(item.href, cityId)).map((item) => {
              const cityHref = rewriteNavHref(item.href, cityId);
              return (
                <NavLink key={item.href} href={cityHref} label={t(item.key)} active={pathname === cityHref} />
              );
            })}
            <ExploreDropdown pathname={pathname} cityId={cityId} t={t} />
            {AFTER_NAV.filter((item) => isFeatureSupportedForCity(item.href, cityId)).map((item) => {
              const cityHref = rewriteNavHref(item.href, cityId);
              return (
                <NavLink key={item.href} href={cityHref} label={t(item.key)} active={pathname === cityHref} />
              );
            })}
            <CitySwitcher />
            <LanguageToggle />
            <ThemeToggle />
          </nav>

          {/* Mobile: toggles + hamburger */}
          <div className="flex sm:hidden items-center gap-1 shrink-0 pl-2">
            <CitySwitcher />
            <LanguageToggle />
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav className="sm:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-[70vh] overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-2 space-y-1">
            {TOP_NAV.filter((item) => isFeatureSupportedForCity(item.href, cityId)).map((item) => {
              const cityHref = rewriteNavHref(item.href, cityId);
              return (
                <Link
                  key={item.href}
                  href={cityHref}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    pathname === cityHref
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}

            {/* Explore group */}
            <button
              onClick={() => setMobileExploreOpen((v) => !v)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-md text-sm font-medium transition-colors",
                isExploreActive
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {t("nav.explore")}
              <svg className={cn("w-4 h-4 transition-transform", mobileExploreOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {mobileExploreOpen && (
              <div className="pl-4 space-y-1">
                {EXPLORE_ITEMS.filter((item) => isFeatureSupportedForCity(item.href, cityId)).map((item) => {
                  const cityHref = rewriteNavHref(item.href, cityId);
                  return (
                    <Link
                      key={item.href}
                      href={cityHref}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "block px-4 py-2.5 rounded-md text-sm transition-colors",
                        pathname === cityHref
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  );
                })}
                {/* Same registry-driven entry as the desktop dropdown. */}
                {waterwayNavHref(cityId) && (
                  <Link
                    href={waterwayNavHref(cityId)!}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-md text-sm transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t("nav.waterways")}
                  </Link>
                )}
              </div>
            )}

            {AFTER_NAV.filter((item) => isFeatureSupportedForCity(item.href, cityId)).map((item) => {
              const cityHref = rewriteNavHref(item.href, cityId);
              return (
                <Link
                  key={item.href}
                  href={cityHref}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    pathname === cityHref
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
