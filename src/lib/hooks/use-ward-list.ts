"use client";

import { useEffect, useState } from "react";
import { fetchJsonShared } from "@/lib/data/fetch-json";
import type { LocalityEntry, WardEntry } from "@/lib/utils/ward-filter";

function useSharedList<T>(url: string | null, key: string): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetchJsonShared<Record<string, T[] | undefined>>(url)
      .then((d) => live && setRows(d[key] ?? []))
      .catch(() => live && setRows([]));
    return () => { live = false; };
  }, [url, key]);
  return rows;
}

/** The city's wards for the ward pickers, one request per city per session.
 *  A city without ward profiles (the API 404s) gets an empty list. */
export function useWardList(cityId: string | null): WardEntry[] {
  return useSharedList<WardEntry>(cityId && `/api/wards?city=${encodeURIComponent(cityId)}`, "wards");
}

/** The city's curated localities; most cities have none yet, and the pickers
 *  then search by ward number and zone only. */
export function useLocalities(cityId: string | null): LocalityEntry[] {
  return useSharedList<LocalityEntry>(cityId && `/api/localities?city=${encodeURIComponent(cityId)}`, "localities");
}
