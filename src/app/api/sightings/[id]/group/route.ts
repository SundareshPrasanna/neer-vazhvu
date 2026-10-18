import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, requireUser } from "@/lib/sightings/auth";
import { tagProblem, type GroupStatus, type TagTarget } from "@/lib/sightings/groups";

export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: PRIVATE });
const UUID = /^[0-9a-f-]{36}$/;

/**
 * Adds the sender's own community report to a group afterwards, `{ groupId }`, or takes it out, `{ groupId: null }`.
 * Adding needs membership of a reviewed group; the report then shows the group's name, as when sent with it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!UUID.test(id)) return fail("Not found", 404);
  const input = (await request.json().catch(() => null)) as { groupId?: unknown } | null;
  const groupId = input?.groupId;
  if (!(groupId === null || (typeof groupId === "string" && UUID.test(groupId)))) return fail("Bad request", 400);

  try {
    const admin = adminClient();
    const key = reporterKey(user.id);
    const { data: row, error } = await admin.from("sightings").select("reporter_key, category, review_status").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!row) return fail("Not found", 404);
    let group: { status: GroupStatus; name: string } | null = null;
    if (groupId) {
      const [m, g] = await Promise.all([
        admin.from("sighting_group_members").select("role").eq("group_id", groupId).eq("reporter_key", key).maybeSingle(),
        admin.from("sighting_groups").select("status, name").eq("id", groupId).maybeSingle(),
      ]);
      if (m.error) throw m.error;
      if (g.error) throw g.error;
      group = m.data && g.data ? { status: g.data.status as GroupStatus, name: g.data.name as string } : null;
    }
    const problem = tagProblem(row as TagTarget, key, groupId ? group : "clear");
    if (problem) return fail(problem.error, problem.status);
    const up = await admin.from("sightings").update({ group_id: groupId }).eq("id", id).eq("reporter_key", key);
    if (up.error) throw up.error;
    return NextResponse.json({ data: { groupName: group?.name ?? null } }, { headers: PRIVATE });
  } catch (err) {
    logRouteError("sightings/[id]/group", err);
    return internalServerError();
  }
}
