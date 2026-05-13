// Server-only: do not import from a "use client" component.
// fs/path imports below will fail to bundle for client targets.
import fs from "node:fs";
import path from "node:path";
import type { CascadeSensitivity } from "./cascade-sensitivity";

const SENSITIVITY_DIR = path.join(process.cwd(), "public", "data", "cascade");

export function loadCascadeSensitivity(
  cityId: string,
): CascadeSensitivity | null {
  const filePath = path.join(
    SENSITIVITY_DIR,
    `${cityId}-cascade-sensitivity.json`,
  );
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as CascadeSensitivity;
  } catch {
    return null;
  }
}
