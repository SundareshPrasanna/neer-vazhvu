"use client";

import { useEffect, useState } from "react";
import { useWardProfile, type WardProfile } from "./use-ward-profile";
import { useWardRepresentatives, type RepresentativeData } from "./use-ward-representatives";

export interface GroundwaterData {
  depthM: number | null;
  trend: string;
  riskLevel: string;
  riskScore: number | null;
  riskComponents: {
    groundwater_depth: number;
    trend: number;
    reservoir: number;
    seasonal: number;
  } | null;
}

export interface MyWardData {
  profile: WardProfile | null;
  groundwater: GroundwaterData | null;
  representatives: RepresentativeData | null;
  loading: boolean;
  getRiverLabel: (riverId: string | null, stationId: string | null) => { river: string; station: string } | null;
}

export function useMyWardData(
  wardNumber: number | null,
  cityId: string = "chennai",
): MyWardData {
  const { profile, getRiverLabel } = useWardProfile(wardNumber, cityId);
  const { representatives } = useWardRepresentatives(wardNumber, cityId);
  const [groundwater, setGroundwater] = useState<GroundwaterData | null>(null);
  const [gwLoading, setGwLoading] = useState(false);

  useEffect(() => {
    if (wardNumber == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroundwater(null);
      return;
    }

    let cancelled = false;
    setGwLoading(true);

    // Per-ward live groundwater is Chennai-only today (the API queries
    // Supabase tables that only carry Chennai data). For other cities
    // we skip the call and emit a no-data shape so the GW card renders
    // an honest "not available for this city" state.
    if (cityId !== "chennai") {
      setGroundwater({
        depthM: null,
        trend: "unknown",
        riskLevel: "noData",
        riskScore: null,
        riskComponents: null,
      });
      setGwLoading(false);
      return;
    }

    fetch(`/api/groundwater/ward?ward=${wardNumber}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setGroundwater({
            depthM: d.depthM ?? null,
            trend: d.trend ?? "unknown",
            riskLevel: d.riskLevel ?? "noData",
            riskScore: d.riskScore ?? null,
            riskComponents: d.riskComponents ?? null,
          });
          setGwLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroundwater(null);
          setGwLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [wardNumber, cityId]);

  const loading = wardNumber != null && (profile == null || gwLoading);

  return { profile, groundwater, representatives, loading, getRiverLabel };
}
