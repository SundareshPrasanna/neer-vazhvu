import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, isReviewer, requireUser } from "@/lib/sightings/auth";
import { INTAKE_BUCKET } from "@/lib/sightings/photos";
import { byId, toOwn } from "@/lib/sightings/serialize";
import type { EventRow, PhotoRow, SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

/** The signed-in reporter's own reports, newest first. */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from("sightings")
      .select("*")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = (data ?? []) as SightingRow[];
    const ids = rows.map((r) => r.id);
    const [photos, events] = ids.length
      ? await Promise.all([
          admin.from("sighting_photos").select("*").in("sighting_id", ids),
          admin.from("sighting_events").select("*").in("sighting_id", ids).order("created_at"),
        ])
      : [{ data: [] }, { data: [] }];
    const photoMap = byId(photos.data as PhotoRow[]);
    const eventMap = byId(events.data as EventRow[]);

    // Unpublished photos: short-lived links, for the reporter's eyes only.
    const pending = ((photos.data ?? []) as PhotoRow[]).filter((p) => !p.public_path);
    const signed = pending.length
      ? (await admin.storage.from(INTAKE_BUCKET).createSignedUrls(pending.map((p) => p.storage_path), 3600)).data ?? []
      : [];
    const signedBySighting = byId(pending.map((p, i) => ({ sighting_id: p.sighting_id, url: signed[i]?.signedUrl })));

    return NextResponse.json({
      data: rows.map((r) => {
        const own = toOwn(r, photoMap.get(r.id) ?? [], eventMap.get(r.id) ?? []);
        const extra = (signedBySighting.get(r.id) ?? []).flatMap((s) => (s.url ? [s.url] : []));
        return { ...own, photoUrls: [...own.photoUrls, ...extra] };
      }),
      reviewer: isReviewer(user.id),
    });
  } catch (err) {
    logRouteError("sightings/mine", err);
    return internalServerError();
  }
}
