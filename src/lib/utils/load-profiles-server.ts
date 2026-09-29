import { readFileSync } from "fs";
import { resolve } from "path";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import { wardProfilesFile } from "@/lib/cities/data-paths";

// Per-city cache - server-side, lives for the lifetime of the Node process.
const cacheByCity = new Map<string, WardProfile[]>();

export function loadProfilesServer(cityId: string): WardProfile[] {
  const hit = cacheByCity.get(cityId);
  if (hit) return hit;
  // Legacy cities ship a bare array; NVDM-migrated cities (Madurai onward)
  // wrap it as { ...envelope, wards: [...] }. Accept both during migration.
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), "public/data", wardProfilesFile(cityId)), "utf-8")) as
    | WardProfile[]
    | { wards: WardProfile[] };
  const data = Array.isArray(raw) ? raw : raw.wards;
  cacheByCity.set(cityId, data);
  return data;
}
