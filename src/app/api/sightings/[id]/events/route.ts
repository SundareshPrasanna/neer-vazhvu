import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, isReviewer, reporterKey, requireUser } from "@/lib/sightings/auth";
import { CAP_MESSAGES, LIMITS } from "@/lib/sightings/limits";
import { storePhotos } from "@/lib/sightings/photos";
import { REVIEWER_ONLY, nextCaseStatus } from "@/lib/sightings/status";
import type { SightingRow } from "@/lib/sightings/types";
import { parseEvent } from "@/lib/sightings/validate";

export const runtime = "nodejs";

/** A status update on a published report, by its reporter or a reviewer. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const parsed = parseEvent(await request.formData());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    const admin = adminClient();
    const { data } = await admin.from("sightings").select("*").eq("id", id).maybeSingle();
    const row = data as SightingRow | null;
    const reviewer = isReviewer(user.id);
    const key = reporterKey(user.id);
    const own = row?.reporter_key === key;
    if (!row || (!own && !reviewer)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // While a report is being checked, its reporter may record only that they filed it, so the reference is not lost.
    const early = row.review_status === "received" && own && v.event === "reported" && !!row.authority_role;
    if (row.review_status !== "approved" && !early) return NextResponse.json({ error: "This report is not published yet." }, { status: 409 });
    if (REVIEWER_ONLY.has(v.event) && !reviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const next = early ? null : nextCaseStatus(v.event, row.case_status);
    if (!next && !early) return NextResponse.json({ error: "That update does not fit this report's status." }, { status: 409 });

    if (!reviewer) {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const [rep, recent, fixedPhotos] = await Promise.all([
        admin.from("sighting_reporters").select("suspended_at").eq("reporter_key", key).maybeSingle(),
        admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("actor_key", key).gte("created_at", since),
        admin.from("sighting_photos").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("kind", "fixed"),
      ]);
      if (rep.data?.suspended_at) return NextResponse.json({ error: CAP_MESSAGES.suspended }, { status: 403 });
      if ((recent.count ?? 0) >= LIMITS.updatesPerReportDaily) return NextResponse.json({ error: CAP_MESSAGES.daily_cap }, { status: 429 });
      if (v.photo && (fixedPhotos.count ?? 0) >= LIMITS.photosPerReport) return NextResponse.json({ error: "This report already has its fixed photos." }, { status: 429 });
    }

    // The fixed photo waits for review like any other photo.
    if (v.photo) {
      const stored = await storePhotos(id, key, row.place_id, "fixed", [v.photo]);
      if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: stored.status });
    }
    const ev = await admin.from("sighting_events").insert({
      sighting_id: id,
      actor_key: key,
      actor_role: own ? "reporter" : "reviewer",
      event: v.event,
      authority_body: v.authorityBody,
      reference: v.reference,
      reason: v.reason,
    });
    if (ev.error) throw ev.error;
    const up = await admin.from("sightings").update({ ...(next && { case_status: next }), updated_at: new Date().toISOString() }).eq("id", id);
    if (up.error) throw up.error;
    return NextResponse.json({ data: { caseStatus: next ?? row.case_status } });
  } catch (err) {
    logRouteError("sightings/events", err);
    return internalServerError();
  }
}
