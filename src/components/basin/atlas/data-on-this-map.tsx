import { useState } from "react";
import { layerKey } from "@/lib/basins/atlas-url-state";
import type { BasinInventory, BasinManifest } from "@/lib/basins";

export function DataOnThisMap({ manifest, inventory }: { manifest: BasinManifest; inventory: BasinInventory | null }) {
  const [open, setOpen] = useState(false);
  if (!inventory) return null;
  const layersWithData = manifest.layers.filter((l) => inventory.families[l.family]);
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between"
      >
        Data on this map
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-[11px] text-slate-500 dark:text-slate-400">
          {/* Collaboration credit - manifest-declared; the partner's name is
              in the logo itself (alt text carries it). Light chip keeps the
              colour logo readable in dark mode. */}
          {manifest.collaboration && (
            <a
              href={manifest.collaboration.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block group rounded-md border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">{manifest.collaboration.label}</span>
              <span className="mt-1 block rounded bg-white px-2 py-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={manifest.collaboration.logo} alt={manifest.collaboration.name} className="w-full max-w-[210px] h-auto" />
              </span>
              {manifest.collaboration.sub && (
                <span className="block text-slate-400 group-hover:underline">{manifest.collaboration.sub}</span>
              )}
            </a>
          )}

          {/* Consolidated layer inventory (counts only - provenance is in Sources). */}
          <div>
            <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">Layers ({layersWithData.length})</div>
            <div className="space-y-0.5">
              {layersWithData.map((l) => (
                <div key={layerKey(l)} className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                  <span className="tabular-nums text-slate-400">{(l.kindFilter && inventory.families[l.family].sources.find((sc) => sc.kind === l.kindFilter)?.count) || inventory.families[l.family].featureCount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
            <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">Sources</div>
            {manifest.credits.map((c, i) => <div key={i} className="leading-snug">{c}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
