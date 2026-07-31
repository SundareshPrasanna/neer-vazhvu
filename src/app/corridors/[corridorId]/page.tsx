import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetCorridorManifest } from "@/lib/corridors";
import type { CorridorAssessment } from "@/lib/corridors/types";
import { CorridorContent } from "./corridor-content";

// Industrial Corridor page type (docs/corridors/sriperumbudur/DECISIONS.md).
// Not a city route: corridors are keyed on the corridor registry
// (src/lib/corridors/), and the site Header/Footer suppress themselves on
// /corridors so the page carries its own chrome. Static data only; the one
// live element (Chembarambakkam storage) rides the existing shared
// /api/reservoir/history endpoint client-side.

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ corridorId: string }>;
}

function loadJson<T>(corridorId: string, name: string): T | null {
  const fp = path.join(
    process.cwd(), "public", "data", "corridors", corridorId, name,
  );
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { corridorId } = await params;
  const manifest = tryGetCorridorManifest(corridorId);
  if (!manifest) return { title: "Corridor | Neer Vazhvu" };
  return {
    title: `${manifest.displayName} | Neer Vazhvu`,
    description: manifest.description,
  };
}

export default async function CorridorPage({ params }: PageProps) {
  const { corridorId } = await params;
  const manifest = tryGetCorridorManifest(corridorId);
  if (!manifest) notFound();

  const assessment = loadJson<CorridorAssessment>(corridorId, "assessment.json");
  // A corridor without its assessment table has nothing honest to show.
  if (!assessment) notFound();

  const crosscheck = loadJson<{ summary: never }>(corridorId, "assessment-crosscheck.json") as
    | { summary: Parameters<typeof CorridorContent>[0]["crosscheck"] }
    | null;

  return (
    <CorridorContent
      manifest={manifest}
      assessment={assessment}
      crosscheck={crosscheck?.summary ?? null}
    />
  );
}
