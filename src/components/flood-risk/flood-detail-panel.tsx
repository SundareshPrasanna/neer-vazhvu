"use client";

import { useLanguage } from "@/lib/i18n/context";
import { HAZARD_COLORS, VULNERABILITY_COLORS, DRAINAGE_COLORS } from "@/types/flood-risk";
import type {
  SelectedFloodFeature,
  HazardCategory,
  HazardZoneProperties,
  DepthPointProperties,
  Hotspot2015Properties,
  Hotspot2020Properties,
  DrainageProperties,
  ReturnPeriodProperties,
} from "@/types/flood-risk";

interface FloodDetailPanelProps {
  selected: SelectedFloodFeature;
  onClose: () => void;
}

export function FloodDetailPanel({ selected, onClose }: FloodDetailPanelProps) {
  const { t } = useLanguage();

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

function DrainageContent({ props }: { props: { osm_id: number; name: string | null; waterway_type: string } }) {
  const { t } = useLanguage();
  const color = DRAINAGE_COLORS[props.waterway_type] ?? "#64748b";

  return (
    <>
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t("flood.waterway_type")}</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-0 border-t-2" style={{ borderColor: color }} />
          <span className="text-sm font-semibold capitalize" style={{ color }}>{props.waterway_type}</span>
        </div>
      </div>
      {props.name && (
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("lr.name")}</div>
          <div className="text-sm text-slate-900 dark:text-slate-100">{props.name}</div>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        OSM ID: {props.osm_id}
      </p>
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
