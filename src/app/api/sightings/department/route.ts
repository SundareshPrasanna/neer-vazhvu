import { NextResponse, after, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reportsEnabled } from "@/lib/sightings/auth";
import {
  DEPARTMENT_LIMITS,
  NOTE_MAX,
  actionsFor,
  actorKey,
  departmentItems,
  departmentMove,
  departmentOf,
  findDepartment,
  isDepartmentEvent,
  istDate,
  linkSecret,
  verifyDepartmentToken,
} from "@/lib/sightings/departments";
import { notifyReporter } from "@/lib/sightings/notify";
import type { DepartmentEvent } from "@/lib/sightings/status";
import type { SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

/** A department's own page: never cached, never indexed. */
const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: PRIVATE });

/** The department key behind a signed link, or a ready error response. */
function keyFrom(token: unknown): string | NextResponse {
  if (!reportsEnabled() || !linkSecret()) return fail("Not available", 404);
  return verifyDepartmentToken(token) ?? fail("This link is not valid.", 404);
}

/** The department's name and its approved reports, open first. Public-shaped: nothing about the reporter. */
export async function GET(request: NextRequest) {
  const key = keyFrom(request.nextUrl.searchParams.get("token"));
  if (key instanceof NextResponse) return key;
  const department = findDepartment(key);
  if (!department) return fail("This link no longer matches a department.", 410);
  try {
    const { open, done } = await departmentItems(adminClient(), key);
    return NextResponse.json({ data: { body: department.body, acronym: department.acronym, asOf: istDate(Date.now()), open, done } }, { headers: PRIVATE });
  } catch (err) {
    logRouteError("sightings/department GET", err);
    return internalServerError();
  }
}

/** Words for the reporter's notice; "not ours" moves nothing and sends none. */
const NOTICE: Record<Exclude<DepartmentEvent, "not_ours">, string> = { action_taken: "action taken", closed: "closed" };

/** A department marks one of its reports: action taken, not ours, or closed, with an optional note. */
export async function POST(request: NextRequest) {
  const input = (await request.json().catch(() => null)) as { token?: unknown; id?: unknown; event?: unknown; note?: unknown } | null;
  if (!input) return fail("Bad request", 400);
  const key = keyFrom(input.token);
  if (key instanceof NextResponse) return key;
  const { id, event } = input;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return fail("Not found", 404);
  if (!isDepartmentEvent(event)) return fail("Unknown update.", 400);
  if (input.note != null && typeof input.note !== "string") return fail("Bad request", 400);
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > NOTE_MAX) return fail(`Keep the note to ${NOTE_MAX} characters.`, 400);

  try {
    const admin = adminClient();
    const row = (await admin.from("sightings").select("*").eq("id", id).maybeSingle()).data as SightingRow | null;
    // Another body's report reads as missing: a link sees only its own.
    if (!row || departmentOf(row)?.key !== key) return fail("Not found", 404);
    if (row.review_status !== "approved") return fail("This report is not published.", 409);
    const move = departmentMove(event, row.case_status);
    if (!move.ok) return fail("That update does not fit this report's status.", 409);

    const actor = actorKey(key);
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [all, one] = await Promise.all([
      admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("actor_key", actor).gte("created_at", since),
      admin.from("sighting_events").select("id", { count: "exact", head: true }).eq("actor_key", actor).eq("sighting_id", id).gte("created_at", since),
    ]);
    if (all.error) throw all.error;
    if (one.error) throw one.error;
    if ((all.count ?? 0) >= DEPARTMENT_LIMITS.daily || (one.count ?? 0) >= DEPARTMENT_LIMITS.perReportDaily)
      return fail("This link has reached today's limit for updates. Please try again tomorrow.", 429);

    // Moves only from the status it was read at, so a reviewer's change made meanwhile is never overwritten.
    if (move.next) {
      const up = await admin
        .from("sightings")
        .update({ case_status: move.next, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("case_status", row.case_status!)
        .select("id");
      if (up.error) throw up.error;
      if (!up.data?.length) return fail("This report changed a moment ago. Please reload the page.", 409);
    }
    const ev = await admin.from("sighting_events").insert({ sighting_id: id, actor_key: actor, actor_role: "department", event, reason: note || null });
    if (ev.error) throw ev.error;

    const caseStatus = move.next ?? row.case_status!;
    if (event !== "not_ours" && caseStatus !== row.case_status && row.reporter_key !== "deleted") {
      const word = NOTICE[event];
      after(() => notifyReporter(row.reporter_key, { title: "Update on your report", body: `The department marked one of your reports: ${word}.`, url: "/for-citizens" }));
    }
    return NextResponse.json({ data: { caseStatus, actions: actionsFor(caseStatus), at: istDate(Date.now()) } }, { headers: PRIVATE });
  } catch (err) {
    logRouteError("sightings/department POST", err);
    return internalServerError();
  }
}
