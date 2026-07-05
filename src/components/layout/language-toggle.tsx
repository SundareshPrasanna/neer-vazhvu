"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { resolveUpcomingLanguagesForPath } from "@/lib/i18n/available-languages";
import { LANGUAGE_LABELS, type LanguageCode } from "@/lib/i18n/translations";

/**
 * Language switcher. UX adapts to how many languages the current city
 * offers (driven by `availableLanguages` in the LanguageContext, which
 * itself derives from the URL's city config):
 *
 *   - 1 language (English-only city): button hidden entirely.
 *   - 2 languages: simple cycle button (the historical TN UX).
 *   - 3+ languages: button-with-popover listing all options.
 *
 * Each button shows the script glyph for the *next* language to switch
 * to (when a 2-lang cycle), or the current language's glyph (when a
 * popover - so the popover is "what am I in" + "what could I switch
 * to").
 */
/** Greyed, non-interactive chip for a language that is coming soon. */
function UpcomingChip({ code }: { code: LanguageCode }) {
  const label = LANGUAGE_LABELS[code];
  return (
    <span
      aria-disabled="true"
      title={`${label.native} (${label.english}) - coming soon`}
      className="px-2.5 h-9 inline-flex items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-300 dark:text-slate-600 bg-white dark:bg-slate-900 cursor-not-allowed select-none leading-none"
    >
      {label.toggle}
    </span>
  );
}

export function LanguageToggle() {
  const { language, availableLanguages, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const upcoming = resolveUpcomingLanguagesForPath(pathname ?? "");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  if (availableLanguages.length <= 1) {
    // Nothing to switch to - but advertise languages on the way (Mumbai:
    // a greyed Marathi chip) so readers know the gap is temporary.
    if (upcoming.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-1.5">
        {upcoming.map((code) => (
          <UpcomingChip key={code} code={code} />
        ))}
      </span>
    );
  }

  if (availableLanguages.length === 2) {
    const other = availableLanguages.find((l) => l !== language) ?? "en";
    const otherLabel = LANGUAGE_LABELS[other];
    const cycle = (
      <button
        onClick={() => setLanguage(other)}
        className="px-2.5 h-9 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 transition-colors leading-none"
        aria-label={`Switch to ${otherLabel.english}`}
        title={`Switch to ${otherLabel.native}`}
      >
        {otherLabel.toggle}
      </button>
    );
    return upcoming.length === 0 ? (
      cycle
    ) : (
      <span className="inline-flex items-center gap-1.5">
        {cycle}
        {upcoming.map((code) => (
          <UpcomingChip key={code} code={code} />
        ))}
      </span>
    );
  }

  // 3+ languages: popover.
  const currentLabel = LANGUAGE_LABELS[language];
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("lang.choose_language") || `Choose language - currently ${currentLabel.english}`}
        aria-expanded={open}
        className="px-2.5 h-9 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 transition-colors leading-none"
      >
        {currentLabel.toggle}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-w-[calc(100vw-1rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
          {availableLanguages.map((code: LanguageCode) => {
            const label = LANGUAGE_LABELS[code];
            const isActive = code === language;
            return (
              <button
                key={code}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-3 ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span>{label.native}</span>
                <span className="text-xs text-slate-400">{label.english}</span>
              </button>
            );
          })}
          {upcoming.map((code) => {
            const label = LANGUAGE_LABELS[code];
            return (
              <div
                key={code}
                aria-disabled="true"
                title={`${label.native} (${label.english}) - coming soon`}
                className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-3 text-slate-300 dark:text-slate-600 cursor-not-allowed select-none"
              >
                <span>{label.native}</span>
                <span className="text-xs">coming soon</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
