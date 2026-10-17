import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, requireUser } from "@/lib/sightings/auth";
import { MAX_SUBSCRIPTIONS, parseSubscription } from "@/lib/sightings/push";

export const runtime = "nodejs";

const TABLE = "sighting_push_subscriptions";

/** Turns notifications on for this browser: saved against the reporter's tag, newest five browsers kept. */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const sub = parseSubscription(await request.json().catch(() => null));
  if (!sub) return NextResponse.json({ error: "This browser cannot get notifications from us." }, { status: 400 });
  try {
    const admin = adminClient();
    const key = reporterKey(user.id);
    // A browser's notices follow whoever last turned them on in it.
    const up = await admin.from(TABLE).upsert({ ...sub, reporter_key: key, created_at: new Date().toISOString() }, { onConflict: "endpoint" });
    if (up.error) throw up.error;
    const { data, error } = await admin.from(TABLE).select("endpoint").eq("reporter_key", key).order("created_at", { ascending: false });
    if (error) throw error;
    const extra = (data ?? []).slice(MAX_SUBSCRIPTIONS).map((r) => r.endpoint as string);
    if (extra.length) {
      const del = await admin.from(TABLE).delete().in("endpoint", extra);
      if (del.error) throw del.error;
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logRouteError("sightings/push", err);
    return internalServerError();
  }
}

/** Turns notifications off for one browser. The endpoint comes in the body, so it stays out of request logs. */
export async function DELETE(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint || endpoint.length > 1000) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const del = await adminClient().from(TABLE).delete().eq("endpoint", endpoint).eq("reporter_key", reporterKey(user.id));
    if (del.error) throw del.error;
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logRouteError("sightings/push DELETE", err);
    return internalServerError();
  }
}
