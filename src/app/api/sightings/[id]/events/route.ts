import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, isReviewer, requireUser } from "@/lib/sightings/auth";
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
    if (!row || (row.reporter_id !== user.id && !reviewer)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.review_status !== "approved") return NextResponse.json({ error: "This report is not published yet." }, { status: 409 });
    if (REVIEWER_ONLY.has(v.event) && !reviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const next = nextCaseStatus(v.event, row.case_status);
    if (!next) return NextResponse.json({ error: "That update does not fit this report's status." }, { status: 409 });

    if (!reviewer) {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const [rep, recent, fixedPhotos] = await Promise.all([
        admin.from("sighting_reporters").select("suspended_at").eq("user_id", user.id).maybeSingle(),
        admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("actor_id", user.id).gte("created_at", since),
        admin.from("sighting_photos").select("id", { count: "exact", head: true }).eq("sighting_id", id).eq("kind", "fixed"),
      ]);
      if (rep.data?.suspended_at) return NextResponse.json({ error: CAP_MESSAGES.suspended }, { status: 403 });
      if ((recent.count ?? 0) >= LIMITS.updatesPerReportDaily) return NextResponse.json({ error: CAP_MESSAGES.daily_cap }, { status: 429 });
      if (v.photo && (fixedPhotos.count ?? 0) >= LIMITS.photosPerReport) return NextResponse.json({ error: "This report already has its fixed photos." }, { status: 429 });
    }

    // The fixed photo waits for review like any other photo.
    if (v.photo) {
      const stored = await storePhotos(id, user.id, row.place_id, "fixed", [v.photo]);
      if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: stored.status });
    }
    const ev = await admin.from("sighting_events").insert({
      sighting_id: id,
      actor_id: user.id,
      actor_role: reviewer && row.reporter_id !== user.id ? "reviewer" : "reporter",
      event: v.event,
      authority_body: v.authorityBody,
      reference: v.reference,
      reason: v.reason,
    });
    if (ev.error) throw ev.error;
    const up = await admin.from("sightings").update({ case_status: next, updated_at: new Date().toISOString() }).eq("id", id);
    if (up.error) throw up.error;
    return NextResponse.json({ data: { caseStatus: next } });
  } catch (err) {
    logRouteError("sightings/events", err);
    return internalServerError();
  }
}
