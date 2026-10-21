import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests/validate";
import { adminClient, requireReviewer } from "@/lib/sightings/auth";

export const runtime = "nodejs";

/** Every request, newest first, with how many accounts asked for the same subject. */
export async function GET(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  try {
    const { data, error } = await adminClient()
      .from("requests")
      .select("id, created_at, requester_key, requester_name, contact_email, kind, subject, subject_key, message, source_path, status, reviewed_at, reviewer_note")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    // Demand: distinct accounts per subject, so one person asking twice counts once.
    const askers = new Map<string, Set<string>>();
    for (const r of data) {
      const k = `${r.kind}:${r.subject_key}`;
      askers.set(k, (askers.get(k) ?? new Set()).add(r.requester_key));
    }
    return NextResponse.json({
      data: data.map((r) => {
        // The account key stays on the server.
        const out: Partial<typeof r> = { ...r };
        delete out.requester_key;
        return { ...out, asks: askers.get(`${r.kind}:${r.subject_key}`)!.size };
      }),
    });
  } catch (err) {
    logRouteError("requests/review GET", err);
    return internalServerError();
  }
}

/** Set a request's status, with an optional note. */
export async function POST(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  try {
    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown; note?: unknown } | null;
    const status = body?.status as RequestStatus;
    if (typeof body?.id !== "string" || !REQUEST_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 280) : null;
    const now = new Date().toISOString();
    const { error } = await adminClient()
      .from("requests")
      .update({ status, reviewer_note: note, reviewed_at: now, updated_at: now })
      .eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ data: { id: body.id, status } });
  } catch (err) {
    logRouteError("requests/review POST", err);
    return internalServerError();
  }
}
