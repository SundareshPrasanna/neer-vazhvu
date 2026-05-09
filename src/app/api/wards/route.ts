import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const revalidate = 86400; // cache for 24 hours

/** Resolve the public/data/ filename for a given city's ward profiles.
 *  Chennai keeps the legacy unsuffixed path for back-compat. Other
 *  cities use a -<cityId> suffix matching the compute scripts' output. */
function profilesPathFor(cityId: string): string {
  const filename = cityId === "chennai" ? "ward-profiles.json" : `${cityId}-ward-profiles.json`;
  return path.join(process.cwd(), "public/data", filename);
}

export async function GET(request: NextRequest) {
  const cityId = (request.nextUrl.searchParams.get("city") || "chennai").toLowerCase();
  let profilesRaw: string;
  try {
    profilesRaw = await readFile(profilesPathFor(cityId), "utf-8");
  } catch {
    return NextResponse.json({ error: `No ward profiles for city '${cityId}'` }, { status: 404 });
  }
  const profiles: { ward_number: number; zone_name: string }[] = JSON.parse(profilesRaw);

  const wards = profiles.map((p) => ({
    wardNumber: p.ward_number,
    wardName: `Ward ${p.ward_number}`,
    zone: p.zone_name || "",
  }));

  return NextResponse.json({ wards });
}
