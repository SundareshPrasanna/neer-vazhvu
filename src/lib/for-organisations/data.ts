/**
 * Server-side facts for /for-organisations. Every figure on that page is read here from the
 * served tree, the NVDM conformance report or a registry, never typed into the page. Bases are
 * module-level constants of literal segments so the file tracer scopes reads to them. A served file
 * that is absent (the sample-corpus build prunes them) returns null and the page drops that block.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { listPublishedAtlasDistricts } from "@/lib/atlas/registry";
import { liveCityCount } from "@/lib/cities/roster";
import { scopeIds } from "@/lib/scopes";
import vandiyur from "./vandiyur-water-spread.json";
import imageManifest from "../../../public/images/for-organisations/MANIFEST.json";

const DATA_DIR = join(process.cwd(), "public", "data");
const REGISTRY_DIR = join(process.cwd(), "scripts", "source-registry");
const DOCS_DIR = join(process.cwd(), "docs", "architecture");

const readJson = <T>(file: string): T | null =>
  existsSync(join(DATA_DIR, file)) ? (JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8")) as T) : null;

interface Source { id: string; title: string; publisher: string; license: string }
interface Envelope { dataset: string; scope: { kind: string; id: string }; provenance: { sources: Source[]; method: string; produced_at: string } }

export function kelavarapalliRecord() {
  const fc = readJson<Envelope & { features: { properties: Record<string, string | number> }[] }>(
    "basins/krishnagiri-rivers/reservoirs.geojson",
  );
  if (!fc) return null;
  const p = fc.features.find((f) => f.properties.name === "Kelavarapalli")?.properties;
  if (!p) throw new Error("reservoirs.geojson: Kelavarapalli missing");
  const level = conformanceReport().match(/- (L\d) `public\/data\/basins\/krishnagiri-rivers\/reservoirs\.geojson`/)?.[1];
  return { p, envelope: fc, level: level ?? "unlisted" };
}

interface Series { param: string; unit: string; criterion?: number; points: [string, number][] }

export function chokkarasanapalliRecord() {
  const r = readJson<{ series: Series[]; insights: { text: string }[] }>(
    "basins/krishnagiri-rivers/readings/tnpcb-chokkarasanapalli.json",
  );
  const mp = readJson<{ features: unknown[] }>("basins/krishnagiri-rivers/monitoring-points.geojson");
  if (!r || !mp) return null;
  const bod = r.series.find((s) => s.param === "BOD");
  const range = r.insights.map((i) => i.text.match(/BOD (\d+) to (\d+) mg\/L/)).find(Boolean);
  if (!bod || bod.criterion === undefined || !range) throw new Error("tnpcb-chokkarasanapalli: BOD series or range missing");
  const dates = [...new Set(r.series.flatMap((s) => s.points.map((pt) => pt[0])))].sort();
  return { bod: bod.points, criterion: bod.criterion, rangeLo: +range[1], rangeHi: +range[2], samples: dates.length, first: dates[0], last: dates[dates.length - 1], points: mp.features.length };
}

function conformanceReport(): string {
  return readFileSync(join(DOCS_DIR, "nvdm-conformance.md"), "utf-8");
}

/** Unique source ids across scripts/source-registry/*.json, as check-upstream-editions loads them. */
function watchedSourceCount(): number {
  const ids = readdirSync(REGISTRY_DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => (JSON.parse(readFileSync(join(REGISTRY_DIR, f), "utf-8")).sources ?? []).map((s: { id: string }) => s.id));
  return new Set(ids).size;
}

export function registryFacts() {
  const m = conformanceReport().match(/\*\*(\d+) artifacts: L0: \d+ · L1: \d+ · L2: (\d+) · L3: (\d+)\*\*/);
  if (!m) throw new Error("nvdm-conformance.md: summary line not found");
  return {
    files: +m[1],
    enveloped: +m[2],
    contracted: +m[3],
    places: scopeIds().length,
    sources: watchedSourceCount(),
    cities: liveCityCount(),
    districts: listPublishedAtlasDistricts().length,
  };
}

export function vandiyurSeries() {
  const month = (s: string) => `${s}-15`;
  return {
    landsat: vandiyur.landsatMonthly.map(([d, v]) => [month(d as string), v as number] as [string, number]),
    radar: vandiyur.sentinel1 as [string, number][],
    boundaryHa: vandiyur.boundaryHa,
    registerHa: vandiyur.registerSpreadHa,
  };
}

export function chembarambakkamImage() {
  const img = imageManifest.images.find((i) => i.file.startsWith("chembarambakkam"));
  if (!img?.px || !img.window || img.scenes === undefined) throw new Error("MANIFEST.json: Chembarambakkam entry incomplete");
  return { src: `/images/for-organisations/${img.file}`, credit: img.credit, px: img.px, window: img.window, scenes: img.scenes };
}
