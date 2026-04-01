"use client";

import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RepresentativeData {
  councillor: {
    name: string;
    party: string;
    phone: string;
  };
  mla: {
    name: string;
    name_ta: string;
    party: string;
    constituency: string;
    constituency_ta: string;
  };
  mp: {
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
    mla_election: string;
    mp_election: string;
    last_updated: string;
    sources: Record<string, string>;
  };
  wards: Record<string, RepresentativeData>;
}

// ── Module-level cache ───────────────────────────────────────────────────────

let repsPromise: Promise<RepsFile> | null = null;

function loadReps(): Promise<RepsFile> {
  if (!repsPromise) {
    repsPromise = fetch("/data/ward-representatives.json")
      .then((r) => r.json())
      .catch((err) => {
        repsPromise = null;
        throw err;
      });
  }
  return repsPromise;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWardRepresentatives(wardNumber: number | null) {
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
    loadReps().then((file) => {
      setMeta(file.meta);
      setData(file.wards[String(wardNumber)] ?? null);
    });
  }, [wardNumber]);

  return { representatives: data, meta };
}
