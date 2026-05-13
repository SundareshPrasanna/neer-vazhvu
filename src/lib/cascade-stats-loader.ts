// Server-only: do not import from a "use client" component.
// fs/path imports below will fail to bundle for client targets.
import fs from "node:fs";
import path from "node:path";
import type { CascadeStats } from "./cascade-stats";

const STATS_DIR = path.join(process.cwd(), "public", "data", "cascade");

export function loadCascadeStats(cityId: string): CascadeStats | null {
  const filePath = path.join(STATS_DIR, `${cityId}-cascade-stats.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CascadeStats;
  } catch {
    return null;
  }
}
