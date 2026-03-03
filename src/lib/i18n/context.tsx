"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "./translations";
import type { Language } from "./translations";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (key) => translations[key]?.en ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  // Read persisted preference after mount to avoid hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const stored = localStorage.getItem("neer-vazhvu-lang") as Language;
    if (stored === "en" || stored === "ta") {
      setLanguageState(stored);
    }
  }, []);

  // Persist + update <html lang> whenever language changes
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("neer-vazhvu-lang", language);
    document.documentElement.lang = language === "ta" ? "ta" : "en";
  }, [language, mounted]);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
  }

  function t(key: string): string {
    return translations[key]?.[language] ?? translations[key]?.en ?? key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
