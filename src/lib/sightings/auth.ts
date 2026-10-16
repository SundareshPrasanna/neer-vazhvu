import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/** Off until the database, buckets and Google sign-in are provisioned. */
export function reportsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CITIZEN_REPORTS === "on" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Service-role client: every sightings read and write goes through it. */
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user from the request's bearer token, or a ready error response. */
export async function requireUser(request: NextRequest): Promise<User | NextResponse> {
  if (!reportsEnabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return data.user;
}

export function isReviewer(userId: string): boolean {
  return (process.env.SIGHTINGS_REVIEWER_IDS ?? "").split(",").map((s) => s.trim()).includes(userId);
}

export async function requireReviewer(request: NextRequest): Promise<User | NextResponse> {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  return isReviewer(user.id) ? user : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
