"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { ConnectedInsight } from "@/components/insights/connected-insight";
import { WardContext } from "@/components/insights/ward-context";
import { WardNarrative } from "@/components/insights/ward-narrative";
import { WardRepresentatives } from "@/components/insights/ward-representatives";
import { NewsContext } from "@/components/insights/news-context";
import { useWardLookup } from "@/lib/hooks/use-ward-lookup";
import { HAZARD_COLORS, VULNERABILITY_COLORS, DRAINAGE_COLORS, SEWERAGE_COLORS } from "@/types/flood-risk";
import type {
  SelectedFloodFeature,
  HazardCategory,
  HazardZoneProperties,
  DepthPointProperties,
  Hotspot2015Properties,
  Hotspot2020Properties,
  DrainageProperties,
  ReturnPeriodProperties,
  STPProperties,
  SPSProperties,
  PumpingMainProperties,
} from "@/types/flood-risk";

interface FloodDetailPanelProps {
  selected: SelectedFloodFeature;
  onClose: () => void;
}

export function FloodDetailPanel({ selected, onClose }: FloodDetailPanelProps) {
  const { t } = useLanguage();
  const wardLookup = useWardLookup();
  const [resolvedWard, setResolvedWard] = useState<number | null>(null);

  // Resolve ward from latlng, or use direct ward property for hotspot2015
  useEffect(() => {
    let cancelled = false;
    if (selected.kind === "hotspot2015") {
      const ward = (selected.props as { ward: number }).ward;
      if (ward > 0) Promise.resolve().then(() => { if (!cancelled) setResolvedWard(ward); });
    } else if (selected.latlng) {
      wardLookup(selected.latlng[0], selected.latlng[1]).then((w) => {
        if (!cancelled) setResolvedWard(w);
      });
    } else {
      Promise.resolve().then(() => { if (!cancelled) setResolvedWard(null); });
    }
    return () => { cancelled = true; };
  }, [selected, wardLookup]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {selected.kind === "hazard" && t("flood.hazard_zone")}
          {selected.kind === "depth" && t("flood.inundation_point")}
          {selected.kind === "hotspot2015" && t("flood.flood_hotspot")}
          {selected.kind === "hotspot2020" && t("flood.flood_hotspot")}
          {selected.kind === "drainage" && t("flood.drainage_feature")}
          {selected.kind === "return_period" && t("flood.return_period")}
          {selected.kind === "stp" && t("flood.stp_name")}
          {selected.kind === "sps" && t("flood.sps_name")}
          {selected.kind === "pumping_main" && t("flood.legend_pm")}
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-4 flex-1">
        {selected.kind === "hazard" && <HazardContent props={selected.props as HazardZoneProperties} />}
        {selected.kind === "depth" && <DepthContent props={selected.props as DepthPointProperties} />}
        {selected.kind === "hotspot2015" && <Hotspot2015Content props={selected.props as Hotspot2015Properties} />}
        {selected.kind === "hotspot2020" && <Hotspot2020Content props={selected.props as Hotspot2020Properties} />}
        {selected.kind === "drainage" && <DrainageContent props={selected.props as DrainageProperties} />}
        {selected.kind === "return_period" && <ReturnPeriodContent props={selected.props as ReturnPeriodProperties} />}
        {selected.kind === "stp" && <STPContent props={selected.props as STPProperties} />}
        {selected.kind === "sps" && <SPSContent props={selected.props as SPSProperties} />}
        {selected.kind === "pumping_main" && <PumpingMainContent props={selected.props as PumpingMainProperties} />}
        {resolvedWard && <WardContext wardNumber={resolvedWard} />}
        {resolvedWard && <WardRepresentatives wardNumber={resolvedWard} />}
        {resolvedWard && <WardNarrative wardNumber={resolvedWard} />}
        <NewsContext domain="flood" />
      </div>
    </div>
  );
}

function HazardContent({ props }: { props: HazardZoneProperties }) {
  const { t } = useLanguage();
  const cat = props.category as HazardCategory;
  const color = HAZARD_COLORS[cat] ?? "#64748b";
  const label = t(`flood.${cat}`);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
      </div>
      {props.area > 0 && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.area")}</div>
          <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
            {props.area > 10000
              ? `${(props.area / 10000).toFixed(2)} ha`
              : `${Math.round(props.area)} sq m`}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
        {t("flood.hazard_source")}
      </p>
      {(cat === "very_high" || cat === "high") && (
        <ConnectedInsight
          messageKey="connected.flood_hazard_gw"
          linkHref="/groundwater"
          linkKey="connected.flood_hazard_gw_link"
        />
      )}
    </>
  );
}

function DepthContent({ props }: { props: { DEPTH: number; F_REMARKS: string; F_LATITUDE: number; F_LONGITUDE: number } }) {
  const { t } = useLanguage();
  const depthM = (props.DEPTH * 0.3048).toFixed(1);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.depth_ft")}</div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {props.DEPTH} ft
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.depth_m")}</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {depthM} m
          </div>
        </div>
      </div>
      {props.F_REMARKS && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.remarks")}</div>
          <p className="text-sm text-slate-700 dark:text-slate-300 capitalize">
            {props.F_REMARKS.toLowerCase()}
          </p>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("flood.event_2015")}
      </p>
    </>
  );
}

function Hotspot2015Content({ props }: { props: { location: string; vulnerability: string; inundation_ft: string; ward: number; zone: number } }) {
  const { t } = useLanguage();
  const color = VULNERABILITY_COLORS[props.vulnerability] ?? "#64748b";

  return (
    <>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.location")}</div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.location}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium" style={{ color }}>{props.vulnerability}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.inundation")}</div>
          <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.inundation_ft}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.ward")} / {t("flood.zone_label")}</div>
          <div className="text-sm font-mono text-slate-900 dark:text-slate-100">W{props.ward} / Z{props.zone}</div>
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("flood.event_2015")}
      </p>
      {props.ward > 0 && (
        <ConnectedInsight
          messageKey="connected.flood_hotspot_gw"
          params={{ ward: props.ward }}
          linkHref={`/groundwater?ward=${props.ward}`}
          linkKey="connected.flood_hotspot_gw_link"
        />
      )}
    </>
  );
}

function Hotspot2020Content({ props }: { props: { name: string } }) {
  const { t } = useLanguage();

  return (
    <>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.neighborhood")}</div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.name}</div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("flood.event_2020")}
      </p>
    </>
  );
}

function DrainageContent({ props }: { props: DrainageProperties }) {
  const { t } = useLanguage();
  const color = DRAINAGE_COLORS[props.drain_type] ?? "#3b82f6";

  return (
    <>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.waterway_type")}</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-0 border-t-2" style={{ borderColor: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{props.drain_type}</span>
        </div>
      </div>
      {props.street && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.street")}</div>
          <div className="text-sm text-slate-900 dark:text-slate-100">{props.street}</div>
        </div>
      )}
      {props.location && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.location")}</div>
          <div className="text-sm text-slate-900 dark:text-slate-100">{props.location}</div>
        </div>
      )}
      {(props.ward || props.zone) && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.ward")} / {t("flood.zone_label")}</div>
          <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.ward} / {props.zone}</div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {props.drain_len > 0 && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.length")}</div>
            <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{Math.round(props.drain_len)} m</div>
          </div>
        )}
        {props.drain_wid > 0 && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.width")}</div>
            <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.drain_wid} m</div>
          </div>
        )}
        {props.drain_dep > 0 && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.depth_m")}</div>
            <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.drain_dep} m</div>
          </div>
        )}
      </div>
      {props.detail && (
        <div className="flex gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            props.detail.toLowerCase().includes("open")
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          }`}>
            {props.detail}
          </span>
          {props.status && props.status !== "" && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              props.status === "Good"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {props.status}
            </span>
          )}
        </div>
      )}
      {props.material && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.material")}</div>
          <div className="text-sm text-slate-700 dark:text-slate-300">{props.material}</div>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("flood.source_gcc_swd")}
      </p>
      <ConnectedInsight
        messageKey="connected.flood_drainage_wb"
        linkHref="/water-bodies?mode=lost"
        linkKey="connected.flood_drainage_wb_link"
      />
    </>
  );
}

function ReturnPeriodContent({ props }: { props: { return_period: number; risk_level: string } }) {
  const { t } = useLanguage();

  return (
    <>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.return_period")}</div>
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {props.return_period}{t("flood.year_flood")}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.category")}</div>
        <div className="text-sm font-semibold uppercase text-slate-700 dark:text-slate-300">
          {props.risk_level}
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("flood.hazard_source")}
      </p>
    </>
  );
}

function STPContent({ props }: { props: STPProperties }) {
  const { t } = useLanguage();
  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SEWERAGE_COLORS.stp }} />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.name}</span>
        </div>
      </div>
      {props.capacity_mld != null && props.capacity_mld > 0 && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.capacity")}</div>
          <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
            {props.capacity_mld} <span className="text-sm font-normal">MLD</span>
          </div>
        </div>
      )}
      {props.effluent && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Effluent quality</div>
          <div className="text-sm text-slate-700 dark:text-slate-300">{props.effluent}</div>
        </div>
      )}
      {props.road && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.location")}</div>
          <div className="text-sm text-slate-700 dark:text-slate-300">{props.road}</div>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
{/* CMWSSB attribution is correct only for Chennai's geojson. This panel
            renders only for flood.variant === 'interactive' (chennai.ts today);
            parameterize these source lines before another city adopts it. */}
        Source: CMWSSB Sewerage Collection System
      </p>
      <ConnectedInsight
        messageKey="connected.flood_stp_river"
        linkHref="/rivers"
        linkKey="connected.flood_stp_river_link"
      />
    </>
  );
}

function SPSContent({ props }: { props: SPSProperties }) {
  const { t } = useLanguage();
  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: SEWERAGE_COLORS.sps }} />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.name}</span>
        </div>
      </div>
      {props.stp_name && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.feeds_to")}</div>
          <div className="text-sm font-medium text-green-600 dark:text-green-400">{props.stp_name}</div>
        </div>
      )}
      {props.streets_served != null && props.streets_served > 0 && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.streets_served")}</div>
          <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.streets_served}</div>
        </div>
      )}
      {props.road && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.location")}</div>
          <div className="text-sm text-slate-700 dark:text-slate-300">{props.road}</div>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Source: CMWSSB Sewerage Collection System
      </p>
    </>
  );
}

function PumpingMainContent({ props }: { props: PumpingMainProperties }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="space-y-2">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.origin")}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.origin || "-"}</div>
        </div>
        <div className="text-center text-slate-400">&darr;</div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.destination")}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.destination || "-"}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {props.size_mm != null && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.pipe_size")}</div>
            <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.size_mm} mm</div>
          </div>
        )}
        {props.length_m != null && (
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.pipe_length")}</div>
            <div className="text-sm font-mono text-slate-900 dark:text-slate-100">{props.length_m} m</div>
          </div>
        )}
      </div>
      {props.material && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.material")}</div>
          <div className="text-sm text-slate-700 dark:text-slate-300">{props.material}</div>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Source: CMWSSB Sewage Pumping Network
      </p>
    </>
  );
}
