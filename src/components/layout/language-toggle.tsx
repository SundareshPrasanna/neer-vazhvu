"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  const isTamil = language === "ta";

  return (
    <button
      onClick={() => setLanguage(isTamil ? "en" : "ta")}
      className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 transition-colors leading-none"
      aria-label={isTamil ? t("lang.switch_to_english") : t("lang.view_in_tamil")}
      title={isTamil ? t("lang.switch_to_english") : t("lang.switch_to_tamil")}
    >
      {isTamil ? "EN" : "த"}
    </button>
  );
}
