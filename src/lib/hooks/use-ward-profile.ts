"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";

// ── Types ────────────────────────────────────────────────────────────────────

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

  flood: {
    hazard_zone_count: number;
    by_category: Record<string, number>;
    dominant_hazard: string | null;
    hotspot_2015_count: number;
    hotspot_2020_count: number;
  };

  drainage: { line_count: number };

  sewerage: {
    stp_count: number;
    sps_count: number;
    pumping_main_count: number;
    total_stp_capacity_mld: number;
  };

  rivers: {
    nearest_station_id: string | null;
    nearest_river_id: string | null;
    nearest_km: number | null;
  };

  industrial: { zone_count: number };
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

let profilesPromise: Promise<WardProfile[]> | null = null;
let riverPromise: Promise<RiverQuality> | null = null;

export function loadProfiles(): Promise<WardProfile[]> {
  if (!profilesPromise) {
    profilesPromise = fetch("/data/ward-profiles.json")
      .then((r) => r.json())
      .catch((err) => {
        profilesPromise = null;
        throw err;
      });
  }
  return profilesPromise;
}

function loadRiverQuality(): Promise<RiverQuality> {
  if (!riverPromise) {
    riverPromise = fetch("/data/river-quality.json")
      .then((r) => r.json())
      .catch((err) => {
        riverPromise = null;
        throw err;
      });
  }
  return riverPromise;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWardProfile(wardNumber: number | null) {
  const { language } = useLanguage();
  const [profile, setProfile] = useState<WardProfile | null>(null);
  const [riverData, setRiverData] = useState<RiverQuality | null>(null);

  useEffect(() => {
    if (wardNumber == null) {
      // Use microtask to avoid synchronous setState in effect body
      Promise.resolve().then(() => setProfile(null));
      return;
    }
    loadProfiles().then((profiles) => {
      const p = profiles.find((w) => w.ward_number === wardNumber) ?? null;
      setProfile(p);
    });
    loadRiverQuality().then(setRiverData);
  }, [wardNumber]);

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
