"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/context";
import { interpolate } from "@/lib/utils/format";
import { MapLoading } from "@/components/map/map-loading";
import { useElevationBands } from "@/components/map/elevation-bands";
import { ElevationBandsControl } from "@/components/map/elevation-bands-control";
import { FloodLinesSection } from "@/components/flood/flood-lines-section";
import { SourceLink } from "@/components/flood/source-link";
import type { FloodMapSpec, FloodRich, FloodText } from "@/content/flood/types";

const FloodLayersMap = dynamic(() => import("./flood-layers-map").then((m) => m.FloodLayersMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

const H3 = "text-sm font-semibold text-slate-800 dark:text-slate-200";

/** /[cityId]/flood-risk for a city with a FloodMapSpec: context bar, a layer map
 *  with its panel, and the sidebar copy. */
export function FloodMapPage({ cityId, cityDisplayName, spec }: { cityId: string; cityDisplayName: string; spec: FloodMapSpec }) {
  const { t } = useLanguage();
  const [checked, setChecked] = useState(() => spec.layers.map((l) => l.rows.map((r) => !!r.on)));
  const [panelOpen, setPanelOpen] = useState(false);
  const elevation = useElevationBands(cityId);
  const toggle = (li: number, ri: number) =>
    setChecked((s) => s.map((rows, i) => (i === li ? rows.map((v, j) => (j === ri ? !v : v)) : rows)));

  const tx = (x: FloodText): ReactNode => {
    const s = interpolate(typeof x === "string" ? x : t(x.key), { city: cityDisplayName });
    if (typeof x === "string" || !x.link) return s;
    const { slot, href, label } = x.link;
    const parts = s.split(`{${slot}}`);
    return parts.map((seg, i) => (
      <span key={i}>
        {seg}
        {i < parts.length - 1 && <SourceLink href={href}>{label}</SourceLink>}
      </span>
    ));
  };
  // JSX arrives from the server as an element or a lazy reference; both carry $$typeof.
  const rich = (x: FloodRich): ReactNode =>
    typeof x === "string" || !("$$typeof" in x) ? tx(x as FloodText) : (x as ReactNode);

  const groups: ReactNode[][] = [[]];
  spec.layers.forEach((l, li) => {
    if (l.divider) groups.push([]);
    l.rows.forEach((r, ri) =>
      groups[groups.length - 1].push(
        <label key={`${li}-${ri}`} className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={checked[li][ri]} onChange={() => toggle(li, ri)} className={r.accent} />
          <span className="flex items-center gap-1.5">
            <span className={`inline-block ${r.swatch}`} />
            {tx(r.label)}
          </span>
        </label>,
      ),
    );
  });
  groups[groups.length - 1].push(<ElevationBandsControl key="elevation" elevation={elevation} note={spec.elevationNote} inline />);
  const rows = (
    <>
      {groups[0]}
      {groups.slice(1).map((g, i) => (
        <div key={i} className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {g}
        </div>
      ))}
    </>
  );
  const sb = spec.sidebar;
  const ft = sb.footer;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">{tx(spec.scope)}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{tx(spec.summary)}</span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile: the map needs an explicit height - as a flex-basis-0 item
            next to the tall text sidebar it collapses to 0px and only its
            floating controls remain visible. Desktop keeps filling the row. */}
        <div className="relative h-[45vh] shrink-0 md:h-full md:flex-1 md:shrink">
          <FloodLayersMap
            center={spec.center}
            zoom={spec.zoom}
            layers={spec.layers}
            checked={checked}
            elevationData={elevation.data}
          />
          <div className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md p-3 space-y-2 text-xs max-w-[230px]">
            {spec.collapsible ? (
              <>
                <button
                  type="button"
                  onClick={() => setPanelOpen((v) => !v)}
                  aria-expanded={panelOpen}
                  className="md:pointer-events-none flex w-full items-center justify-between gap-2 font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide"
                >
                  {tx(spec.layersTitle)}
                  <span className="md:hidden text-slate-400">{panelOpen ? "−" : "+"}</span>
                </button>
                <div className={`${panelOpen ? "block" : "hidden"} md:block space-y-2`}>{rows}</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
                  {tx(spec.layersTitle)}
                </div>
                {rows}
              </>
            )}
          </div>
        </div>

        <aside className="w-full md:w-[380px] border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-900 p-4 space-y-4 text-sm">
          <section>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">{tx(sb.heading)}</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{rich(sb.intro)}</p>
          </section>

          <section>
            <h3 className={H3}>{tx(sb.shows.heading)}</h3>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-[13px] mt-1">
              {sb.shows.items.map((x, i) => <li key={i}>{rich(x)}</li>)}
            </ul>
          </section>

          <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{tx(sb.gaps.heading)}</h3>
            <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-1.5 text-[12px] mt-1">
              {sb.gaps.items.map((x, i) => <li key={i}>{rich(x)}</li>)}
            </ul>
          </section>

          {sb.floodLines && <FloodLinesSection cityId={cityId} />}

          <section>
            <h3 className={H3}>{tx(sb.sources.heading)}</h3>
            <ul className="text-slate-600 dark:text-slate-400 space-y-2 text-[13px] mt-1">
              {sb.sources.items.map((s) => (
                <li key={s.href}>
                  <SourceLink href={s.href}>{s.label}</SourceLink>{" "}{sb.sources.separator} {tx(s.note)}
                </li>
              ))}
            </ul>
          </section>

          {/* A headed footer carries a source list and spaces wider. */}
          <section className={`border-t border-slate-200 dark:border-slate-700 pt-3 text-[11px] text-slate-500 dark:text-slate-400 ${ft.heading ? "space-y-1.5" : "space-y-1"}`}>
            {ft.heading && <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{tx(ft.heading)}</h3>}
            {ft.items && <ul className="space-y-1">{ft.items.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul>}
            {ft.paras.map((x, i) => <p key={i}>{rich(x)}</p>)}
          </section>
        </aside>
      </div>
    </div>
  );
}
