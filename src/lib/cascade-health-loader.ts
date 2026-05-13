// Server-only: do not import from a "use client" component.
// fs/path imports below will fail to bundle for client targets.
import fs from "node:fs";
import path from "node:path";
import type { CascadeHealth } from "./cascade-health";

const HEALTH_DIR = path.join(process.cwd(), "public", "data", "cascade");

export function loadCascadeHealth(cityId: string): CascadeHealth | null {
  const filePath = path.join(HEALTH_DIR, `${cityId}-cascades-health.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CascadeHealth;
  } catch {
    return null;
  }
}
