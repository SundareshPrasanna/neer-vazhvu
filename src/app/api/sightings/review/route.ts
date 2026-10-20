import { NextResponse, after, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, requireReviewer } from "@/lib/sightings/auth";
import { seenNotice } from "@/lib/sightings/community";
import { notifyFollowers } from "@/lib/sightings/follows";
import { findNearbyIssues } from "@/lib/sightings/nearby";
import { notifyReporter } from "@/lib/sightings/notify";
import { INTAKE_BUCKET, PUBLIC_BUCKET, deletePhotos, publicPhotoUrl, publishPhotos } from "@/lib/sightings/photos";
import { nextCaseStatus } from "@/lib/sightings/status";
import { byId, toOwn, toPublic } from "@/lib/sightings/serialize";
import { OTHER_KEY, isCommunityReport, isValidReport, roleFor } from "@/lib/sightings/taxonomy";
import type { EventRow, NearbyIssue, PhotoRow, SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;

/**
 * Reports waiting for review, oldest first, each with the open issues near it that it may duplicate
 * (`possibleSame`); then approved reports with an unreviewed fixed or "still there" photo.
 */
export async function GET(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  try {
    const admin = adminClient();
    const [received, pendingPhotos] = await Promise.all([
      admin.from("sightings").select("*").eq("review_status", "received").order("created_at").limit(50),
      admin.from("sighting_photos").select("sighting_id").in("kind", ["fixed", "update"]).is("public_path", null).limit(100),
    ]);
    if (received.error) throw received.error;
    const queued = new Set((received.data ?? []).map((r) => r.id as string));
    const photoIds = [...new Set((pendingPhotos.data ?? []).map((p) => p.sighting_id as string))].filter((id) => !queued.has(id));
    const photoRows = photoIds.length ? ((await admin.from("sightings").select("*").in("id", photoIds)).data ?? []) : [];
    const rows = [...(received.data ?? []), ...photoRows] as SightingRow[];
    const ids = rows.map((r) => r.id);
    const reporters = [...new Set(rows.map((r) => r.reporter_key))];
    const [photos, events, reps, counts] = ids.length
      ? await Promise.all([
          admin.from("sighting_photos").select("*").in("sighting_id", ids),
          admin.from("sighting_events").select("*").in("sighting_id", ids).order("created_at"),
          admin.from("sighting_reporters").select("*").in("reporter_key", reporters),
          admin.from("sightings").select("reporter_key, review_status").in("reporter_key", reporters),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
    const allPhotos = (photos.data ?? []) as PhotoRow[];
    const unpublished = allPhotos.filter((p) => !p.public_path);
    const signedList = unpublished.length
      ? ((await admin.storage.from(INTAKE_BUCKET).createSignedUrls(unpublished.map((p) => p.storage_path), 3600)).data ?? [])
      : [];
    const signedByPath = new Map(unpublished.map((p, i) => [p.storage_path, signedList[i]?.signedUrl ?? null]));
    const urlOf = (p: PhotoRow) => (p.public_path ? publicPhotoUrl(p.public_path) : (signedByPath.get(p.storage_path) ?? null));
    const photoMap = byId(allPhotos);
    const eventMap = byId(events.data as EventRow[]);
    // Never fails the queue. A home's report is never matched: its photo must never go on a public report.
    const nearby = (r: SightingRow): Promise<NearbyIssue[]> =>
      findNearbyIssues(admin, { lat: Number(r.lat), lng: Number(r.lng), category: r.category, subcategory: r.subcategory, accuracyM: r.location_accuracy_m, excludeId: r.id }).catch((err) => {
        logRouteError("sightings/review nearby", err);
        return [];
      });
    const possibleSame = await Promise.all(rows.map((r) => (r.review_status === "received" && isCommunityReport(r.category) ? nearby(r) : [])));

    return NextResponse.json({
      data: rows.map((r, i) => {
        const mine = (counts.data ?? []).filter((c) => c.reporter_key === r.reporter_key);
        const rep = (reps.data ?? []).find((x) => x.reporter_key === r.reporter_key);
        return {
          ...toOwn(r, photoMap.get(r.id) ?? [], eventMap.get(r.id) ?? []),
          note: r.note,

          candidateLabel: r.candidate_label,
          exif: { capturedAt: r.exif_captured_at, lat: r.exif_lat, lng: r.exif_lng },
          photos: allPhotos.flatMap((p) => (p.sighting_id === r.id ? [{ kind: p.kind, published: !!p.public_path, url: urlOf(p) }] : [])),
          possibleSame: possibleSame[i],
          reporter: {
            key: r.reporter_key,
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
  action: "approve" | "reject" | "publish_fixed" | "discard_fixed" | "publish_update" | "discard_update" | "merge" | "suspend";
  id?: string;
  /** merge: the published report the received one is added to (NearbyIssue.reportId). */
  targetReportId?: string;
  reporterKey?: string;
  category?: string;
  subcategory?: string | null;
  candidateLabel?: string | null;
  reason?: string | null;
}

const clip = (s: string | null | undefined, n: number) => (s?.trim() ? s.trim().slice(0, n) : null);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);

export async function POST(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  try {
    const body = (await request.json()) as Action;
    const admin = adminClient();
    const reason = clip(body.reason, 280);
    const actorKey = reporterKey(user.id);
    const event = (sightingId: string, ev: string, extra: Record<string, unknown> = {}) =>
      admin.from("sighting_events").insert({ sighting_id: sightingId, actor_key: actorKey, actor_role: "reviewer", event: ev, reason, ...extra });
    // Reviewed: the photo's own date and GPS are no longer kept.
    const reviewed = { reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(), exif_captured_at: null, exif_lat: null, exif_lng: null };
    const photosOf = async (id: string, kind?: PhotoRow["kind"]) => {
      let q = admin.from("sighting_photos").select("id, storage_path, public_path, ordinal, reporter_key").eq("sighting_id", id);
      if (kind) q = q.eq("kind", kind);
      return ((await q).data ?? []) as { id: string; storage_path: string; public_path: string | null; ordinal: number; reporter_key: string }[];
    };
    // Who sent each waiting photo, to tell them what became of it.
    const senders = (photos: { reporter_key: string }[]) => [...new Set(photos.map((p) => p.reporter_key))].filter((k) => k !== "deleted");

    if (body.action === "suspend") {
      if (!body.reporterKey || !/^[0-9a-f]{64}$/.test(body.reporterKey)) return NextResponse.json({ error: "Bad reporter" }, { status: 400 });
      await admin.from("sighting_reporters").upsert({ reporter_key: body.reporterKey, suspended_at: new Date().toISOString(), suspended_reason: reason });
      const { data } = await admin.from("sightings").select("id").eq("reporter_key", body.reporterKey).eq("review_status", "received");
      for (const { id } of data ?? []) {
        await deletePhotos(await photosOf(id));
        await admin.from("sightings").update({ review_status: "rejected", note: null, ...reviewed }).eq("id", id);
        await event(id, "rejected", { reason: "Account suspended" });
      }
      return NextResponse.json({ data: { rejected: (data ?? []).length } });
    }

    /**
     * The same thing as a published, open report: the received report is not published on its own. Its sender counts
     * on the target as having seen it ("seen it too" and "still there", once each as a nod allows), its first photo
     * goes on the target as a checked "still there" photo, and the sender is told where it went.
     */
    const merge = async (row: SightingRow, targetId: unknown) => {
      if (!isId(targetId) || targetId === row.id) return NextResponse.json({ error: "Bad target" }, { status: 400 });
      if (row.review_status !== "received") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
      if (!isCommunityReport(row.category)) return NextResponse.json({ error: "A report from a home is never added to another report." }, { status: 409 });
      const target = (await admin.from("sightings").select("*").eq("id", targetId).maybeSingle()).data as SightingRow | null;
      if (!target) return NextResponse.json({ error: "That report was not found." }, { status: 404 });
      if (target.review_status !== "approved" || !isCommunityReport(target.category)) return NextResponse.json({ error: "That report is not on the public record." }, { status: 409 });
      const still = nextCaseStatus("still_there", target.case_status);
      if (!still) return NextResponse.json({ error: "That report is no longer open. Approve this one as a new report instead." }, { status: 409 });

      // The first photo moves to the target under a fresh random name and is published: the reviewer has just checked it.
      const [photo] = (await photosOf(row.id, "report")).sort((a, b) => a.ordinal - b.ordinal);
      if (photo) {
        const path = `${target.place_id}/${target.id}/update-${crypto.randomUUID()}.webp`;
        const copied = await admin.storage.from(INTAKE_BUCKET).copy(photo.storage_path, path, { destinationBucket: PUBLIC_BUCKET });
        if (copied.error) throw copied.error;
        const moved = await admin.from("sighting_photos").update({ sighting_id: target.id, kind: "update", storage_path: path, public_path: path }).eq("id", photo.id);
        if (moved.error) {
          await admin.storage.from(PUBLIC_BUCKET).remove([path]);
          throw moved.error;
        }
        await admin.storage.from(INTAKE_BUCKET).remove([photo.storage_path]);
      }
      await deletePhotos(await photosOf(row.id));

      // Their own earlier report: no "seen it too" on it, and their "still there" is a reporter's update.
      const own = row.reporter_key === target.reporter_key;
      if (!own) {
        const seen = await admin.from("sighting_events").insert({ sighting_id: target.id, actor_key: row.reporter_key, actor_role: "resident", event: "seen_too" });
        // 23505: they had already said so (unique index, migration 064).
        if (seen.error && seen.error.code !== "23505") throw seen.error;
      }
      const recent = await admin
        .from("sighting_events")
        .select("id", { count: "exact", head: true })
        .eq("sighting_id", target.id)
        .eq("actor_key", row.reporter_key)
        .eq("event", "still_there")
        .gte("created_at", new Date(Date.now() - DAY_MS).toISOString());
      if (recent.error) throw recent.error;
      if (!recent.count) {
        const ev = await admin.from("sighting_events").insert({ sighting_id: target.id, actor_key: row.reporter_key, actor_role: own ? "reporter" : "resident", event: "still_there" });
        if (ev.error) throw ev.error;
        const up = await admin.from("sightings").update({ case_status: still, updated_at: new Date().toISOString() }).eq("id", target.id);
        if (up.error) throw up.error;
      }

      const shown = toPublic(target, [], []);
      const place = shown.placeLabel ?? ([shown.where, shown.placeName].filter(Boolean).join(", ") || shown.placeName);
      const done = await admin.from("sightings").update({ review_status: "rejected", note: null, ...reviewed }).eq("id", row.id);
      if (done.error) throw done.error;
      await event(row.id, "rejected", { reason: clip(`Already on the record: added to the existing report at ${place}.`, 280) });
      // Their photo is now published, as an approval would have done.
      await admin.from("sighting_reporters").update({ trusted: true }).eq("reporter_key", row.reporter_key);
      after(() => notifyReporter(row.reporter_key, { title: "Already on the record", body: `Your photo was added to an existing report at ${place}.`, url: "/mitra" }));
      if (!own) {
        const count = await admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("sighting_id", target.id).eq("event", "seen_too");
        const notice = seenNotice(count.count ?? 0);
        if (notice) after(() => notifyReporter(target.reporter_key, { ...notice, url: "/mitra" }));
      }
      return NextResponse.json({ data: { ok: true } });
    };

    const id = body.id;
    if (!isId(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const row = (await admin.from("sightings").select("*").eq("id", id).maybeSingle()).data as SightingRow | null;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    switch (body.action) {
      case "approve": {
        if (row.review_status !== "received") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
        const category = body.category ?? row.category;
        const subcategory = body.category ? (body.subcategory ?? null) : row.subcategory;
        if (!isValidReport(category, subcategory)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        if (category !== row.category || subcategory !== row.subcategory) await event(id, "reclassified", { category, subcategory });
        await publishPhotos(await photosOf(id, "report"));
        // A reclassified report takes its new type's body; otherwise the one it was sent with (a piped test over a limit has one).
        const role = category === row.category && subcategory === row.subcategory ? row.authority_role : roleFor(category, subcategory);
        const filed = role
          ? (await admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("event", "reported")).count
          : 0;
        const up = await admin
          .from("sightings")
          .update({
            category,
            subcategory,
            authority_role: role,
            candidate_label: category === OTHER_KEY ? clip(body.candidateLabel, 80) : null,
            review_status: "approved",
            // Only reports a body handles have a status to follow; one filed while being checked starts as reported.
            case_status: role ? (filed ? "reported" : "open") : null,
            ...reviewed,
          })
          .eq("id", id);
        if (up.error) throw up.error;
        await event(id, "approved");
        await admin.from("sighting_reporters").update({ trusted: true }).eq("reporter_key", row.reporter_key);
        after(() => notifyReporter(row.reporter_key, { title: "Your report is published", body: "It is now on the public record for its place.", url: "/mitra" }));
        after(() => notifyFollowers(admin, row, { title: "A new report at a place you follow", body: "Open it to see what was reported.", url: "/mitra" }, [row.reporter_key]));
        break;
      }
      case "reject": {
        if (row.review_status !== "received") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
        await deletePhotos(await photosOf(id));
        await admin.from("sightings").update({ review_status: "rejected", note: null, ...reviewed }).eq("id", id);
        await event(id, "rejected");
        after(() => notifyReporter(row.reporter_key, { title: "Your report was not published", body: "Open My reports to see why.", url: "/mitra" }));
        break;
      }
      // A fixed claim, from the reporter or anyone nearby, moves the status only once its photo is checked.
      case "publish_fixed": {
        await publishPhotos((await photosOf(id, "fixed")).filter((p) => !p.public_path));
        const next = nextCaseStatus("fixed", row.case_status);
        if (next) {
          await admin.from("sightings").update({ case_status: next, updated_at: new Date().toISOString() }).eq("id", id);
          await event(id, "fixed");
          after(() => notifyReporter(row.reporter_key, { title: "One of your reports is fixed", body: "A checked photo shows the spot now. The record says Fixed.", url: "/mitra" }));
          after(() => notifyFollowers(admin, row, { title: "Fixed at a place you follow", body: "A checked photo shows the spot now.", url: "/mitra" }, [row.reporter_key]));
        }
        break;
      }
      case "discard_fixed": {
        await deletePhotos((await photosOf(id, "fixed")).filter((p) => !p.public_path));
        await event(id, "fix_rejected");
        const sent = (await admin.from("sighting_events").select("actor_key").eq("sighting_id", id).eq("event", "fix_submitted").order("created_at", { ascending: false }).limit(1)).data?.[0];
        if (sent?.actor_key) after(() => notifyReporter(sent.actor_key, { title: "Your fixed photo was not accepted", body: "The report stays as it was. You can send another photo of the spot.", url: "/mitra" }));
        break;
      }
      // A resident's "still there" photo: its event is already recorded; only the photo waits to be checked.
      case "publish_update": {
        const waiting = (await photosOf(id, "update")).filter((p) => !p.public_path);
        await publishPhotos(waiting);
        for (const key of senders(waiting)) {
          after(() => notifyReporter(key, { title: "Your photo is on the record", body: "Your photo of the spot was checked and added to the report.", url: "/mitra" }));
        }
        break;
      }
      case "discard_update": {
        const waiting = (await photosOf(id, "update")).filter((p) => !p.public_path);
        await deletePhotos(waiting);
        for (const key of senders(waiting)) {
          after(() => notifyReporter(key, { title: "Your photo was not added", body: "It could not be published with the report. You can send another photo of the spot.", url: "/mitra" }));
        }
        break;
      }
      case "merge":
        return await merge(row, body.targetReportId);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logRouteError("sightings/review POST", err);
    return internalServerError();
  }
}
