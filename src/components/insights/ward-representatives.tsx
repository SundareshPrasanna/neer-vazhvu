"use client";

import { useWardRepresentatives } from "@/lib/hooks/use-ward-representatives";
import { useLanguage } from "@/lib/i18n/context";
import { useMyWardCity } from "@/components/my-ward/city-context";

interface WardRepresentativesProps {
  wardNumber: number;
}

const PARTY_COLORS: Record<string, string> = {
  DMK: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  TVK: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  AIADMK: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  INC: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  BJP: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  IND: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

function partyBadgeClass(party: string): string {
  return PARTY_COLORS[party] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function WardRepresentatives({ wardNumber }: WardRepresentativesProps) {
  const { t, language } = useLanguage();
  const { cityId } = useMyWardCity();
  const { representatives: reps, meta } = useWardRepresentatives(wardNumber, cityId);

  if (!reps) return null;

  const useTa = language === "ta";

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
        {t("reps.title")} - {t("ward.ward")} {wardNumber}
      </h4>
      <div className="space-y-1.5">
        {/* Councillor */}
        <RepRow
          label={t("reps.councillor")}
          name={reps.councillor.name}
          party={reps.councillor.party}
          phone={reps.councillor.phone}
        />

        {/* MLA - omitted for cities publishing councillors only (Delhi).
            The name falls back to the English name when name_ta is empty:
            some Chennai records have no Tamil transliteration yet (#182),
            and `useTa ? name_ta : name` rendered those as blank. */}
        {reps.mla && (
          <RepRow
            label={t("reps.mla")}
            name={(useTa && reps.mla.name_ta) || reps.mla.name}
            party={reps.mla.party}
            subtitle={
              t("reps.constituency").replace(
                "{name}",
                useTa ? reps.mla.constituency_ta : reps.mla.constituency
              )
            }
          />
        )}

        {/* MP */}
        {reps.mp && (
          <RepRow
            label={t("reps.mp")}
            name={(useTa && reps.mp.name_ta) || reps.mp.name}
            party={reps.mp.party}
            subtitle={
              t("reps.constituency").replace(
                "{name}",
                useTa ? reps.mp.constituency_ta : reps.mp.constituency
              )
            }
          />
        )}
      </div>

      {/* Source disclaimer */}
      {meta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 dark:text-slate-500">
          <span>
            {reps.mla || reps.mp
              ? t("reps.source_note")
                  .replace("{councillor_year}", meta.councillor_election.slice(0, 4))
                  .replace("{mla_year}", (meta.mla_election ?? meta.councillor_election).slice(0, 4))
                  .replace("{mp_year}", (meta.mp_election ?? meta.councillor_election).slice(0, 4))
              : t("reps.source_note_councillor_only").replace(
                  "{councillor_year}",
                  meta.councillor_election.slice(0, 4),
                )}
          </span>
          <span className="hidden sm:inline">|</span>
          <a
            href={meta.sources.councillors}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-500 underline"
          >
            {t("reps.source")}
          </a>
          <span>|</span>
          <a
            href="https://github.com/SundareshPrasanna/neer-vazhvu/issues/new?title=Ward+representative+data+error&labels=data"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-500 underline"
          >
            {t("reps.report_error")}
          </a>
        </div>
      )}
    </div>
  );
}

function RepRow({
  label,
  name,
  party,
  subtitle,
  phone,
}: {
  label: string;
  name: string;
  party: string;
  subtitle?: string;
  phone?: string;
}) {
  return (
    <div className="flex items-start justify-between px-2 py-1.5 rounded-md text-sm">
      <span className="text-slate-500 dark:text-slate-400 text-xs shrink-0 pt-0.5">
        {label}
      </span>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-700 dark:text-slate-300 text-xs text-right">
            {name}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${partyBadgeClass(party)}`}
          >
            {party}
          </span>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 shrink-0"
              title={phone}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          )}
        </div>
        {subtitle && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
