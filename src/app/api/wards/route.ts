import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { wardProfilesFile } from "@/lib/cities/data-paths";
import { requireCity } from "@/lib/require-city";

export const revalidate = 86400; // cache for 24 hours

export async function GET(request: NextRequest) {
  const city = requireCity(request.nextUrl.searchParams);
  if (city instanceof NextResponse) return city;
  const cityId = city.cityId;
  let profilesRaw: string;
  try {
    profilesRaw = await readFile(path.join(process.cwd(), "public/data", wardProfilesFile(cityId)), "utf-8");
  } catch {
    return NextResponse.json({ error: `No ward profiles for city '${cityId}'` }, { status: 404 });
  }
  // Dual-shape during the NVDM migration: legacy bare array or the
  // wrapped producer-emitted form ({ envelope..., wards: [...] }).
  const parsed = JSON.parse(profilesRaw);
  const profiles: { ward_number: number; zone_name: string }[] = Array.isArray(parsed)
    ? parsed
    : parsed.wards;

  const wards = profiles.map((p) => ({
    wardNumber: p.ward_number,
    wardName: `Ward ${p.ward_number}`,
    zone: p.zone_name || "",
  }));

  return NextResponse.json({ wards });
}
