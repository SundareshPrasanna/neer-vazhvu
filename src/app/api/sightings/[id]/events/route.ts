import { NextResponse, after, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, isReviewer, reporterKey, requireUser } from "@/lib/sightings/auth";
import { nodFor, seenNotice } from "@/lib/sightings/community";
import { CAP_MESSAGES, LIMITS } from "@/lib/sightings/limits";
import { storePhotos } from "@/lib/sightings/photos";
import { notifyReporter } from "@/lib/sightings/notify";
import { NOD_EVENTS, OPEN_STATUSES, REVIEWER_ONLY, nextCaseStatus, type NodEvent } from "@/lib/sightings/status";
import { isCommunityReport } from "@/lib/sightings/taxonomy";
import type { SightingRow } from "@/lib/sightings/types";
import { parseEvent } from "@/lib/sightings/validate";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;
/** "Still there" photos waiting for a reviewer, per report: more wait until some are checked. */
const UPDATE_PHOTOS_WAITING = 3;
const NODS = `(${NOD_EVENTS.join(",")})`;
const isNod = (event: string): event is NodEvent => (NOD_EVENTS as readonly string[]).includes(event);

/**
 * Someone's updates on other people's reports in the last day, for the resident daily cap. A "seen it too" is left out:
 * the "still there" it records is counted instead, so one tap costs one.
 */
const residentToday = (admin: SupabaseClient, key: string, since: string) =>
  admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("actor_key", key).eq("actor_role", "resident").neq("event", "seen_too").gte("created_at", since);

/**
 * A status update on a published report: by its reporter, a reviewer, or anyone nearby saying it is still there or
 * sending a fixed photo. "Still there" from the reporter or someone nearby may carry one photo, kept as an update photo
 * that is published only once a reviewer checks it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const parsed = parseEvent(await request.formData());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = adminClient();
    const { data } = await admin.from("sightings").select("*").eq("id", id).maybeSingle();
    const row = data as SightingRow | null;
    const reviewer = isReviewer(user.id);
    const key = reporterKey(user.id);
    const own = row?.reporter_key === key;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { event } = parsed.value;
    if (isNod(event)) return await nod(admin, row, event, key, own, reviewer);
    // A reviewer's own "still there" on someone else's report needs no photo of theirs.
    const v = { ...parsed.value, event, photo: event === "still_there" && reviewer && !own ? null : parsed.value.photo };
    const photoKind = v.photo ? (v.event === "fixed" ? "fixed" : "update") : null;

    // Anyone else nearby: only on a published report that is still open, and only these two updates.
    const resident = !own && !reviewer;
    if (resident) {
      // A home's tap water or test is its reporter's alone.
      if (!isCommunityReport(row.category)) return NextResponse.json({ error: "Only the person who sent this report can update it." }, { status: 403 });
      if (row.review_status !== "approved" || !row.case_status || !OPEN_STATUSES.has(row.case_status)) return NextResponse.json({ error: "This report cannot take updates now." }, { status: 409 });
      if (v.event !== "still_there" && v.event !== "fixed") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // While a report is being checked, its reporter may record only that they filed it, so the reference is not lost.
    const early = row.review_status === "received" && own && v.event === "reported" && !!row.authority_role;
    if (row.review_status !== "approved" && !early) return NextResponse.json({ error: "This report is not published yet." }, { status: 409 });
    if (REVIEWER_ONLY.has(v.event) && !reviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const next = early ? null : nextCaseStatus(v.event, row.case_status);
    if (!next && !early) return NextResponse.json({ error: "That update does not fit this report's status." }, { status: 409 });

    if (!reviewer) {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      const [rep, recent, fixedPhotos, mine] = await Promise.all([
        admin.from("sighting_reporters").select("suspended_at").eq("reporter_key", key).maybeSingle(),
        // Nods are once per person anyway: they do not use up a report's daily updates.
        admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("actor_key", key).not("event", "in", NODS).gte("created_at", since),
        admin.from("sighting_photos").select("id, public_path").eq("sighting_id", id).eq("kind", "fixed"),
        resident ? residentToday(admin, key, since) : Promise.resolve({ count: 0 }),
      ]);
      if (rep.data?.suspended_at) return NextResponse.json({ error: CAP_MESSAGES.suspended }, { status: 403 });
      if ((recent.count ?? 0) >= (resident ? 1 : LIMITS.updatesPerReportDaily) || (mine.count ?? 0) >= LIMITS.residentDaily) {
        return NextResponse.json({ error: CAP_MESSAGES.daily_cap }, { status: 429 });
      }
      const photos = fixedPhotos.data ?? [];
      if (photoKind === "fixed" && photos.length >= LIMITS.photosPerReport) return NextResponse.json({ error: "This report already has its fixed photos." }, { status: 429 });
      if (photoKind === "fixed" && photos.some((p) => !p.public_path)) return NextResponse.json({ error: "A fixed photo for this report is already waiting to be checked." }, { status: 409 });
    }
    if (photoKind === "update") {
      const waiting = await admin.from("sighting_photos").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("kind", "update").is("public_path", null);
      if (waiting.error) throw waiting.error;
      if ((waiting.count ?? 0) >= UPDATE_PHOTOS_WAITING) {
        return NextResponse.json({ error: "Photos for this report are waiting to be checked. Send it without a photo, or try again in a few days." }, { status: 429 });
      }
    }
    // A fixed claim from anyone but a reviewer waits for its photo to be checked; the review publishes it and moves the status.
    const held = v.event === "fixed" && !reviewer;

    // A fixed or "still there" photo waits for review like any other photo: stored with no public path.
    if (v.photo && photoKind) {
      const stored = await storePhotos(id, key, row.place_id, photoKind, [v.photo]);
      if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: stored.status });
    }
    const ev = await admin.from("sighting_events").insert({
      sighting_id: id,
      actor_key: key,
      actor_role: own ? "reporter" : resident ? "resident" : "reviewer",
      event: held ? "fix_submitted" : v.event,
      authority_body: v.authorityBody,
      reference: v.reference,
      reason: v.reason,
    });
    if (ev.error) throw ev.error;
    const moved = held ? null : next;
    const up = await admin.from("sightings").update({ ...(moved && { case_status: moved }), updated_at: new Date().toISOString() }).eq("id", id);
    if (up.error) throw up.error;
    if (resident && v.event === "still_there") {
      const body = photoKind ? "They say it is still there, with a photo that shows once it is checked." : "They say it is still there.";
      after(() => notifyReporter(row.reporter_key, { title: "Someone nearby checked your report", body, url: "/mitra" }));
    }
    return NextResponse.json({ data: { caseStatus: moved ?? row.case_status, held } });
  } catch (err) {
    logRouteError("sightings/events", err);
    return internalServerError();
  }
}

/**
 * "I've seen it too" on an open community report (never by its reporter), or "Thank you" on a fixed one (anyone,
 * the reporter too). Once per person: a repeat succeeds and changes nothing. A first "seen it too" also records that
 * person's "still there" unless they gave one in the last day, so the record stays current. Returns the counts.
 */
async function nod(admin: SupabaseClient, row: SightingRow, event: NodEvent, key: string, own: boolean, reviewer: boolean): Promise<NextResponse> {
  if (row.review_status !== "approved") return NextResponse.json({ error: "This report is not published yet." }, { status: 409 });
  if (!isCommunityReport(row.category)) return NextResponse.json({ error: "Only the person who sent this report can update it." }, { status: 403 });
  if (nodFor({ caseStatus: row.case_status, category: row.category }) !== event) {
    return NextResponse.json({ error: event === "thanks" ? "Thanks can be sent once a report is fixed." : "This report cannot take updates now." }, { status: 409 });
  }
  if (event === "seen_too" && own) return NextResponse.json({ error: "This is your own report. Others nearby can say they have seen it too." }, { status: 403 });

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const counted = (e: NodEvent) => admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("sighting_id", row.id).eq("event", e);
  const counts = async () => {
    const [seen, thanks] = await Promise.all([counted("seen_too"), counted("thanks")]);
    if (seen.error) throw seen.error;
    if (thanks.error) throw thanks.error;
    return { seenCount: seen.count ?? 0, thanksCount: thanks.count ?? 0 };
  };
  const unchanged = async () => NextResponse.json({ data: await counts() });

  const [already, rep, mine] = await Promise.all([
    admin.from("sighting_events").select("id").eq("sighting_id", row.id).eq("actor_key", key).eq("event", event).limit(1).maybeSingle(),
    reviewer ? Promise.resolve({ data: null }) : admin.from("sighting_reporters").select("suspended_at").eq("reporter_key", key).maybeSingle(),
    reviewer || own ? Promise.resolve({ count: 0 }) : residentToday(admin, key, since),
  ]);
  if (already.error) throw already.error;
  if (already.data) return await unchanged();
  if (rep.data?.suspended_at) return NextResponse.json({ error: CAP_MESSAGES.suspended }, { status: 403 });
  if ((mine.count ?? 0) >= LIMITS.residentDaily) return NextResponse.json({ error: CAP_MESSAGES.daily_cap }, { status: 429 });

  const ins = await admin.from("sighting_events").insert({ sighting_id: row.id, actor_key: key, actor_role: own ? "reporter" : "resident", event });
  if (ins.error) {
    // Two taps at once: the unique index (migration 064) kept one.
    if (ins.error.code === "23505") return await unchanged();
    throw ins.error;
  }

  if (event === "seen_too") {
    const checked = await admin
      .from("sighting_events")
      .select("id", { count: "exact", head: true })
      .eq("sighting_id", row.id)
      .eq("actor_key", key)
      .eq("event", "still_there")
      .gte("created_at", since);
    if (checked.error) throw checked.error;
    const next = nextCaseStatus("still_there", row.case_status);
    if (!checked.count && next) {
      const ev = await admin.from("sighting_events").insert({ sighting_id: row.id, actor_key: key, actor_role: "resident", event: "still_there" });
      if (ev.error) throw ev.error;
      const up = await admin.from("sightings").update({ case_status: next, updated_at: new Date().toISOString() }).eq("id", row.id);
      if (up.error) throw up.error;
    }
  }

  const c = await counts();
  const notice = event === "seen_too" ? seenNotice(c.seenCount) : null;
  if (notice) after(() => notifyReporter(row.reporter_key, { ...notice, url: "/mitra" }));
  return NextResponse.json({ data: c });
}
