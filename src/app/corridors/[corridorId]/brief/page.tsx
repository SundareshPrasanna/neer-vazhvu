import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetCorridorManifest } from "@/lib/corridors";
import type { CorridorAssessment } from "@/lib/corridors/types";
import { BriefContent } from "./brief-content";

// Print-optimized two-page corridor brief (Milestone 4, pulled forward).
// The outreach channel is email attachments and printouts, so this route
// exists to be rendered to PDF. The brief embeds a STATIC map image rather
// than live Leaflet: Chrome's print compositor leaks Leaflet's transformed
// panes outside their clip (duplicated map fragments on the PDF page), so
// the map is frozen to a committed PNG. Regeneration is two captures:
//   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
//   # 1. the map image (?maponly=1 renders just the live map at capture size)
//   "$CHROME" --headless --hide-scrollbars --window-size=1360,1000 \
//     --virtual-time-budget=30000 --screenshot=brief-map.png \
//     "http://localhost:3000/corridors/sriperumbudur/brief?maponly=1"
//   #    -> crop to the map element and save as
//   #       public/data/corridors/sriperumbudur/brief-map.png
//   # 2. the PDF
//   "$CHROME" --headless --print-to-pdf=brief.pdf --no-pdf-header-footer \
//     --virtual-time-budget=30000 http://localhost:3000/corridors/sriperumbudur/brief
//   #    -> commit as public/data/corridors/sriperumbudur/sriperumbudur-corridor-brief.pdf
// Both are linked/committed artifacts; not a search surface.

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ corridorId: string }>;
  searchParams: Promise<{ maponly?: string }>;
}

function loadJson<T>(corridorId: string, name: string): T | null {
  const fp = path.join(process.cwd(), "public", "data", "corridors", corridorId, name);
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { corridorId } = await params;
  const manifest = tryGetCorridorManifest(corridorId);
  return {
    title: manifest ? `${manifest.shortName} corridor brief | Neer Vazhvu` : "Corridor brief | Neer Vazhvu",
    robots: { index: false, follow: false },
  };
}

export default async function CorridorBriefPage({ params, searchParams }: PageProps) {
  const { corridorId } = await params;
  const { maponly } = await searchParams;
  const manifest = tryGetCorridorManifest(corridorId);
  if (!manifest) notFound();
  const assessment = loadJson<CorridorAssessment>(corridorId, "assessment.json");
  if (!assessment) notFound();
  const crosscheck = loadJson<{ summary: Parameters<typeof BriefContent>[0]["crosscheck"] }>(
    corridorId,
    "assessment-crosscheck.json",
  );
  return (
    <BriefContent
      manifest={manifest}
      assessment={assessment}
      crosscheck={crosscheck?.summary ?? null}
      mapOnly={maponly === "1"}
    />
  );
}
