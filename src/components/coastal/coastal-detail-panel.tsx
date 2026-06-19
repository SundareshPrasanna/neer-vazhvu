"use client";

import {
  TREND_COLORS,
  TREND_LABELS,
  hotspotColor,
  rateColor,
  accelStatus,
  ACCEL_LABELS,
  type SelectedCoastal,
} from "@/types/coastal";
import { ShorelineSparkline } from "./shoreline-sparkline";

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
        Geometry: OpenStreetMap coastline; rates are the study&apos;s published figures (1990-2024).
        The coloured dots on the map are our own per-transect measurement - click one for its rate
        and shoreline movement over time.
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
          {z.mean_erosion_m_yr != null && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              {TREND_LABELS[z.dominant_trend]}
            </span>
          )}
          <span className="text-xs text-slate-500">{z.length_km} km of coast</span>
        </div>

        {z.mean_erosion_m_yr != null ? (
          <div className="mb-5">
            <div className="text-4xl font-bold" style={{ color }}>
              {z.mean_erosion_m_yr} <span className="text-lg font-medium text-slate-400">m/yr</span>
            </div>
            <div className="text-sm text-slate-500">Study mean erosion rate (1990-2024)</div>
          </div>
        ) : (
          <div className="mb-5 text-sm font-medium text-slate-500">
            Beyond the study area - see our transect measurements along this stretch.
          </div>
        )}

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{z.summary}</p>

        <SourceFooter label={z.source_label} url={z.source_url} />
      </div>
    );
  }

  if (selected.kind === "transect") {
    const t = selected.props;
    const color = rateColor(t.rate_m_yr);
    return (
      <div className="bg-white dark:bg-slate-900 w-full h-full p-4 sm:p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Transect {t.transect_id} - Zone {t.zone_id}
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
              {t.trend === "erosion" ? "Erosion" : t.trend === "accretion" ? "Accretion" : "Stable"}
            </h3>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        {t.confidence === "low" && (
          <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <span className="font-semibold">Low confidence.</span> This transect&apos;s recent year-to-year
            positions scatter or jump more than our reliability threshold, so the magnitude may be unstable.
            That can happen where the shoreline is genuinely ambiguous (near a river/creek mouth or the
            lagoon) or where cloud/imagery noise affected the readings. Treat the magnitude with caution.
          </div>
        )}

        {(() => {
          const accel = accelStatus(t.early_rate_m_yr, t.recent_rate_m_yr);
          const accelColor =
            accel === "erosion-accelerating"
              ? "#dc2626"
              : accel === "accretion-accelerating"
                ? "#2563eb"
                : accel === "reversed"
                  ? "#7c3aed"
                  : "#64748b";
          return (
            <>
              <div className="mb-3">
                <div className="text-4xl font-bold" style={{ color }}>
                  {t.rate_m_yr > 0 ? "+" : ""}
                  {t.rate_m_yr} <span className="text-lg font-medium text-slate-400">m/yr</span>
                </div>
                <div className="text-sm text-slate-500">
                  Long-term rate ({t.period ?? "1990-2026"}, weighted linear regression)
                </div>
              </div>

              {/* Recent pace, surfaced prominently: a full-period average can
                  badly understate an accelerating shore (e.g. -23 long-term
                  while -47 recently). */}
              {t.recent_rate_m_yr != null ? (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      Recent pace (2015-2026)
                    </div>
                    <div className="text-2xl font-bold" style={{ color: rateColor(t.recent_rate_m_yr) }}>
                      {t.recent_rate_m_yr > 0 ? "+" : ""}
                      {t.recent_rate_m_yr} <span className="text-sm font-medium text-slate-400">m/yr</span>
                    </div>
                  </div>
                  {accel !== "unknown" && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: accelColor }}
                    >
                      {ACCEL_LABELS[accel]}
                    </span>
                  )}
                </div>
              ) : (
                accel !== "unknown" && (
                  <span
                    className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full text-white mb-4"
                    style={{ backgroundColor: accelColor }}
                  >
                    {ACCEL_LABELS[accel]}
                  </span>
                )
              )}

              {t.series && t.series.length >= 2 && (
                <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900/40">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Net shoreline movement over time
                  </div>
                  <ShorelineSparkline series={t.series} />
                  <div className="text-[10px] text-slate-400 mt-1">
                    metres seaward (up) / landward (down) vs the {t.series[0][0]} shoreline
                  </div>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                {t.early_rate_m_yr != null && (
                  <div>
                    <dt className="text-xs text-slate-400">Early rate (1990-2010)</dt>
                    <dd className="font-semibold text-slate-700 dark:text-slate-200">
                      {t.early_rate_m_yr > 0 ? "+" : ""}
                      {t.early_rate_m_yr} m/yr
                    </dd>
                  </div>
                )}
                {t.epr_m_yr != null && (
                  <div>
                    <dt className="text-xs text-slate-400">End-point rate</dt>
                    <dd className="font-semibold text-slate-700 dark:text-slate-200">{t.epr_m_yr} m/yr</dd>
                  </div>
                )}
                {t.r_squared != null && (
                  <div>
                    <dt className="text-xs text-slate-400">R²</dt>
                    <dd className="font-semibold text-slate-700 dark:text-slate-200">{t.r_squared}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-400">Epochs used</dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-200">{t.n_epochs} of 10</dd>
                </div>
              </dl>
            </>
          );
        })()}

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-5 text-xs text-slate-400 space-y-1">
          <p>
            Computed by Neer Vazhvu: MNDWI water index on Landsat 5/7/8 + Sentinel-2 via Google Earth
            Engine, sampled along this 100 m transect.
          </p>
          <p>
            Independent of the study&apos;s CoastSat + DSAS. The spatial pattern matches; absolute
            rates differ by method (fixed MNDWI threshold, no tidal correction).
          </p>
        </div>
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
            Hotspot - Zone {h.zone_id}
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
