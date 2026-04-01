import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 86400; // cache for 24 hours

export async function GET() {
  // Load ward profiles (all 200 wards with zone names)
  const profilesPath = path.join(process.cwd(), "public/data/ward-profiles.json");
  const profilesRaw = await readFile(profilesPath, "utf-8");
  const profiles: { ward_number: number; zone_name: string }[] = JSON.parse(profilesRaw);

  // Get ward names from groundwater data (best source for locality names)
  const { data: gwData } = await supabase
    .from("groundwater_monthly")
    .select("ward_number, ward_name, zone_name")
    .order("ward_number");

  // Build name lookup from groundwater data
  const nameMap = new Map<number, string>();
  for (const r of gwData || []) {
    if (r.ward_name && !nameMap.has(r.ward_number)) {
      nameMap.set(r.ward_number, r.ward_name);
    }
  }

  // Build ward list from profiles (all 200) enriched with names
  const wards = profiles.map((p) => ({
    wardNumber: p.ward_number,
    wardName: nameMap.get(p.ward_number) || `Ward ${p.ward_number}`,
    zone: p.zone_name || "",
  }));

  return NextResponse.json({ wards });
}
