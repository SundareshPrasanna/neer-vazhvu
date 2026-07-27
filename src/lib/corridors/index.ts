import type { CorridorManifest } from "./types";
import { SRIPERUMBUDUR } from "./sriperumbudur";

export type { CorridorManifest } from "./types";

const REGISTRY: Record<string, CorridorManifest> = {
  [SRIPERUMBUDUR.corridorId]: SRIPERUMBUDUR,
};

export function tryGetCorridorManifest(id: string): CorridorManifest | null {
  return REGISTRY[id] ?? null;
}

export function listCorridors(): CorridorManifest[] {
  return Object.values(REGISTRY);
}
