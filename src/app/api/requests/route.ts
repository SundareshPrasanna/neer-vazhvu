import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { CAP_MESSAGES, LIMITS, type CapReason } from "@/lib/requests/limits";
import { parseRequest } from "@/lib/requests/validate";
import { adminClient, reporterKey, requireUser } from "@/lib/sightings/auth";

export const runtime = "nodejs";

/** Ask for a place, data or a feature. Signed-in only; caps are enforced in the database. */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const parsed = parseRequest(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    const { data: created, error } = await adminClient().rpc("create_request", {
      p_row: {
        requester_key: reporterKey(user.id),
        requester_name: v.name,
        // The account's own address, never one typed into the form.
        contact_email: v.contactOk ? (user.email ?? null) : null,
        kind: v.kind,
        subject: v.subject,
        message: v.message,
        source_path: v.sourcePath,
      },
      p_daily: LIMITS.daily,
      p_open: LIMITS.open,
      p_site_daily: LIMITS.siteDaily,
    });
    if (error) throw error;
    if (!created.ok) {
      const reason = created.reason as CapReason;
      return NextResponse.json({ error: CAP_MESSAGES[reason], reason }, { status: reason === "duplicate" ? 409 : 429 });
    }
    return NextResponse.json({ data: { id: created.id as string } });
  } catch (err) {
    logRouteError("requests/POST", err);
    return internalServerError();
  }
}
