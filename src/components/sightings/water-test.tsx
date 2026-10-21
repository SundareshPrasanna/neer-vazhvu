"use client";

import { AlertTriangle } from "lucide-react";

import { PARAMETERS, assess } from "@/lib/sightings/parameters";
import { WATER_SOURCES } from "@/lib/sightings/taxonomy";
import { MAX_MODEL_CHARS, TEST_CALIBRATED, TEST_FILTERED, TEST_INSTRUMENTS } from "@/lib/sightings/test-meta";
import { Choice } from "./choice";
import { fieldBox, field, muted, rule } from "./ui";
import type { Form, Patch } from "./what-step";

/** A home water test: the readings, each checked against BIS IS 10500 as it is typed, and how the test was done. */
export function WaterTest({ form, patch }: { form: Form; patch: Patch }) {
  const { values } = form;
  const wellWater = form.source === "borewell" || form.source === "open_well";
  return (
    <>
      {!form.source && (
        <Choice
          legend="Where is the water from?"
          hint="A test needs it."
          options={WATER_SOURCES}
          value={null}
          onChange={(source) => source && patch({ source, sourceAsked: true })}
        />
      )}
      <fieldset>
        <legend className="font-medium text-slate-900 dark:text-slate-100">Your results</legend>
        <p className={`mt-1 text-sm ${muted}`}>What your meter or kit shows; TDS alone is fine. Your photo should show the reading.</p>
        <div className={`mt-3 divide-y border-y ${rule}`}>
          {PARAMETERS.filter((p) => p.key in values).map((p) => {
            const raw = values[p.key];
            const warn = raw !== "" && Number.isFinite(Number(raw)) ? assess(p, Number(raw)) : null;
            const set = (v: string) => patch({ values: { ...values, [p.key]: v } });
            return (
              <div key={p.key} className="py-3">
                <label className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-slate-900 dark:text-slate-100">{p.name}</span>
                  {p.limit.kind === "absent" ? (
                    <select value={raw} onChange={(e) => set(e.target.value)} className={`${fieldBox} w-40`}>
                      <option value="">Choose</option>
                      <option value="1">Detected</option>
                      <option value="0">Not detected</option>
                    </select>
                  ) : (
                    <>
                      <input
                        inputMode="decimal"
                        value={raw}
                        onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ""))}
                        className={`${fieldBox} w-24 text-right tabular-nums`}
                      />
                      <span className={`w-16 text-xs leading-tight ${muted}`}>{p.unit}</span>
                    </>
                  )}
                </label>
                {warn && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {warn}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {PARAMETERS.some((p) => !(p.key in values)) && (
          <select
            value=""
            onChange={(e) => e.target.value && patch({ values: { ...values, [e.target.value]: "" } })}
            className={`${fieldBox} mt-3 block`}
            aria-label="Add a measurement"
          >
            <option value="">+ Add a measurement</option>
            {PARAMETERS.filter((p) => !(p.key in values)).map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </fieldset>
      <Choice legend="What did you test with?" options={TEST_INSTRUMENTS} value={form.instrument} onChange={(instrument) => patch({ instrument })} />
      <Choice
        legend="Was the water filtered?"
        hint="A reading after a filter or RO tells you about the filter, not the water source."
        options={TEST_FILTERED}
        value={form.filtered}
        onChange={(filtered) => patch({ filtered })}
      />
      <details className={`group/more rounded-xl border px-4 ${rule}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
          More about this test <span className={`text-sm font-normal ${muted}`}>Optional</span>
        </summary>
        <div className="space-y-5 pb-5">
          <Choice legend="When was the meter last calibrated?" options={TEST_CALIBRATED} value={form.calibrated} onChange={(calibrated) => patch({ calibrated })} optional />
          {wellWater && (
            <>
              <Choice
                legend="Did the pump run a few minutes before you took the sample?"
                hint="The first water out of the pipe is not the groundwater."
                options={[{ key: "yes", label: "Yes" }, { key: "no", label: "No" }] as const}
                value={form.flushed}
                onChange={(flushed) => patch({ flushed })}
                optional
              />
              <label className="block">
                <span className="font-medium text-slate-900 dark:text-slate-100">Borewell depth, if you know it</span>
                <span className="mt-2 flex items-center gap-3">
                  <input
                    inputMode="numeric"
                    value={form.depth}
                    onChange={(e) => patch({ depth: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                    className={`${fieldBox} w-28 text-right tabular-nums`}
                  />
                  <span className={`text-sm ${muted}`}>feet</span>
                </span>
              </label>
            </>
          )}
          <label className="block">
            <span className="font-medium text-slate-900 dark:text-slate-100">Meter brand and model</span>
            <input value={form.model} onChange={(e) => patch({ model: e.target.value.slice(0, MAX_MODEL_CHARS) })} className={`${field} mt-2`} />
          </label>
        </div>
      </details>
    </>
  );
}
