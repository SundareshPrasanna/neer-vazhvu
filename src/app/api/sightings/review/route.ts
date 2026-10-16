import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, requireReviewer } from "@/lib/sightings/auth";
import { INTAKE_BUCKET, deletePhotos, publicPhotoUrl, publishPhotos } from "@/lib/sightings/photos";
import { byId, toOwn } from "@/lib/sightings/serialize";
import { OTHER_KEY, isValidReport, roleFor } from "@/lib/sightings/taxonomy";
import type { EventRow, PhotoRow, SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

/** Reports waiting for review, and approved reports with an unreviewed fixed photo. Oldest first. */
export async function GET(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  try {
    const admin = adminClient();
    const [received, pendingFixed] = await Promise.all([
      admin.from("sightings").select("*").eq("review_status", "received").order("created_at").limit(50),
      admin.from("sighting_photos").select("sighting_id").eq("kind", "fixed").is("public_path", null).limit(50),
    ]);
    if (received.error) throw received.error;
    const fixedIds = [...new Set((pendingFixed.data ?? []).map((p) => p.sighting_id as string))];
    const fixedRows = fixedIds.length ? ((await admin.from("sightings").select("*").in("id", fixedIds)).data ?? []) : [];
    const rows = [...(received.data ?? []), ...fixedRows] as SightingRow[];
    const ids = rows.map((r) => r.id);
    const reporters = [...new Set(rows.map((r) => r.reporter_id))];
    const [photos, events, reps, counts] = ids.length
      ? await Promise.all([
          admin.from("sighting_photos").select("*").in("sighting_id", ids),
          admin.from("sighting_events").select("*").in("sighting_id", ids).order("created_at"),
          admin.from("sighting_reporters").select("*").in("user_id", reporters),
          admin.from("sightings").select("reporter_id, review_status").in("reporter_id", reporters),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
    const photoRows = (photos.data ?? []) as PhotoRow[];
    const unpublished = photoRows.filter((p) => !p.public_path);
    const signedList = unpublished.length
      ? ((await admin.storage.from(INTAKE_BUCKET).createSignedUrls(unpublished.map((p) => p.storage_path), 3600)).data ?? [])
      : [];
    const signedByPath = new Map(unpublished.map((p, i) => [p.storage_path, signedList[i]?.signedUrl ?? null]));
    const urlOf = (p: PhotoRow) => (p.public_path ? publicPhotoUrl(p.public_path) : (signedByPath.get(p.storage_path) ?? null));
    const photoMap = byId(photoRows);
    const eventMap = byId(events.data as EventRow[]);

    return NextResponse.json({
      data: rows.map((r) => {
        const mine = (counts.data ?? []).filter((c) => c.reporter_id === r.reporter_id);
        const rep = (reps.data ?? []).find((x) => x.user_id === r.reporter_id);
        return {
          ...toOwn(r, photoMap.get(r.id) ?? [], eventMap.get(r.id) ?? []),
          note: r.note,
          candidateLabel: r.candidate_label,
          exif: { capturedAt: r.exif_captured_at, lat: r.exif_lat, lng: r.exif_lng },
          photos: photoRows.flatMap((p) => (p.sighting_id === r.id ? [{ kind: p.kind, published: !!p.public_path, url: urlOf(p) }] : [])),
          reporter: {
            id: r.reporter_id,
            trusted: !!rep?.trusted,
            suspended: !!rep?.suspended_at,
            total: mine.length,
            rejected: mine.filter((c) => c.review_status === "rejected").length,
          },
        };
      }),
    });
  } catch (err) {
    logRouteError("sightings/review GET", err);
    return internalServerError();
  }
}

interface Action {
  action: "approve" | "reject" | "publish_fixed" | "discard_fixed" | "suspend";
  id?: string;
  userId?: string;
  category?: string;
  subcategory?: string | null;
  candidateLabel?: string | null;
  reason?: string | null;
}

const clip = (s: string | null | undefined, n: number) => (s?.trim() ? s.trim().slice(0, n) : null);

export async function POST(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  try {
    const body = (await request.json()) as Action;
    const admin = adminClient();
    const reason = clip(body.reason, 280);
    const event = (sightingId: string, ev: string, extra: Record<string, unknown> = {}) =>
      admin.from("sighting_events").insert({ sighting_id: sightingId, actor_id: user.id, actor_role: "reviewer", event: ev, reason, ...extra });
    const photosOf = async (id: string, kind?: "report" | "fixed") => {
      let q = admin.from("sighting_photos").select("id, storage_path, public_path").eq("sighting_id", id);
      if (kind) q = q.eq("kind", kind);
      return ((await q).data ?? []) as { id: string; storage_path: string; public_path: string | null }[];
    };

    if (body.action === "suspend") {
      if (!body.userId || !/^[0-9a-f-]{36}$/.test(body.userId)) return NextResponse.json({ error: "Bad user" }, { status: 400 });
      await admin.from("sighting_reporters").upsert({ user_id: body.userId, suspended_at: new Date().toISOString(), suspended_reason: reason });
      const { data } = await admin.from("sightings").select("id").eq("reporter_id", body.userId).eq("review_status", "received");
      for (const { id } of data ?? []) {
        await deletePhotos(await photosOf(id));
        await admin.from("sightings").update({ review_status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
        await event(id, "rejected", { reason: "Account suspended" });
      }
      return NextResponse.json({ data: { rejected: (data ?? []).length } });
    }

    const id = body.id;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const row = (await admin.from("sightings").select("*").eq("id", id).maybeSingle()).data as SightingRow | null;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const now = new Date().toISOString();

    switch (body.action) {
      case "approve": {
        if (row.review_status !== "received") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
        const category = body.category ?? row.category;
        const subcategory = body.category ? (body.subcategory ?? null) : row.subcategory;
        if (!isValidReport(category, subcategory)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        if (category !== row.category || subcategory !== row.subcategory) await event(id, "reclassified", { category, subcategory });
        await publishPhotos(await photosOf(id, "report"));
        const up = await admin
          .from("sightings")
          .update({
            category,
            subcategory,
            authority_role: roleFor(category, subcategory),
            candidate_label: category === OTHER_KEY ? clip(body.candidateLabel, 80) : null,
            review_status: "approved",
            case_status: "open",
            reviewed_at: now,
            updated_at: now,
          })
          .eq("id", id);
        if (up.error) throw up.error;
        await event(id, "approved");
        await admin.from("sighting_reporters").update({ trusted: true }).eq("user_id", row.reporter_id);
        break;
      }
      case "reject": {
        if (row.review_status !== "received") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
        await deletePhotos(await photosOf(id));
        await admin.from("sightings").update({ review_status: "rejected", reviewed_at: now, updated_at: now }).eq("id", id);
        await event(id, "rejected");
        break;
      }
      case "publish_fixed":
        await publishPhotos((await photosOf(id, "fixed")).filter((p) => !p.public_path));
        break;
      case "discard_fixed":
        await deletePhotos((await photosOf(id, "fixed")).filter((p) => !p.public_path));
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logRouteError("sightings/review POST", err);
    return internalServerError();
  }
}
