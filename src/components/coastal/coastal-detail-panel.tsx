"use client";

import {
  TREND_COLORS,
  TREND_LABELS,
  hotspotColor,
  type SelectedCoastal,
} from "@/types/coastal";

interface CoastalDetailPanelProps {
  selected: SelectedCoastal;
  onClose: () => void;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded shrink-0"
      aria-label="Close"
    >
      <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

function SourceFooter({ label, url }: { label: string; url: string }) {
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-5 text-xs text-slate-400 space-y-1">
      <p>
        Source:{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600 dark:hover:text-slate-300">
          {label}
        </a>
      </p>
      <p>
        Geometry: OpenStreetMap coastline. Rates are the study&apos;s published figures (1990-2024);
        independent transect reproduction (CoastSat + DSAS) is pending.
      </p>
    </div>
  );
}

export function CoastalDetailPanel({ selected, onClose }: CoastalDetailPanelProps) {
  if (selected.kind === "zone") {
    const z = selected.props;
    const color = TREND_COLORS[z.dominant_trend];
    return (
      <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Zone {z.zone_id}
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{z.zone_name}</h3>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="flex items-center gap-2 mb-5">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            {TREND_LABELS[z.dominant_trend]}
          </span>
          <span className="text-xs text-slate-500">{z.length_km} km of coast</span>
        </div>

        <div className="mb-5">
          <div className="text-4xl font-bold" style={{ color }}>
            {z.mean_erosion_m_yr} <span className="text-lg font-medium text-slate-400">m/yr</span>
          </div>
          <div className="text-sm text-slate-500">Mean erosion rate (1990-2024)</div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{z.summary}</p>

        <SourceFooter label={z.source_label} url={z.source_url} />
      </div>
    );
  }

  const h = selected.props;
  const color = hotspotColor(h.rate_m_yr);
  return (
    <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hotspot · Zone {h.zone_id}
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{h.name}</h3>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <div className="mb-5">
        <div className="text-4xl font-bold" style={{ color }}>
          {h.rate_m_yr > 0 ? "+" : ""}
          {h.rate_m_yr} <span className="text-lg font-medium text-slate-400">m/yr</span>
        </div>
        <div className="text-sm text-slate-500">
          {h.trend === "erosion" ? "Shoreline retreat" : "Shoreline gain"} (1990-2024)
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{h.note}</p>

      <SourceFooter label={h.source_label} url={h.source_url} />
    </div>
  );
}
