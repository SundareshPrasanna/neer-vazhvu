import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { internalServerError, logRouteError } from "@/lib/api-error";

const SATELLITE_EVIDENCE_BUCKET = "satellite-evidence";

function truthyParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

function withCacheBust(url: string | null, version: string | null): string | null {
  if (!url || !version) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

function normalizeComputedAt(value: string | null | undefined): string {
  return value ?? "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const geeTargetId = searchParams.get("gee_target_id");
  const osmId = searchParams.get("osm_id");
  const censusId = searchParams.get("census_id");
  const includeUnreviewed = truthyParam(searchParams.get("include_unreviewed"));
  const parsedOsmId = osmId ? Number(osmId) : null;
  const parsedCensusId = censusId ? Number(censusId) : null;

  if (!geeTargetId && !osmId && !censusId) {
    return NextResponse.json(
      { error: "Provide gee_target_id, osm_id, or census_id" },
      { status: 400 },
    );
  }

  if (osmId && Number.isNaN(parsedOsmId)) {
    return NextResponse.json({ error: "Invalid osm_id" }, { status: 400 });
  }

  if (censusId && Number.isNaN(parsedCensusId)) {
    return NextResponse.json({ error: "Invalid census_id" }, { status: 400 });
  }

  const supabase = createServerClient();
  let query = supabase
    .from("water_body_satellite_evidence")
    .select("*")
    .order("frame_date", { ascending: true });

  if (!includeUnreviewed) {
    query = query.eq("is_reviewed", true);
  }

  if (geeTargetId) {
    query = query.eq("gee_target_id", geeTargetId);
  } else if (osmId) {
    query = query.eq("osm_id", parsedOsmId);
  } else if (censusId) {
    query = query.eq("census_id", parsedCensusId);
  }

  const { data, error } = await query;

  if (error) {
    logRouteError("/api/water-bodies/gee/evidence", error);
    return internalServerError();
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No satellite evidence found" }, { status: 404 });
  }

  const dedupedData = [...data]
    .sort((left, right) => {
      const frameDateComparison = left.frame_date.localeCompare(right.frame_date);
      if (frameDateComparison !== 0) {
        return frameDateComparison;
      }

      return normalizeComputedAt(right.computed_at).localeCompare(
        normalizeComputedAt(left.computed_at),
      );
    })
    .filter((row, index, rows) => {
      if (index === 0) {
        return true;
      }
      return rows[index - 1]?.frame_date !== row.frame_date;
    });

  const rows = dedupedData.map((row) => ({
    ...row,
    image_url: withCacheBust(
      row.image_path
        ? supabase.storage.from(SATELLITE_EVIDENCE_BUCKET).getPublicUrl(row.image_path).data.publicUrl
        : null,
      row.computed_at,
    ),
    overlay_url: withCacheBust(
      row.overlay_path
        ? supabase.storage.from(SATELLITE_EVIDENCE_BUCKET).getPublicUrl(row.overlay_path).data.publicUrl
        : null,
      row.computed_at,
    ),
  }));

  return NextResponse.json({
    data: rows,
    meta: {
      include_unreviewed: includeUnreviewed,
      bucket: SATELLITE_EVIDENCE_BUCKET,
    },
  });
}
