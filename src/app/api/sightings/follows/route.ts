import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { listAtlasDistricts } from "@/lib/atlas/registry";
import { tryGetBasinManifest } from "@/lib/basins";
import { tryGetPlaceConfig } from "@/lib/cities";
import { adminClient, reporterKey, requireUser } from "@/lib/sightings/auth";
import { MAX_FOLLOWS, isFollowTarget, parseFollowTarget } from "@/lib/sightings/community";
import { placeUrl } from "@/lib/sightings/place-url";
import { REPORT_GROUPS } from "@/lib/sightings/taxonomy";
import type { SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

const TABLE = "sighting_follows";
const COLS = "place_kind, place_id, ward_id, ward_name, water_body_id, water_body_name, panchayat_code, panchayat_name, category";
const PRIVATE = `(${REPORT_GROUPS.filter((g) => g.private).map((g) => g.key).join(",")})`;

type Named = Pick<SightingRow, "place_kind" | "place_id" | "ward_id" | "ward_name" | "water_body_id" | "water_body_name" | "panchayat_code" | "panchayat_name" | "category">;

function placeName(r: Named): string {
  if (r.place_kind === "city") return tryGetPlaceConfig(r.place_id)?.displayName ?? r.place_id;
  if (r.place_kind === "basin") return tryGetBasinManifest(r.place_id)?.displayName ?? r.place_id;
  return listAtlasDistricts().find((d) => d.scopeId === r.place_id)?.name ?? r.place_id;
}

/** A followed place's name and public page, read off its latest published community report. */
async function describe(admin: SupabaseClient, target: string): Promise<{ label: string; href: string | null }> {
  const key = parseFollowTarget(target);
  if (!key) return { label: target, href: null };
  let q = admin.from("sightings").select(COLS).eq("review_status", "approved").not("category", "in", PRIVATE);
  q = key.kind === "body" ? q.eq("water_body_id", key.id) : q.eq("place_id", key.place);
  if (key.kind === "ward") q = q.eq("ward_id", key.id);
  if (key.kind === "gp") q = q.eq("panchayat_code", key.id);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const row = data as Named | null;
  if (!row) return { label: "A place you follow", href: null };
  // The followed unit's page: a ward's, not the lake its latest report also sat in.
  const unit: Named = {
    ...row,
    ward_id: key.kind === "ward" ? row.ward_id : null,
    panchayat_code: key.kind === "gp" ? row.panchayat_code : null,
    water_body_id: key.kind === "body" ? row.water_body_id : null,
  };
  const name = key.kind === "body" ? row.water_body_name : key.kind === "ward" ? (row.ward_name ?? `Ward ${key.id}`) : key.kind === "gp" ? row.panchayat_name : null;
  return { label: [name, placeName(row)].filter(Boolean).join(", "), href: placeUrl(unit)?.href ?? null };
}

/** The places this person follows, newest first, each with a name and its public page where it has one. */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  try {
    const admin = adminClient();
    const { data, error } = await admin.from(TABLE).select("target, created_at").eq("reporter_key", reporterKey(user.id)).order("created_at", { ascending: false }).limit(MAX_FOLLOWS);
    if (error) throw error;
    const follows = (data ?? []) as { target: string; created_at: string }[];
    const named = await Promise.all(follows.map((f) => describe(admin, f.target)));
    return NextResponse.json({ data: follows.map((f, i) => ({ target: f.target, createdAt: f.created_at, ...named[i] })) });
  } catch (err) {
    logRouteError("sightings/follows GET", err);
    return internalServerError();
  }
}

async function readTarget(request: NextRequest): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as { target?: unknown } | null;
  return isFollowTarget(body?.target) ? body.target : null;
}

/** Follows a place key (from a report card's `followTarget`). Following one already followed changes nothing. */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const target = await readTarget(request);
  if (!target) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const admin = adminClient();
    const key = reporterKey(user.id);
    const [have, all] = await Promise.all([
      admin.from(TABLE).select("target").eq("reporter_key", key).eq("target", target).maybeSingle(),
      admin.from(TABLE).select("target", { count: "exact", head: true }).eq("reporter_key", key),
    ]);
    if (have.error) throw have.error;
    if (!have.data) {
      if ((all.count ?? 0) >= MAX_FOLLOWS) {
        return NextResponse.json({ error: `You follow ${MAX_FOLLOWS} places, the most we allow. Stop following one in My reports first.` }, { status: 429 });
      }
      const ins = await admin.from(TABLE).insert({ reporter_key: key, target });
      // 23505: a second tap got there first.
      if (ins.error && ins.error.code !== "23505") throw ins.error;
    }
    return NextResponse.json({ data: { target, following: true } });
  } catch (err) {
    logRouteError("sightings/follows POST", err);
    return internalServerError();
  }
}

/** Stops following a place key. */
export async function DELETE(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const target = await readTarget(request);
  if (!target) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const del = await adminClient().from(TABLE).delete().eq("reporter_key", reporterKey(user.id)).eq("target", target);
    if (del.error) throw del.error;
    return NextResponse.json({ data: { target, following: false } });
  } catch (err) {
    logRouteError("sightings/follows DELETE", err);
    return internalServerError();
  }
}
