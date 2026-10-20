import { NextResponse, type NextRequest } from "next/server";

import { logRouteError } from "@/lib/api-error";
import { requireUser } from "@/lib/sightings/auth";

export const runtime = "nodejs";

type Hit = { name: string; lat: number; lng: number };

// Nominatim's policy: an identifying user agent, no autocomplete, light use. Proxied, so it sees our server, never the reporter's device.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const AGENT = "NeerVazhvu/1.0 (+https://neervazhvu.org/mitra)";
const cache = new Map<string, Hit[]>();
// One request a second from this instance; queued callers wait their turn.
let next = 0;
const turn = () => {
  const wait = Math.max(0, next - Date.now());
  next = Date.now() + wait + 1000;
  return new Promise((r) => setTimeout(r, wait));
};

/** Places in India matching a name, for finding the spot on the report map. Signed-in only. */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (q.length < 3) return NextResponse.json({ data: [] });
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ data: hit });
  try {
    await turn();
    const url = `${NOMINATIM}?${new URLSearchParams({ q, format: "jsonv2", countrycodes: "in", limit: "5", "accept-language": "en" })}`;
    const res = await fetch(url, { headers: { "User-Agent": AGENT }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const data: Hit[] = rows.map((r) => ({ name: r.display_name.split(", ").slice(0, 4).join(", "), lat: Number(r.lat), lng: Number(r.lon) }));
    if (cache.size > 500) cache.clear();
    cache.set(key, data);
    return NextResponse.json({ data });
  } catch (err) {
    logRouteError("sightings/search", err);
    return NextResponse.json({ error: "Search is not working right now. Tap the map instead." }, { status: 502 });
  }
}
