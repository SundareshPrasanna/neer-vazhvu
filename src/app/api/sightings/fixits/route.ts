import { NextResponse, after, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, requireUser } from "@/lib/sightings/auth";
import { notifyFollowers } from "@/lib/sightings/follows";
import { FIXIT_HOURS, GROUP_LIMITS, canHost, cleanText, fixitAllowed, fixitDay, fixitWhen, isFixitOver, startsAtProblem, type GroupRole, type GroupStatus } from "@/lib/sightings/groups";
import { CAP_MESSAGES } from "@/lib/sightings/limits";
import { notifyReporter } from "@/lib/sightings/notify";
import { placeUrl } from "@/lib/sightings/place-url";
import type { PublicFixit, SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: PRIVATE });
const UUID = /^[0-9a-f-]{36}$/;
const ACTIONS: ReadonlySet<string> = new Set(["create", "rsvp", "unrsvp", "cancel", "done"]);
const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

type Admin = ReturnType<typeof adminClient>;
type FixitRow = { id: string; sighting_id: string; group_id: string; starts_at: string; meeting_point: string; note: string | null; status: "planned" | "done" | "cancelled" };

/** The person's role in a group with the group's status and name, or null when not a member. */
async function membership(admin: Admin, groupId: string, key: string): Promise<{ role: GroupRole; status: GroupStatus; name: string } | null> {
  const [m, g] = await Promise.all([
    admin.from("sighting_group_members").select("role").eq("group_id", groupId).eq("reporter_key", key).maybeSingle(),
    admin.from("sighting_groups").select("status, name").eq("id", groupId).maybeSingle(),
  ]);
  if (m.error) throw m.error;
  if (g.error) throw g.error;
  return m.data && g.data ? { role: m.data.role as GroupRole, status: g.data.status as GroupStatus, name: g.data.name as string } : null;
}

const suspended = async (admin: Admin, key: string) =>
  !!(await admin.from("sighting_reporters").select("suspended_at").eq("reporter_key", key).maybeSingle()).data?.suspended_at;

const going = async (admin: Admin, fixitId: string) =>
  (await admin.from("sighting_fixit_rsvps").select("fixit_id", { count: "exact", head: true }).eq("fixit_id", fixitId)).count ?? 0;

/** Planned clean-ups at a report that are not over yet: at most one may exist. */
const activeAt = (admin: Admin, sightingId: string) =>
  admin
    .from("sighting_fixits")
    .select("id, created_at")
    .eq("sighting_id", sightingId)
    .eq("status", "planned")
    .gt("starts_at", new Date(Date.now() - FIXIT_HOURS * 3_600_000).toISOString())
    .order("created_at")
    .order("id");

interface Input {
  action?: unknown;
  sightingId?: unknown;
  groupId?: unknown;
  fixitId?: unknown;
  startsAt?: unknown;
  meetingPoint?: unknown;
  note?: unknown;
}

/**
 * Fix-it days. `create`: a host of a reviewed group plans a clean-up at a published, open community report of a safe
 * type (litter, floating trash, plastic, ritual waste). `rsvp` / `unrsvp`: anyone signed in says they will come, or not.
 * `cancel` / `done`: the group's hosts.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const input = (await request.json().catch(() => null)) as Input | null;
  if (!input || typeof input.action !== "string") return fail("Bad request", 400);
  if (!ACTIONS.has(input.action)) return fail("Unknown action.", 400);
  const key = reporterKey(user.id);
  const admin = adminClient();

  try {
    if (input.action === "create") {
      if (await suspended(admin, key)) return fail(CAP_MESSAGES.suspended, 403);
      const sightingId = id(input.sightingId);
      const groupId = id(input.groupId);
      if (!sightingId || !groupId) return fail("Not found", 404);
      const m = await membership(admin, groupId, key);
      if (!canHost(m)) return fail("Only a host of a reviewed group can plan a clean-up.", 403);
      const row = (await admin.from("sightings").select("*").eq("id", sightingId).maybeSingle()).data as SightingRow | null;
      if (!row || row.review_status !== "approved") return fail("Not found", 404);
      if (!fixitAllowed(row)) return fail("Clean-ups can be planned only for litter, floating trash, plastic or ritual waste on a report that is still open.", 409);
      const startsAt = new Date(typeof input.startsAt === "string" ? input.startsAt : NaN);
      const problem = startsAtProblem(startsAt, Date.now());
      if (problem) return fail(problem, 400);
      const meetingPoint = cleanText(input.meetingPoint, GROUP_LIMITS.meetMin, GROUP_LIMITS.meetMax);
      if (!meetingPoint) return fail(`Say where to meet, in ${GROUP_LIMITS.meetMin} to ${GROUP_LIMITS.meetMax} characters.`, 400);
      const note = cleanText(input.note, 0, GROUP_LIMITS.noteMax);
      if (note === null) return fail(`Keep the note to ${GROUP_LIMITS.noteMax} characters.`, 400);

      const [existing, planned] = await Promise.all([
        activeAt(admin, sightingId),
        admin.from("sighting_fixits").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "planned").gt("starts_at", new Date().toISOString()),
      ]);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return fail("A clean-up is already planned here.", 409);
      if ((planned.count ?? 0) >= GROUP_LIMITS.plannedPerGroup) return fail(`A group can have at most ${GROUP_LIMITS.plannedPerGroup} clean-ups planned at once.`, 429);

      const ins = await admin
        .from("sighting_fixits")
        .insert({ sighting_id: sightingId, group_id: groupId, starts_at: startsAt.toISOString(), meeting_point: meetingPoint, note: note || null, created_by: key })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      // Two hosts at once: the earlier plan stands.
      const now = await activeAt(admin, sightingId);
      if (now.data && now.data.length > 1 && now.data[0].id !== ins.data.id) {
        await admin.from("sighting_fixits").delete().eq("id", ins.data.id);
        return fail("A clean-up is already planned here.", 409);
      }
      // The host who planned it is coming.
      await admin.from("sighting_fixit_rsvps").insert({ fixit_id: ins.data.id, reporter_key: key });

      const when = fixitWhen(startsAt.toISOString());
      const url = placeUrl(row)?.href ?? "/for-citizens";
      if (row.reporter_key !== "deleted" && row.reporter_key !== key)
        after(() => notifyReporter(row.reporter_key, { title: "A group has planned a clean-up at your report", body: `${m!.name} plans a clean-up on ${when}.`, url }));
      after(() => notifyFollowers(admin, row, { title: "A clean-up is planned at a place you follow", body: `${m!.name} plans a clean-up on ${when}.`, url }, [row.reporter_key, key]));
      const fixit: PublicFixit = { id: ins.data.id, groupName: m!.name, startsAt: startsAt.toISOString(), meetingPoint, note: note || null, going: 1 };
      return NextResponse.json({ data: fixit }, { headers: PRIVATE });
    }

    const fixitId = id(input.fixitId);
    if (!fixitId) return fail("Not found", 404);
    const f = (await admin.from("sighting_fixits").select("id, sighting_id, group_id, starts_at, meeting_point, note, status").eq("id", fixitId).maybeSingle()).data as FixitRow | null;
    if (!f) return fail("Not found", 404);
    const open = f.status === "planned" && !isFixitOver(f.starts_at, Date.now());

    switch (input.action) {
      case "rsvp":
      case "unrsvp": {
        if (!open) return fail("This clean-up is no longer planned.", 409);
        const res =
          input.action === "rsvp"
            ? await admin.from("sighting_fixit_rsvps").upsert({ fixit_id: fixitId, reporter_key: key }, { onConflict: "fixit_id,reporter_key", ignoreDuplicates: true })
            : await admin.from("sighting_fixit_rsvps").delete().eq("fixit_id", fixitId).eq("reporter_key", key);
        if (res.error) throw res.error;
        return NextResponse.json({ data: { going: await going(admin, fixitId), mine: input.action === "rsvp" } }, { headers: PRIVATE });
      }

      case "cancel":
      case "done": {
        const m = await membership(admin, f.group_id, key);
        if (!canHost(m)) return fail("Only the group's hosts can change this clean-up.", 403);
        if (f.status !== "planned") return fail("This clean-up is no longer planned.", 409);
        if (input.action === "done" && Date.parse(f.starts_at) > Date.now()) return fail("A clean-up can be marked done once it has started.", 409);
        const status = input.action === "done" ? "done" : "cancelled";
        const up = await admin.from("sighting_fixits").update({ status }).eq("id", fixitId).eq("status", "planned").select("id");
        if (up.error) throw up.error;
        if (!up.data?.length) return fail("This clean-up changed a moment ago. Please reload the page.", 409);
        if (status === "cancelled") {
          const { data: coming } = await admin.from("sighting_fixit_rsvps").select("reporter_key").eq("fixit_id", fixitId);
          const notice = { title: "Clean-up cancelled", body: `${m!.name} has cancelled the clean-up on ${fixitDay(f.starts_at)}.`, url: "/for-citizens" };
          after(() => Promise.all((coming ?? []).filter((r) => r.reporter_key !== key).map((r) => notifyReporter(r.reporter_key as string, notice))));
        }
        return NextResponse.json({ data: { status } }, { headers: PRIVATE });
      }

      default:
        return fail("Unknown action.", 400);
    }
  } catch (err) {
    logRouteError("sightings/fixits POST", err);
    return internalServerError();
  }
}
