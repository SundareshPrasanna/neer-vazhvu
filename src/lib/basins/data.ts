/**
 * Server-side readers for the basin atlases' served tree (public/data/basins/<id>/).
 * Never imported by client components. The base is a module-level constant of
 * literal segments so the file tracer can scope reads to it (see src/lib/atlas/data.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BasinInventory } from "./types";

const DATA_DIR = join(process.cwd(), "public", "data", "basins");

/** One JSON file of a basin's data, or null when it is absent or unreadable. */
export function readBasinJson<T>(basinId: string, file: string): T | null {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, basinId, file), "utf-8")) as T;
  } catch {
    return null;
  }
}

export function loadBasinInventory(basinId: string): BasinInventory | null {
  return readBasinJson<BasinInventory>(basinId, "inventory.json");
}

/** A district's deep-dive link shows only once that basin's data is in the served tree:
 *  the code can merge before the data release without the page pointing at an empty map. */
export function hasBasinData(basinId: string): boolean {
  return existsSync(join(DATA_DIR, basinId, "inventory.json"));
}
