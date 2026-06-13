import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// On click, the atlas fetches one lake's catchment polygon AND the feeder
// streams within that catchment. Both are read from precomputed files (the
// full catchments geojson is several MB; the streams file is keyed by
// osm_id), parsed once and cached in module scope.
const DIR = path.join(process.cwd(), "public", "data", "cascade");

type CatchMap = Map<number, unknown> | null;
const CATCH_CACHE = new Map<string, CatchMap>();
const STREAM_CACHE = new Map<string, Record<string, unknown> | null>();
const BASIN_CACHE = new Map<string, Record<string, unknown> | null>();
const DOWNSTREAM_CACHE = new Map<string, Record<string, unknown> | null>();

function loadCatchments(cityId: string): CatchMap {
  if (CATCH_CACHE.has(cityId)) return CATCH_CACHE.get(cityId)!;
  const fp = path.join(DIR, `${cityId}-cascade-catchments.geojson`);
  let result: CatchMap = null;
  if (fs.existsSync(fp)) {
    try {
      const fc = JSON.parse(fs.readFileSync(fp, "utf-8")) as {
        features: Array<{ properties: { osm_id: number } }>;
      };
      const byId = new Map<number, unknown>();
      for (const f of fc.features) byId.set(f.properties.osm_id, f);
      result = byId;
    } catch {
      result = null;
    }
  }
  CATCH_CACHE.set(cityId, result);
  return result;
}

function loadKeyed(
  cityId: string,
  suffix: string,
  cache: Map<string, Record<string, unknown> | null>,
): Record<string, unknown> | null {
  if (cache.has(cityId)) return cache.get(cityId)!;
  const fp = path.join(DIR, `${cityId}-${suffix}`);
  let result: Record<string, unknown> | null = null;
  if (fs.existsSync(fp)) {
    try {
      result = JSON.parse(fs.readFileSync(fp, "utf-8")) as Record<string, unknown>;
    } catch {
      result = null;
    }
  }
  cache.set(cityId, result);
  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cityId: string }> },
) {
  const { cityId } = await params;
  const osmId = Number(req.nextUrl.searchParams.get("osm_id"));
  if (!Number.isFinite(osmId)) {
    return NextResponse.json({ error: "osm_id required" }, { status: 400 });
  }
  const catchments = loadCatchments(cityId);
  const catchment = catchments?.get(osmId) ?? null;
  if (!catchment) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const streams = loadKeyed(cityId, "catchment-streams.json", STREAM_CACHE)?.[String(osmId)] ?? null;
  const basin = loadKeyed(cityId, "catchment-basin.json", BASIN_CACHE)?.[String(osmId)] ?? null;
  const downstream = loadKeyed(cityId, "catchment-downstream.json", DOWNSTREAM_CACHE)?.[String(osmId)] ?? null;
  return NextResponse.json({ catchment, basin, streams, downstream });
}
