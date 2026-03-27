"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

interface ConnectedInsightProps {
  /** i18n key for the insight text */
  messageKey: string;
  /** Template params for the message */
  params?: Record<string, string | number>;
  /** Navigation target */
  linkHref: string;
  /** i18n key for the link text */
  linkKey: string;
}

/** Interpolate template params into a translated string */
function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

/**
 * A small "Connected" block that appears in detail panels to link
 * the selected item to other parts of the story. Only render this
 * when evidence is strong enough - the parent component handles
 * the threshold check before mounting.
 */
export function ConnectedInsight({
  messageKey,
  params,
  linkHref,
  linkKey,
}: ConnectedInsightProps) {
  const { t } = useLanguage();

  const message = params
    ? interpolate(t(messageKey), params)
    : t(messageKey);

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
      <div className="flex items-start gap-2">
        <svg
          className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.907-3.03l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
          />
        </svg>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {message}
          </p>
          <Link
            href={linkHref}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1 mt-1"
          >
            {t(linkKey)}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
