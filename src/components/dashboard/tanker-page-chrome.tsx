"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

function tFmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/**
 * Client wrappers for the localisable parts of /[cityId]/tanker.
 * The parent page is a Server Component (it gates rendering on a JSON
 * file existing on disk), so any t()-driven prose lives here instead.
 */

export function TankerPageHeader({
  cityId,
  cityDisplayName,
}: {
  cityId: string;
  cityDisplayName: string;
}) {
  const { t } = useLanguage();
  void cityId;
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {tFmt(t("tanker_page.title"), { city: cityDisplayName })}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
        {t("tanker_page.intro")}
      </p>
    </header>
  );
}

export function TankerPageFooter({
  cityId,
  cityDisplayName,
}: {
  cityId: string;
  cityDisplayName: string;
}) {
  const { t } = useLanguage();
  return (
    <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {t("tanker_page.how_to_read")}
      </h2>
      <p>{t("tanker_page.note1")}</p>
      <p>{t("tanker_page.note2")}</p>
      <p>
        {tFmt(t("tanker_page.note3"), { city: cityDisplayName })
          .split(tFmt(t("tanker_page.home_dashboard"), { city: cityDisplayName }))
          .map((seg, i, arr) => (
            <span key={i}>
              {seg}
              {i < arr.length - 1 && (
                <Link
                  href={`/${cityId}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {tFmt(t("tanker_page.home_dashboard"), { city: cityDisplayName })}
                </Link>
              )}
            </span>
          ))}
      </p>
    </section>
  );
}
