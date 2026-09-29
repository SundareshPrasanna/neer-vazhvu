"use client";

import { elevationLegendEntries, type ElevationBands } from "./elevation-bands";

/** On/off + band legend for the FABDEM layer: a floating card that hides for a city
 *  without a bands file, or `inline` rows inside a layer panel. */
export function ElevationBandsControl({
  elevation,
  note,
  inline = false,
}: {
  elevation: ElevationBands;
  note: string;
  inline?: boolean;
}) {
  const toggle = (
    <label className={`flex items-center gap-2 cursor-pointer${inline ? "" : " font-medium text-slate-700 dark:text-slate-300"}`}>
      <input type="checkbox" checked={elevation.show} onChange={elevation.toggle} className="accent-sky-700" />
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-sky-800 via-lime-400 to-amber-800" />
        Ground elevation (FABDEM)
      </span>
    </label>
  );
  const legend = elevation.show && (
    <>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
        {elevationLegendEntries(elevation.data).map(({ band, color }) => (
          <span key={band} className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            {band}
          </span>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">{note}</p>
    </>
  );
  if (inline) return <>{toggle}{legend && <div className="pl-6 space-y-1">{legend}</div>}</>;
  if (!elevation.available) return null;
  return (
    <div className="absolute bottom-2 right-2 md:bottom-8 md:left-2.5 md:right-auto z-[1000] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md p-2.5 text-xs max-w-[46vw] md:max-w-[240px] space-y-1.5">
      {toggle}
      {legend}
    </div>
  );
}
