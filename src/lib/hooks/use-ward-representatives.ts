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
  /** Provenance for the CSV export's Source column, derived from the file's
   *  own meta.*_election dates. Built here rather than in the exporter so the
   *  labels stay city-agnostic: the export previously stamped Chennai's
   *  elections onto every city's download, and hardcoding "TN Assembly 2026"
   *  in a shared util would reintroduce exactly that. */
  sourceLabels?: { councillor?: string; mla?: string; mp?: string };
}

/** "2026-04" -> "2026". Returns undefined for missing/!malformed dates so the
 *  exporter falls back to its generic label instead of printing "undefined". */
function electionYear(date: string | undefined): string | undefined {
  const year = (date ?? "").slice(0, 4);
  return /^\d{4}$/.test(year) ? year : undefined;
}

function buildSourceLabels(meta: RepsFile["meta"]): RepresentativeData["sourceLabels"] {
  const councillor = electionYear(meta.councillor_election);
  const mla = electionYear(meta.mla_election);
  const mp = electionYear(meta.mp_election);
  return {
    councillor: councillor ? `Municipal election ${councillor}` : undefined,
    mla: mla ? `Assembly election ${mla}` : undefined,
    mp: mp ? `Parliamentary election ${mp}` : undefined,
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
      const ward = file.wards[String(wardNumber)] ?? null;
      setData(ward ? { ...ward, sourceLabels: buildSourceLabels(file.meta) } : null);
    });
  }, [wardNumber, cityId]);

  return { representatives: data, meta };
}
