// Smoke-render of the Basin Atlas PDF export against the REAL basin data.
//
// The PDF report is data-driven: an edit to prs.json / accountability.json /
// gaps.json that the atlas panels tolerate could still break the export at
// click time (react-pdf is far stricter than the DOM). This renders the full
// document in Node - map page, PRS pages, DEP gap pages, credits - and fails
// loudly if any page throws. Run locally after touching basin data or the
// report layout:
//
//   npx tsx scripts/check-basin-pdf-render.tsx [basinId=arkavathi]
//
// Output lands in .tmp/<basinId>-report-check.pdf for a visual once-over.
// The map is a placeholder PNG (the real capture needs a browser); the
// partner logo is fetched from the live site and falls back to a warning.
import fs from "node:fs";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { tryGetBasinManifest } from "../src/lib/basins";
import { parseReviewedMprSeries } from "../src/lib/basins/reviewed-mpr";
import { sanitizeForPdf } from "../src/lib/basins/export-pdf";
import { BasinReportDocument } from "../src/components/basin/basin-pdf-report";
import type { BasinInventory } from "../src/lib/basins";
import type {
  AccountabilityData,
  DepData,
  GapUnit,
  LegendItem,
  PrsData,
} from "../src/components/basin/basin-atlas";

const basinId = process.argv[2] ?? "arkavathi";
const maybeManifest = tryGetBasinManifest(basinId);
if (!maybeManifest) {
  console.error(`FAIL: no basin manifest registered for "${basinId}"`);
  process.exit(1);
}
const manifest = maybeManifest!;

function read<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(`public/data/basins/${basinId}/${file}`, "utf-8")) as T;
  } catch {
    return null;
  }
}

const prs = read<PrsData>("prs.json");
const acc = read<AccountabilityData>("accountability.json");
const gapsRaw = read<Record<string, unknown>>("gaps.json");
const inventory = read<BasinInventory>("inventory.json");
const reviewedMpr = parseReviewedMprSeries(read("mpr-reviewed.json"));
const dep = gapsRaw?.version === 2 ? (gapsRaw as unknown as DepData) : null;
const gapUnits: GapUnit[] = dep ? [] : Object.values((gapsRaw?.units as Record<string, GapUnit>) ?? {});

// 40x25 grey PNG standing in for the browser-captured map.
const MAP_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAZCAIAAADMuvsyAAAAKklEQVR4nGO4cOPBgCCGUYtHLR61eNTiUYtHLR61eNTiUYtHLR61mGIEAF1j48j++xGlAAAAAElFTkSuQmCC";

// One entry per swatch shape so every LegendSwatch branch renders.
const legendItems: LegendItem[] = [
  { sym: "box", color: "#0284c7", label: "Tanks & reservoirs (named)" },
  { sym: "dot", color: "#eab308", label: "Polluting drains (KSPCB)" },
  { sym: "ring", color: "#059669", label: "Monitoring (not in public domain)" },
  { sym: "line", color: "#2563eb", label: "River" },
  { sym: "dash", color: "#818cf8", label: "Sub-catchment" },
  { sym: "outline", color: "#a855f7", label: "STP (not yet functional)" },
  { sym: "tri", color: "#0891b2", label: "FSTP (operational)" },
  { sym: "tri-ring", color: "#0891b2", label: "FSTP (not yet functional)" },
];

async function main() {
  const data = sanitizeForPdf({
    manifest,
    inventory,
    scopeLabel: "Whole basin",
    legendItems,
    legendNotes: ["≈8 of 18 industrial areas have no CETP within ~5 km - CAG-flagged gap, spatial estimate"],
    selectedRiver: manifest.rivers[0] ?? null,
    prs,
    acc,
    reviewedMpr,
    dep,
    gapUnits,
    gapNote: null,
    generatedAt: "(smoke check)",
  });
  const buf = await renderToBuffer(
    <BasinReportDocument
      {...data}
      includeGaps
      mapPng={MAP_PNG}
      mapAspect={0.62}
      shareUrl={`https://neervazhvu.org/embed/basins/${basinId}`}
      origin="https://neervazhvu.org"
    />,
  );
  fs.mkdirSync(".tmp", { recursive: true });
  const out = `.tmp/${basinId}-report-check.pdf`;
  fs.writeFileSync(out, buf);
  console.log(`OK: ${basinId} report rendered, ${buf.length} bytes -> ${out}`);
}

main().catch((e) => {
  console.error(`FAIL: ${basinId} PDF report did not render:`, e);
  process.exit(1);
});
