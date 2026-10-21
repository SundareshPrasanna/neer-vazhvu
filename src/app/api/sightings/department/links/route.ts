import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, requireReviewer } from "@/lib/sightings/auth";
import { departmentSummaries, linkSecret, signDepartment } from "@/lib/sightings/departments";

export const runtime = "nodejs";

/** Reviewer only: every body with approved reports, its counts and its signed link (a path on this site). */
export async function GET(request: NextRequest) {
  const user = await requireReviewer(request);
  if (user instanceof NextResponse) return user;
  if (!linkSecret())
    return NextResponse.json({ error: "Department links are off: set SIGHTINGS_DEPARTMENT_LINK_SECRET (at least 32 characters)." }, { status: 503 });
  try {
    const list = await departmentSummaries(adminClient());
    return NextResponse.json(
      { data: list.map((d) => ({ ...d, path: `/department/${signDepartment(d.key)}` })) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    logRouteError("sightings/department/links", err);
    return internalServerError();
  }
}
