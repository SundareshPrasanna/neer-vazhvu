import { NextResponse } from "next/server";
import { tryGetPlaceConfig } from "@/lib/cities";
import type { PlaceConfig } from "@/lib/cities/types";

/**
 * Resolve an API request's `?city=` to a registered place. There is no default:
 * a request that names no city, or an unknown one, is an error rather than
 * silently another city's data.
 */
export function requireCity(searchParams: URLSearchParams): PlaceConfig | NextResponse {
  const id = searchParams.get("city")?.trim().toLowerCase();
  if (!id) return NextResponse.json({ error: "city parameter required" }, { status: 400 });
  return tryGetPlaceConfig(id) ?? NextResponse.json({ error: `Unknown city '${id}'` }, { status: 404 });
}
