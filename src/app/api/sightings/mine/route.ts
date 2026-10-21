import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, isReviewer, reporterKey, requireUser } from "@/lib/sightings/auth";
import { settleGroup } from "@/lib/sightings/groups";
import { INTAKE_BUCKET, deletePhotos } from "@/lib/sightings/photos";
import { loadExtras } from "@/lib/sightings/extras";
import { byId, toOwn } from "@/lib/sightings/serialize";
import type { EventRow, PhotoRow, SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

/** The signed-in reporter's own reports, newest first. */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  try {
    const admin = adminClient();
    const key = reporterKey(user.id);
    const { data, error } = await admin
      .from("sightings")
      .select("*")
      .eq("reporter_key", key)
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
    const extras = await loadExtras(admin, rows);
    const eventMap = byId(events.data as EventRow[]);

    // Unpublished photos: short-lived links, for the reporter's eyes only, and only the reporter's own (a neighbour's
    // "still there" or "fixed" photo is not shown to anyone before it is checked).
    const pending = ((photos.data ?? []) as PhotoRow[]).filter((p) => !p.public_path && p.reporter_key === key);
    const signed = pending.length
      ? (await admin.storage.from(INTAKE_BUCKET).createSignedUrls(pending.map((p) => p.storage_path), 3600)).data ?? []
      : [];
    const signedBySighting = byId(pending.map((p, i) => ({ sighting_id: p.sighting_id, url: signed[i]?.signedUrl })));

    return NextResponse.json({
      data: rows.map((r) => {
        const own = toOwn(r, photoMap.get(r.id) ?? [], eventMap.get(r.id) ?? [], extras.get(r.id));
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

/**
 * Delete the account. Unpublished reports and their photos go with it.
 * Published reports stay on the public record with no link to anyone, or go
 * too with ?published=remove.
 */
export async function DELETE(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  try {
    const admin = adminClient();
    const key = reporterKey(user.id);
    const removeAll = request.nextUrl.searchParams.get("published") === "remove";
    const { data } = await admin.from("sightings").select("id, review_status").eq("reporter_key", key);
    const gone = (data ?? []).filter((r) => removeAll || r.review_status !== "approved").map((r) => r.id as string);
    if (gone.length) {
      const { data: photos } = await admin.from("sighting_photos").select("id, storage_path").in("sighting_id", gone);
      await deletePhotos(photos ?? []);
      const del = await admin.from("sightings").delete().in("id", gone);
      if (del.error) throw del.error;
    }
    // What stays loses its key; then the account itself goes.
    for (const [table, column] of [["sightings", "reporter_key"], ["sighting_photos", "reporter_key"], ["sighting_events", "actor_key"], ["sighting_groups", "created_by"], ["sighting_fixits", "created_by"]] as const) {
      const up = await admin.from(table).update({ [column]: "deleted" }).eq(column, key);
      if (up.error) throw up.error;
    }
    // Requests keep what was asked for, and lose who asked.
    const req = await admin.from("requests").update({ requester_key: "deleted", requester_name: null, contact_email: null }).eq("requester_key", key);
    if (req.error) throw req.error;
    await admin.from("sighting_reporters").delete().eq("reporter_key", key);
    await admin.from("sighting_push_subscriptions").delete().eq("reporter_key", key);
    await admin.from("sighting_follows").delete().eq("reporter_key", key);
    const { data: memberOf } = await admin.from("sighting_group_members").delete().eq("reporter_key", key).select("group_id");
    for (const m of memberOf ?? []) await settleGroup(admin, m.group_id as string);
    await admin.from("sighting_fixit_rsvps").delete().eq("reporter_key", key);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return NextResponse.json({ data: { deleted: gone.length } });
  } catch (err) {
    logRouteError("sightings/mine DELETE", err);
    return internalServerError();
  }
}
