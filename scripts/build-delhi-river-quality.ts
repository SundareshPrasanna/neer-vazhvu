/**
 * Derive public/data/river-quality-delhi.json (the rivers-page station
 * panel format) from public/data/dpcc-monthly-wq-delhi.json (the DPCC
 * monthly series).
 *
 * Delhi's river-quality feed is DPCC's own monthly monitoring - higher
 * cadence than the CPCB NWMP annuals every other city uses - so this
 * derivation runs whenever a new month is transcribed/OCR'd into the
 * monthly file, keeping the panel and the series in lockstep.
 *
 * Panel readings are yearly rows: for each calendar year we take the
 * LATEST month's values and note which month that is (the monthly file
 * remains the authority for the full series).
 *
 * Run: npx tsx scripts/build-delhi-river-quality.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { writeArtifact } from "./lib/nvdm-write";

interface MonthlyRiverRow {
  station: string;
  ph: number;
  bod: number;
  cod: number;
  do: number;
  do_nil?: boolean;
  fecal_coliform: number;
  phosphate: number;
  ammonical_n: number;
}

interface MonthlyFile {
  source: { publisher: string; listing_url: string };
  river_stations: { id: string; name: string; lat: number; lng: number; note?: string }[];
  months: {
    month: string;
    sampled: string;
    river?: MonthlyRiverRow[];
  }[];
}

const root = process.cwd();
const monthly = JSON.parse(
  readFileSync(join(root, "public/data/dpcc-monthly-wq-delhi.json"), "utf-8"),
) as MonthlyFile;

// ONE ROW PER MONTH, not per year.
//
// This used to keep only the latest month of each calendar year, because the
// shared river panel was built for CPCB's annual NWMP series - which is the
// true resolution for every other city here. Delhi is the exception: DPCC
// samples monthly, and every month captured so far falls in 2026, so the
// yearly collapse rendered the whole feed as a SINGLE point on the chart. The
// extra resolution was being thrown away at the adapter.
//
// RiverQualityReading.month is optional, so annual cities keep plotting by
// year unchanged; only a feed that supplies a month gets month-level points.
const withRiver = monthly.months
  .filter((m) => m.river?.length)
  .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

// Distinct calendar years still drive the file-level data_year_range, which
// the panel header uses; the per-station readings below are monthly.
const years = [...new Set(withRiver.map((m) => Number(m.month.slice(0, 4))))].sort();

const stations = monthly.river_stations.map((st) => {
  const readings = withRiver.flatMap((m) => {
    const row = m.river!.find((r) => r.station === st.id);
    if (!row) return [];
    return [
      {
        year: Number(m.month.slice(0, 4)),
        month: m.month,
        do_mgl: row.do_nil ? 0 : row.do,
        bod_mgl: row.bod,
        ph: row.ph,
        conductivity_us: null,
        cod_mgl: row.cod,
        fecal_coliform_mpn: row.fecal_coliform,
        tds_mgl: null,
        nitrate_mgl: null,
        chromium_mgl: null,
        lead_mgl: null,
        cadmium_mgl: null,
      },
    ];
  });
  return {
    id: st.id,
    name: st.name,
    lat: st.lat,
    lng: st.lng,
    stretch: st.note ?? "Delhi stretch",
    readings,
  };
});

const latest = monthly.months.filter((m) => m.river?.length).at(-1)!;

const out = {
  last_updated: latest.month,
  data_year_range: [years[0], years.at(-1)] as [number, number],
  source:
    `DPCC monthly 'Water Quality Status of River Yamuna' reports (8 stations, sampled monthly; ` +
    `latest: ${latest.month}, sampled ${latest.sampled}). Yearly rows show the latest available month ` +
    `of that year; the full monthly series (including the 39-point drain network) lives in ` +
    `dpcc-monthly-wq-delhi.json. DO of 0 renders DPCC's 'NIL'. Derived by scripts/build-delhi-river-quality.ts.`,
  source_url: "https://dpcc.delhi.gov.in/dpcc/analysis-reports",
  source_label: "DPCC monthly analysis reports",
  rivers: [
    {
      id: "yamuna",
      name: "Yamuna",
      name_hi: "यमुना नदी",
      length_km: 52,
      overall_status: "dead",
      cpcb_class:
        "Wazirabad-Okhla is the reference 'Priority I' polluted stretch of Indian river monitoring; ~80% of the Yamuna's pollution load enters in these 22 km",
      description:
        "DPCC's 8-station monthly transect of the Delhi Yamuna: the river arrives at Palla meeting the BOD bathing criterion and leaves at Asgarpur at 15-30x it, with dissolved oxygen at NIL through the city stretch in every monitored month of 2026.",
      notes:
        "Delhi is the only city on this platform whose river feed is MONTHLY (DPCC I/C Water Laboratory) rather than annual CPCB NWMP. The drain network (39 points, incl. Najafgarh Jheel up/downstream and UP outfalls) is in the same monthly file; the NO FLOW count there is the drain-trapping programme's verification signal.",
      stations,
    },
  ],
};

const outPath = join(root, "public/data/river-quality-delhi.json");
writeArtifact(outPath, out);
console.log(
  `wrote ${outPath}: ${stations.length} stations, years ${years.join(",")}, latest ${latest.month}`,
);
