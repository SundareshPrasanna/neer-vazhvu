import { readFileSync } from "fs";
import { resolve } from "path";
import type { WardProfile } from "@/lib/hooks/use-ward-profile";

const profilesPath = resolve(process.cwd(), "public/data/ward-profiles.json");
let cached: WardProfile[] | null = null;

export function loadProfilesServer(): WardProfile[] {
  if (!cached) {
    cached = JSON.parse(readFileSync(profilesPath, "utf-8")) as WardProfile[];
  }
  return cached;
}
