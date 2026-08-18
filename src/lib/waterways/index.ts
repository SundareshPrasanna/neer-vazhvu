import type { WaterwayManifest } from "./types";
import { BUCKINGHAM_CANAL } from "./buckingham-canal";

export type { WaterwayManifest } from "./types";

const REGISTRY: Record<string, WaterwayManifest> = {
  [BUCKINGHAM_CANAL.waterwayId]: BUCKINGHAM_CANAL,
};

/**
 * Preview gating mirrors the city registry: disabled waterways stay
 * invisible in production unless named in NEXT_PUBLIC_PREVIEW_WATERWAYS
 * (comma-separated ids) on that deploy.
 */
function isVisible(m: WaterwayManifest): boolean {
  if (m.enabled) return true;
  const raw = process.env.NEXT_PUBLIC_PREVIEW_WATERWAYS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim())
    .includes(m.waterwayId);
}

export function tryGetWaterwayManifest(id: string): WaterwayManifest | null {
  const m = REGISTRY[id] ?? null;
  return m && isVisible(m) ? m : null;
}

export function listWaterways(): WaterwayManifest[] {
  return Object.values(REGISTRY).filter(isVisible);
}
