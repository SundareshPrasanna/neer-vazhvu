"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { translations, isLanguageCode } from "./translations";
import type { Language, LanguageCode } from "./translations";
import { resolveAvailableLanguagesForPath } from "./available-languages";

interface LanguageContextValue {
  language: Language;
  /**
   * Languages available in the current city's UI, in display order.
   * Always includes 'en'. Derived from `usePathname()` so the toggle
   * automatically reflects the city the user is on.
   */
  availableLanguages: readonly LanguageCode[];
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = "neer-vazhvu-lang";

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  availableLanguages: ["en"],
  setLanguage: () => {},
  t: (key) => translations[key]?.en ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Stored preference - what the user picked (or null until hydrated).
  // The displayed `language` is derived from this and the city's
  // available list, so a stored 'ta' visiting /bangalore renders en
  // without writing back to localStorage.
  const [storedLanguage, setStoredLanguage] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  // Available languages for this URL - resolved synchronously so SSR
  // and initial render agree.
  const availableLanguages = useMemo(
    () => resolveAvailableLanguagesForPath(pathname ?? "/"),
    [pathname],
  );

  // Effective language: stored preference if it's offered here, else
  // the city's first available (always 'en' or the city's primary).
  // Derived during render - no setState-in-effect cascade.
  const language: Language = availableLanguages.includes(storedLanguage)
    ? storedLanguage
    : availableLanguages[0];

  // Read persisted preference once after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(stored)) {
      setStoredLanguage(stored);
    }
  }, []);

  // Persist + update <html lang> when the user explicitly chooses.
  // Effective `language` is the source of truth for what the page is
  // rendering in - that's what we mark on <html>. localStorage tracks
  // the user's explicit preference (storedLanguage) so it survives
  // the temporary fallback when visiting a city that doesn't offer it.
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, storedLanguage);
  }, [storedLanguage, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = language;
  }, [language, mounted]);

  function setLanguage(lang: Language) {
    // Defensive: reject preferences not offered by the current city.
    if (!availableLanguages.includes(lang)) return;
    setStoredLanguage(lang);
  }

  function t(key: string): string {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] ?? entry.en;
  }

  return (
    <LanguageContext.Provider
      value={{ language, availableLanguages, setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
