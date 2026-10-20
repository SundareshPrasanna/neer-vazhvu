import { randomBytes } from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, isReviewer, reporterKey, reportsEnabled, requireReviewer, requireUser } from "@/lib/sightings/auth";
import {
  CLEANUPS_ON,
  GROUP_LIMITS,
  canHost,
  cleanName,
  groupPlaces,
  isFixitOver,
  isGroupKind,
  joinPath,
  kindLabel,
  loadPublicGroups,
  newJoinCode,
  normalizeJoinCode,
  settleGroup,
  type GroupRole,
  type GroupStatus,
  type MyGroup,
  type MyGroups,
} from "@/lib/sightings/groups";
import { CAP_MESSAGES } from "@/lib/sightings/limits";
import { notifyReporter } from "@/lib/sightings/notify";

export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: PRIVATE });
const UUID = /^[0-9a-f-]{36}$/;

type GroupRow = { id: string; name: string; kind: string; place_id: string | null; status: GroupStatus; join_code: string; created_at: string };
type Admin = ReturnType<typeof adminClient>;

/** Members per group, counted in memory (groups are small). */
async function memberCounts(admin: Admin, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const { data, error } = await admin.from("sighting_group_members").select("group_id").in("group_id", ids).limit(20_000);
  if (error) throw error;
  for (const m of data ?? []) out.set(m.group_id as string, (out.get(m.group_id as string) ?? 0) + 1);
  return out;
}

/** The person's groups, the clean-ups they said they will come to and those their groups host. */
async function mine(admin: Admin, key: string): Promise<MyGroups> {
  const { data: ms, error } = await admin.from("sighting_group_members").select("group_id, role").eq("reporter_key", key);
  if (error) throw error;
  const roles = new Map((ms ?? []).map((m) => [m.group_id as string, m.role as GroupRole]));
  const ids = [...roles.keys()];
  const [groups, counts, rsvps] = await Promise.all([
    ids.length ? admin.from("sighting_groups").select("id, name, kind, place_id, status, join_code, created_at").in("id", ids) : Promise.resolve({ data: [], error: null }),
    memberCounts(admin, ids),
    admin.from("sighting_fixit_rsvps").select("fixit_id").eq("reporter_key", key).limit(500),
  ]);
  if (groups.error) throw groups.error;
  const rows = (groups.data ?? []) as GroupRow[];
  const places = new Map(groupPlaces().map((p) => [p.id, p.name]));
  const hosted = rows.filter((g) => canHost({ role: roles.get(g.id)!, status: g.status })).map((g) => g.id);
  const rsvpIds = (rsvps.data ?? []).map((r) => r.fixit_id as string);
  const now = Date.now();
  const since = new Date(now - 24 * 3_600_000).toISOString();
  const [going, hosting] = await Promise.all([
    rsvpIds.length ? admin.from("sighting_fixits").select("id, starts_at").in("id", rsvpIds).eq("status", "planned").gte("starts_at", since) : Promise.resolve({ data: [] }),
    hosted.length ? admin.from("sighting_fixits").select("id, starts_at").in("group_id", hosted).eq("status", "planned").gte("starts_at", since) : Promise.resolve({ data: [] }),
  ]);
  const live = (d: { data: unknown[] | null }) => ((d.data ?? []) as { id: string; starts_at: string }[]).filter((f) => !isFixitOver(f.starts_at, now)).map((f) => f.id);
  return {
    groups: rows
      .map((g): MyGroup => {
        const role = roles.get(g.id)!;
        return {
          id: g.id,
          name: g.name,
          kind: g.kind,
          kindLabel: kindLabel(g.kind),
          placeName: g.place_id ? (places.get(g.place_id) ?? null) : null,
          status: g.status,
          role,
          members: counts.get(g.id) ?? 0,
          joinPath: role === "host" && g.status !== "rejected" ? joinPath(g.join_code) : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    going: live(going),
    hosting: [...new Set(live(hosting))],
    places: groupPlaces(),
  };
}

/**
 * Public: reviewed groups with what they did together, never members. `scope=mine`: the signed-in person's groups.
 * `scope=pending`: groups waiting for review (reviewers).
 */
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "mine") {
    const user = await requireUser(request);
    if (user instanceof NextResponse) return user;
    try {
      return NextResponse.json({ data: await mine(adminClient(), reporterKey(user.id)) }, { headers: PRIVATE });
    } catch (err) {
      logRouteError("sightings/groups mine", err);
      return internalServerError();
    }
  }
  if (scope === "pending") {
    const user = await requireReviewer(request);
    if (user instanceof NextResponse) return user;
    try {
      const admin = adminClient();
      const { data, error } = await admin.from("sighting_groups").select("id, name, kind, place_id, created_at").eq("status", "pending").order("created_at").limit(100);
      if (error) throw error;
      const rows = (data ?? []) as Omit<GroupRow, "status" | "join_code">[];
      const counts = await memberCounts(admin, rows.map((g) => g.id));
      const places = new Map(groupPlaces().map((p) => [p.id, p.name]));
      return NextResponse.json(
        {
          data: rows.map((g) => ({
            id: g.id,
            name: g.name,
            kindLabel: kindLabel(g.kind),
            placeName: g.place_id ? (places.get(g.place_id) ?? null) : null,
            createdAt: g.created_at,
            members: counts.get(g.id) ?? 0,
          })),
        },
        { headers: PRIVATE },
      );
    } catch (err) {
      logRouteError("sightings/groups pending", err);
      return internalServerError();
    }
  }
  if (!reportsEnabled()) return NextResponse.json({ data: [] });
  try {
    return NextResponse.json({ data: await loadPublicGroups(adminClient()) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    logRouteError("sightings/groups GET", err);
    return internalServerError();
  }
}

interface Input {
  action?: unknown;
  name?: unknown;
  kind?: unknown;
  placeId?: unknown;
  code?: unknown;
  groupId?: unknown;
}

/** Tells a group's hosts something about it. Never throws. */
async function notifyHosts(admin: Admin, groupId: string, notice: { title: string; body: string }) {
  const { data } = await admin.from("sighting_group_members").select("reporter_key").eq("group_id", groupId).eq("role", "host");
  await Promise.all((data ?? []).map((m) => notifyReporter(m.reporter_key as string, { ...notice, url: "/for-citizens" })));
}

/** Start, join, leave or re-key a group; reviewers approve or reject one. */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const input = (await request.json().catch(() => null)) as Input | null;
  if (!input || typeof input.action !== "string") return fail("Bad request", 400);
  const key = reporterKey(user.id);
  const admin = adminClient();
  const groupId = typeof input.groupId === "string" && UUID.test(input.groupId) ? input.groupId : null;

  try {
    switch (input.action) {
      case "create": {
        const sus = await admin.from("sighting_reporters").select("suspended_at").eq("reporter_key", key).maybeSingle();
        if (sus.data?.suspended_at) return fail(CAP_MESSAGES.suspended, 403);
        const name = cleanName(input.name);
        if (!name) return fail(`Give the group a name of ${GROUP_LIMITS.nameMin} to ${GROUP_LIMITS.nameMax} characters.`, 400);
        if (!isGroupKind(input.kind)) return fail("Choose what kind of group it is.", 400);
        const placeId = input.placeId == null || input.placeId === "" ? null : input.placeId;
        if (placeId !== null && !groupPlaces().some((p) => p.id === placeId)) return fail("Choose a city or district from the list.", 400);
        const [created, joined] = await Promise.all([
          admin.from("sighting_groups").select("id", { count: "exact", head: true }).eq("created_by", key),
          admin.from("sighting_group_members").select("group_id", { count: "exact", head: true }).eq("reporter_key", key),
        ]);
        if (created.error) throw created.error;
        if ((created.count ?? 0) >= GROUP_LIMITS.createdPerPerson) return fail(`You can start at most ${GROUP_LIMITS.createdPerPerson} groups.`, 429);
        if ((joined.count ?? 0) >= GROUP_LIMITS.joinedPerPerson) return fail(`You can be in at most ${GROUP_LIMITS.joinedPerPerson} groups. Leave one first.`, 429);
        // A clash on the code is retried with a new one.
        for (let tries = 0; tries < 3; tries++) {
          const ins = await admin
            .from("sighting_groups")
            .insert({ name, kind: input.kind, place_id: placeId, join_code: newJoinCode(randomBytes(12)), created_by: key })
            .select("id")
            .single();
          if (ins.error?.code === "23505") continue;
          if (ins.error) throw ins.error;
          const m = await admin.from("sighting_group_members").insert({ group_id: ins.data.id, reporter_key: key, role: "host" });
          if (m.error) {
            await admin.from("sighting_groups").delete().eq("id", ins.data.id);
            throw m.error;
          }
          return NextResponse.json({ data: { id: ins.data.id } }, { headers: PRIVATE });
        }
        throw new Error("join code clashed three times");
      }

      case "join": {
        const code = normalizeJoinCode(input.code);
        if (!code) return fail("That code does not look right. It has 12 letters and numbers.", 400);
        const { data: g, error } = await admin.from("sighting_groups").select("id, name, status").eq("join_code", code).maybeSingle();
        if (error) throw error;
        if (!g || g.status === "rejected") return fail("No group has this code. Check it with the person who shared it.", 404);
        const already = await admin.from("sighting_group_members").select("role").eq("group_id", g.id).eq("reporter_key", key).maybeSingle();
        if (already.data) return NextResponse.json({ data: { id: g.id, name: g.name, already: true } }, { headers: PRIVATE });
        const joined = await admin.from("sighting_group_members").select("group_id", { count: "exact", head: true }).eq("reporter_key", key);
        if ((joined.count ?? 0) >= GROUP_LIMITS.joinedPerPerson) return fail(`You can be in at most ${GROUP_LIMITS.joinedPerPerson} groups. Leave one first.`, 429);
        const ins = await admin.from("sighting_group_members").insert({ group_id: g.id, reporter_key: key, role: "member" });
        if (ins.error && ins.error.code !== "23505") throw ins.error;
        return NextResponse.json({ data: { id: g.id, name: g.name, already: false } }, { headers: PRIVATE });
      }

      case "leave": {
        if (!groupId) return fail("Not found", 404);
        const del = await admin.from("sighting_group_members").delete().eq("group_id", groupId).eq("reporter_key", key).select("role");
        if (del.error) throw del.error;
        if (!del.data?.length) return fail("You are not in this group.", 404);
        await settleGroup(admin, groupId);
        return NextResponse.json({ data: { ok: true } }, { headers: PRIVATE });
      }

      case "rotate": {
        if (!groupId) return fail("Not found", 404);
        const m = await admin.from("sighting_group_members").select("role").eq("group_id", groupId).eq("reporter_key", key).maybeSingle();
        if (m.data?.role !== "host") return fail("Only the group's hosts can change its link.", 403);
        for (let tries = 0; tries < 3; tries++) {
          const code = newJoinCode(randomBytes(12));
          const up = await admin.from("sighting_groups").update({ join_code: code }).eq("id", groupId);
          if (up.error?.code === "23505") continue;
          if (up.error) throw up.error;
          return NextResponse.json({ data: { joinPath: joinPath(code) } }, { headers: PRIVATE });
        }
        throw new Error("join code clashed three times");
      }

      case "approve":
      case "reject": {
        if (!isReviewer(user.id)) return fail("Forbidden", 403);
        if (!groupId) return fail("Not found", 404);
        const status = input.action === "approve" ? "approved" : "rejected";
        const up = await admin
          .from("sighting_groups")
          .update({ status, reviewed_at: new Date().toISOString() })
          .eq("id", groupId)
          .eq("status", "pending")
          .select("name");
        if (up.error) throw up.error;
        if (!up.data?.length) return fail("This group was already reviewed.", 409);
        const name = up.data[0].name as string;
        after(() =>
          notifyHosts(
            admin,
            groupId,
            status === "approved"
              ? { title: "Your group is active", body: `${name} was checked. Reports sent with it now show its name${CLEANUPS_ON ? ", and its hosts can plan clean-ups" : ""}.` }
              : { title: "Your group was not approved", body: `${name} was not approved. You can still send reports on your own.` },
          ),
        );
        return NextResponse.json({ data: { ok: true } }, { headers: PRIVATE });
      }

      default:
        return fail("Unknown action.", 400);
    }
  } catch (err) {
    logRouteError("sightings/groups POST", err);
    return internalServerError();
  }
}
