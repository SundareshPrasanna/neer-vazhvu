import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetCorridorManifest } from "@/lib/corridors";
import type { CorridorAssessment } from "@/lib/corridors/types";
import { BriefContent } from "./brief-content";

// Print-optimized two-page corridor brief (Milestone 4, pulled forward).
// The outreach channel is email attachments and printouts, so this route
// exists to be rendered to PDF:
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
//     --print-to-pdf=brief.pdf --no-pdf-header-footer --virtual-time-budget=30000 \
//     http://localhost:3000/corridors/sriperumbudur/brief
// The generated PDF is committed at
// public/data/corridors/sriperumbudur/sriperumbudur-corridor-brief.pdf and
// linked from the main corridor page. Not a search surface.

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ corridorId: string }>;
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

export default async function CorridorBriefPage({ params }: PageProps) {
  const { corridorId } = await params;
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
    />
  );
}
