import { readFileSync } from "fs";
import { resolve } from "path";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";

// Per-city cache - server-side, lives for the lifetime of the Node process.
const cacheByCity = new Map<string, WardProfile[]>();

/** Resolve the on-disk profiles file. Chennai keeps the legacy unsuffixed
 *  path for back-compat; other cities use a -<cityId> suffix matching
 *  the compute scripts' output. */
function profilesPath(cityId: string): string {
  const file = cityId === "chennai"
    ? "ward-profiles.json"
    : `${cityId}-ward-profiles.json`;
  return resolve(process.cwd(), "public/data", file);
}

export function loadProfilesServer(cityId: string = "chennai"): WardProfile[] {
  const hit = cacheByCity.get(cityId);
  if (hit) return hit;
  const data = JSON.parse(readFileSync(profilesPath(cityId), "utf-8")) as WardProfile[];
  cacheByCity.set(cityId, data);
  return data;
}
