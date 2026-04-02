/**
 * CI validation script for restoration-projects.json.
 * Imports const arrays from the app's type files so valid values
 * are always in sync - no drift possible.
 *
 * Usage: npx tsx scripts/check-restoration-data.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { RIVER_IDS } from "../src/types/river-quality";
import { RESTORATION_STATUSES, RESTORATION_CATEGORIES } from "../src/types/restoration-projects";

const filePath = resolve(__dirname, "../public/data/restoration-projects.json");
const raw = JSON.parse(readFileSync(filePath, "utf-8"));

let errors = 0;

function fail(projectId: string, msg: string) {
  console.error(`  FAIL [${projectId}]: ${msg}`);
  errors++;
}

if (!raw.projects || !Array.isArray(raw.projects)) {
  console.error("FAIL: top-level 'projects' array missing");
  process.exit(1);
}

const ids = new Set<string>();

for (const p of raw.projects) {
  const id = p.id ?? "(missing id)";

  // Required string fields
  for (const field of ["id", "name", "location_name", "status", "category", "source_url", "summary"] as const) {
    if (typeof p[field] !== "string" || p[field].length === 0) {
      fail(id, `missing or empty required field '${field}'`);
    }
  }

  // Unique ID
  if (ids.has(id)) {
    fail(id, "duplicate project id");
  }
  ids.add(id);

  // display_on_rivers
  if (!Array.isArray(p.display_on_rivers) || p.display_on_rivers.length === 0) {
    fail(id, "display_on_rivers must be a non-empty array");
  } else {
    for (const riverId of p.display_on_rivers) {
      if (!(RIVER_IDS as readonly string[]).includes(riverId)) {
        fail(id, `invalid river id '${riverId}' in display_on_rivers. Valid: ${RIVER_IDS.join(", ")}`);
      }
    }
  }

  // Status
  if (!(RESTORATION_STATUSES as readonly string[]).includes(p.status)) {
    fail(id, `invalid status '${p.status}'. Valid: ${RESTORATION_STATUSES.join(", ")}`);
  }

  // Category
  if (!(RESTORATION_CATEGORIES as readonly string[]).includes(p.category)) {
    fail(id, `invalid category '${p.category}'. Valid: ${RESTORATION_CATEGORIES.join(", ")}`);
  }

  // Nullable string fields
  for (const field of ["name_ta", "summary_ta", "budget_display"] as const) {
    if (p[field] !== null && typeof p[field] !== "string") {
      fail(id, `'${field}' must be string or null`);
    }
  }

  // Nullable number fields
  for (const field of ["budget_cr", "area_acres", "length_km"] as const) {
    if (p[field] !== null && typeof p[field] !== "number") {
      fail(id, `'${field}' must be number or null`);
    }
  }

  // Nullable date strings
  for (const field of ["started", "completed"] as const) {
    if (p[field] !== null && typeof p[field] !== "string") {
      fail(id, `'${field}' must be string or null`);
    }
  }

  // implementing_agencies
  if (!Array.isArray(p.implementing_agencies)) {
    fail(id, "implementing_agencies must be an array");
  }

  // metrics
  if (!Array.isArray(p.metrics)) {
    fail(id, "metrics must be an array");
  } else {
    for (let i = 0; i < p.metrics.length; i++) {
      const m = p.metrics[i];
      if (typeof m.label !== "string" || typeof m.value !== "string") {
        fail(id, `metrics[${i}] must have string 'label' and 'value'`);
      }
      if (m.label_ta !== null && m.label_ta !== undefined && typeof m.label_ta !== "string") {
        fail(id, `metrics[${i}].label_ta must be string or null`);
      }
    }
  }
}

console.log(`\nChecked ${raw.projects.length} restoration projects.`);

if (errors > 0) {
  console.error(`\n${errors} error(s) found.`);
  process.exit(1);
} else {
  console.log("All checks passed.");
}
