import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const revalidate = 86400; // cache for 24 hours

export async function GET() {
  const profilesPath = path.join(process.cwd(), "public/data/ward-profiles.json");
  const profilesRaw = await readFile(profilesPath, "utf-8");
  const profiles: { ward_number: number; ward_name: string; zone_name: string }[] = JSON.parse(profilesRaw);

  const wards = profiles.map((p) => ({
    wardNumber: p.ward_number,
    wardName: p.ward_name,
    zone: p.zone_name || "",
  }));

  return NextResponse.json({ wards });
}
