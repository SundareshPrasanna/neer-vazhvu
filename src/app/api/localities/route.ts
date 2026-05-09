import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const revalidate = 86400; // cache for 24 hours

export interface LocalityEntry {
  name: string;
  name_ta?: string;
  type: "suburb" | "neighbourhood" | "quarter";
  lat: number;
  lng: number;
  ward_number: number;
  zone_name: string;
  zone_no: string;
}

/** Resolve the public/data/ filename for a city's locality list.
 *  Chennai uses the legacy chennai-localities.json. Other cities use
 *  <cityId>-localities.json. Missing file = 404 (the consumer treats
 *  that as "no locality search for this city" and falls back to ward
 *  number / zone name search only). */
function localitiesPathFor(cityId: string): string {
  return path.join(process.cwd(), "public/data", `${cityId}-localities.json`);
}

export async function GET(request: NextRequest) {
  const cityId = (request.nextUrl.searchParams.get("city") || "chennai").toLowerCase();
  let raw: string;
  try {
    raw = await readFile(localitiesPathFor(cityId), "utf-8");
  } catch {
    return NextResponse.json(
      { error: `No locality file for city '${cityId}'` },
      { status: 404 },
    );
  }
  const localities: LocalityEntry[] = JSON.parse(raw);
  return NextResponse.json({ localities });
}
