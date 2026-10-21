"use client";

import { muted } from "./ui";

/** A pressable pill: one of a few short answers. */
export const chip =
  "h-10 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 aria-pressed:border-cyan-700 aria-pressed:bg-cyan-700 aria-pressed:text-white " +
  "dark:border-slate-600 dark:text-slate-300";

/** One choice from a few, as a row of chips; tapping the chosen one again clears it when optional. */
export function Choice<K extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  optional,
  tag,
}: {
  legend: string;
  hint?: string;
  options: readonly { key: K; label: string }[];
  value: K | null;
  onChange: (k: K | null) => void;
  optional?: boolean;
  /** A quiet word after the legend, such as "Optional". */
  tag?: string;
}) {
  return (
    <fieldset>
      <legend className="font-medium text-slate-900 dark:text-slate-100">
        {legend}
        {tag && <span className={`font-normal ${muted}`}> {tag}</span>}
      </legend>
      {hint && <p className={`mt-1 text-sm ${muted}`}>{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(value === o.key && optional ? null : o.key)} className={chip}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
