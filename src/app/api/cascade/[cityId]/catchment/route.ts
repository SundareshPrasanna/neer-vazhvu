import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Serve a single catchment polygon by osm_id. The full
// {city}-cascade-catchments.geojson is several MB (707 polygons for
// Chennai); shipping it whole to the client would be wasteful, so the
// atlas fetches just the selected lake's catchment on click. The parsed
// file is cached in module scope (the server process stays warm) keyed
// by city, as an osm_id -> Feature map.
type FeatureMap = Map<number, unknown> | null;
const CACHE = new Map<string, FeatureMap>();

function loadCity(cityId: string): FeatureMap {
  if (CACHE.has(cityId)) return CACHE.get(cityId)!;
  const fp = path.join(
    process.cwd(),
    "public",
    "data",
    "cascade",
    `${cityId}-cascade-catchments.geojson`,
  );
  let result: FeatureMap = null;
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
  CACHE.set(cityId, result);
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
  const byId = loadCity(cityId);
  if (!byId) {
    return NextResponse.json({ error: "no catchment data" }, { status: 404 });
  }
  const feat = byId.get(osmId);
  if (!feat) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(feat);
}
