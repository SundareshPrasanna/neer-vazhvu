"use client";

import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RepresentativeData {
  councillor: {
    name: string;
    party: string;
    phone?: string;
    /** Seat reservation for the ward (Delhi publishes this per ward). */
    reservation?: string | null;
  };
  /** Optional: a city may publish councillors before MLA/MP mappings exist
   *  (Delhi at launch - the ward->assembly-constituency join is available
   *  but the assembly/parliament result sets are not yet ingested). */
  mla?: {
    name: string;
    name_ta: string;
    party: string;
    constituency: string;
    constituency_ta: string;
  };
  mp?: {
    name: string;
    name_ta: string;
    party: string;
    constituency: string;
    constituency_ta: string;
  };
}

interface RepsFile {
  meta: {
    councillor_election: string;
    mla_election?: string;
    mp_election?: string;
    last_updated: string;
    sources: Record<string, string>;
  };
  wards: Record<string, RepresentativeData>;
}

// ── Module-level cache (per-city) ────────────────────────────────────────────

const repsPromiseByCity = new Map<string, Promise<RepsFile | null>>();

/** Resolve filename for a city's representative data. Chennai keeps the
 *  legacy unsuffixed path; other cities use a -<cityId> suffix matching
 *  the project convention. */
function repsUrl(cityId: string): string {
  return cityId === "chennai"
    ? "/data/ward-representatives.json"
    : `/data/${cityId}-ward-representatives.json`;
}

function loadReps(cityId: string = "chennai"): Promise<RepsFile | null> {
  let p = repsPromiseByCity.get(cityId);
  if (!p) {
    // Treat a missing file as a soft "no representatives data yet for
    // this city" rather than throwing. The card will render an honest
    // empty state.
    p = fetch(repsUrl(cityId))
      .then((r) => (r.ok ? (r.json() as Promise<RepsFile>) : null))
      .catch(() => null);
    repsPromiseByCity.set(cityId, p);
  }
  return p;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWardRepresentatives(
  wardNumber: number | null,
  cityId: string = "chennai",
) {
  const [data, setData] = useState<RepresentativeData | null>(null);
  const [meta, setMeta] = useState<RepsFile["meta"] | null>(null);

  useEffect(() => {
    if (wardNumber == null) {
      Promise.resolve().then(() => {
        setData(null);
        setMeta(null);
      });
      return;
    }
    loadReps(cityId).then((file) => {
      if (!file) {
        setMeta(null);
        setData(null);
        return;
      }
      setMeta(file.meta);
      setData(file.wards[String(wardNumber)] ?? null);
    });
  }, [wardNumber, cityId]);

  return { representatives: data, meta };
}
