"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";

interface WardNarrativeData {
  date: string;
  headline_en: string;
  headline_ta: string;
  body_en: string;
  body_ta: string;
  source_dates: {
    reservoir_date: string | null;
    gw_period: string | null;
    risk_date: string | null;
  } | null;
  key_facts: string[] | null;
}

interface WardNarrativeProps {
  wardNumber: number;
}

export function WardNarrative({ wardNumber }: WardNarrativeProps) {
  const { language, t } = useLanguage();
  const [data, setData] = useState<WardNarrativeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setData(null);
    });

    fetch(`/api/narratives/ward?ward=${wardNumber}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json.narrative ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [wardNumber]);

  if (loading || !data) return null;

  const headline = language === "ta" ? data.headline_ta : data.headline_en;
  const body = language === "ta" ? data.body_ta : data.body_en;

  // Build freshness string from source dates
  const freshnessParts: string[] = [];
  if (data.source_dates?.reservoir_date) {
    freshnessParts.push(`${t("ai_narrative.reservoirs")}: ${data.source_dates.reservoir_date}`);
  }
  if (data.source_dates?.gw_period) {
    freshnessParts.push(`${t("ai_narrative.groundwater")}: ${data.source_dates.gw_period}`);
  }

  return (
    <div className="border-l-4 border-l-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-r-lg px-4 py-3 mt-4">
      <h4 className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1.5">
        {t("ai_narrative.ward_heading")}
      </h4>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <span className="font-semibold">{headline}</span>{" "}
        {body}
      </p>
      {data.key_facts && data.key_facts.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.key_facts.map((fact, i) => (
            <li key={i} className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
              <span className="text-indigo-400 mt-0.5">-</span>
              {fact}
            </li>
          ))}
        </ul>
      )}
      {freshnessParts.length > 0 && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
          {freshnessParts.join(" | ")}
        </p>
      )}
    </div>
  );
}
