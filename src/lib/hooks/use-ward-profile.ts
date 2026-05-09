"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Marker for a ward-profile section we don't have source data for in
 * a given city (e.g. flood-hazard polygons exist for Chennai but not
 * Madurai). The compute scripts emit this in place of fabricated zero
 * counts; the UI cards branch on `_data_status` to render an honest
 * "not yet collected" state instead of an empty zero-card.
 */
export interface WardSectionNotAvailable {
  _data_status: "not_available";
  _data_status_note?: string;
}

export type WardFloodSection =
  | {
      hazard_zone_count: number;
      by_category: Record<string, number>;
      dominant_hazard: string | null;
      hotspot_2015_count: number;
      hotspot_2020_count: number;
    }
  | WardSectionNotAvailable;

export type WardDrainageSection =
  | {
      line_count: number;
      total_length_km: number;
    }
  | WardSectionNotAvailable;

export type WardSewerageSection =
  | {
      stp_count: number;
      sps_count: number;
      pumping_main_count: number;
      pumping_main_length_km: number;
      total_stp_capacity_mld: number;
    }
  | WardSectionNotAvailable;

export type WardIndustrialSection =
  | { zone_count: number }
  | WardSectionNotAvailable;

/** Per-ward CGWB groundwater assessment: block-level extraction class
 *  (which tiles the district at 100% coverage) + nearest Year-Book well
 *  if one is within 5 km. Used by Madurai today; Chennai relies on the
 *  interpolated depth/risk path and omits this field. */
export interface WardGroundwaterAssessment {
  block: {
    name: string;
    /** "Safe" | "Semi Critical" | "Critical" | "Over Exploited" */
    class: string;
    development_pct: number | null;
  } | null;
  nearest_well: {
    name: string;
    block: string;
    distance_km: number;
    latest: {
      year: number;
      month: number;
      depth_m_bgl: number;
    } | null;
  } | null;
}

export function isSectionUnavailable(
  section: object | null | undefined,
): section is WardSectionNotAvailable {
  return Boolean(
    section && (section as { _data_status?: string })._data_status === "not_available",
  );
}

export interface WardProfile {
  ward_number: number;
  zone_no: string;
  zone_name: string;
  centroid: [number, number];
  area_sq_km: number;

  water_bodies: {
    current_count: number;
    census_records: number;
    restoration_critical: number;
    restoration_high: number;
    avg_restoration_score: number | null;
    top_bodies: { name: string; score: number; level: string }[];
  };

  lost_bodies: {
    count: number;
    names: string[];
  };

  flood: WardFloodSection;
  drainage: WardDrainageSection;
  sewerage: WardSewerageSection;

  rivers: {
    nearest_station_id: string | null;
    nearest_river_id: string | null;
    nearest_km: number | null;
  };

  industrial: WardIndustrialSection;

  groundwater_assessment?: WardGroundwaterAssessment;
}

interface RiverQuality {
  rivers: Array<{
    id: string;
    name: string;
    name_ta: string;
    stations: Array<{
      id: string;
      name: string;
      name_ta: string;
    }>;
  }>;
}

// ── Module-level caches ──────────────────────────────────────────────────────
// Per-city caches so a Chennai consumer and a Madurai consumer in the
// same session don't fight over a single shared promise.

const profilesPromiseByCity = new Map<string, Promise<WardProfile[]>>();
const riverPromiseByCity = new Map<string, Promise<RiverQuality>>();

/** Resolve the public/data/ filename for ward profiles. Chennai keeps the
 *  legacy unsuffixed path for back-compat; other cities use a -<cityId>
 *  suffix matching the compute scripts' output. */
function profilesUrl(cityId: string): string {
  return cityId === "chennai"
    ? "/data/ward-profiles.json"
    : `/data/${cityId}-ward-profiles.json`;
}

function riverQualityUrl(cityId: string): string {
  return cityId === "chennai"
    ? "/data/river-quality.json"
    : `/data/river-quality-${cityId}.json`;
}

export function loadProfiles(cityId: string = "chennai"): Promise<WardProfile[]> {
  let p = profilesPromiseByCity.get(cityId);
  if (!p) {
    p = fetch(profilesUrl(cityId))
      .then((r) => r.json())
      .catch((err) => {
        profilesPromiseByCity.delete(cityId);
        throw err;
      });
    profilesPromiseByCity.set(cityId, p);
  }
  return p;
}

function loadRiverQuality(cityId: string = "chennai"): Promise<RiverQuality> {
  let p = riverPromiseByCity.get(cityId);
  if (!p) {
    p = fetch(riverQualityUrl(cityId))
      .then((r) => r.json())
      .catch((err) => {
        riverPromiseByCity.delete(cityId);
        throw err;
      });
    riverPromiseByCity.set(cityId, p);
  }
  return p;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWardProfile(
  wardNumber: number | null,
  cityId: string = "chennai",
) {
  const { language } = useLanguage();
  const [profile, setProfile] = useState<WardProfile | null>(null);
  const [riverData, setRiverData] = useState<RiverQuality | null>(null);

  useEffect(() => {
    if (wardNumber == null) {
      // Use microtask to avoid synchronous setState in effect body
      Promise.resolve().then(() => setProfile(null));
      return;
    }
    loadProfiles(cityId).then((profiles) => {
      const p = profiles.find((w) => w.ward_number === wardNumber) ?? null;
      setProfile(p);
    });
    loadRiverQuality(cityId).then(setRiverData);
  }, [wardNumber, cityId]);

  const getRiverLabel = useCallback(
    (
      riverId: string | null,
      stationId: string | null
    ): { river: string; station: string } | null => {
      if (!riverData || !riverId) return null;
      const river = riverData.rivers.find((r) => r.id === riverId);
      if (!river) return null;
      const station = stationId
        ? river.stations.find((s) => s.id === stationId)
        : null;
      const useTa = language === "ta";
      return {
        river: useTa ? (river.name_ta || river.name) : river.name,
        station: station
          ? useTa
            ? (station.name_ta || station.name)
            : station.name
          : "",
      };
    },
    [riverData, language]
  );

  return { profile, getRiverLabel };
}
