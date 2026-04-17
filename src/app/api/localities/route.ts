import { NextResponse } from "next/server";
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

export async function GET() {
  const localitiesPath = path.join(process.cwd(), "public/data/chennai-localities.json");
  const raw = await readFile(localitiesPath, "utf-8");
  const localities: LocalityEntry[] = JSON.parse(raw);
  return NextResponse.json({ localities });
}
