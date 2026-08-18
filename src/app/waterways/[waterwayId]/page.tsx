import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetWaterwayManifest } from "@/lib/waterways";
import type {
  WaterwayChapter,
  WaterwayToday,
  WaterwayClaim,
  WaterwayIdentity,
  WaterwayReach,
  WaterwayTimelineEntry,
} from "@/lib/waterways/types";
import { WaterwayContent } from "./waterway-content";

// Waterway page type (docs/waterways/buckingham-canal/DECISIONS.md).
// Not a city route: keyed on the waterway registry (src/lib/waterways/),
// and the site Header/Footer suppress themselves on /waterways so the page
// carries its own chrome. Static data only, emitted by
// scripts/build_waterway_<id>.py and gated by its verify script.

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ waterwayId: string }>;
}

function loadJson<T>(waterwayId: string, name: string): T | null {
  const fp = path.join(
    process.cwd(), "public", "data", "waterways", waterwayId, name,
  );
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { waterwayId } = await params;
  const manifest = tryGetWaterwayManifest(waterwayId);
  if (!manifest) return { title: "Waterway | Neer Vazhvu" };
  return {
    title: `${manifest.displayName} | Neer Vazhvu`,
    description: manifest.description,
  };
}

export default async function WaterwayPage({ params }: PageProps) {
  const { waterwayId } = await params;
  const manifest = tryGetWaterwayManifest(waterwayId);
  if (!manifest) notFound();

  const reachesFile = loadJson<{
    identity: WaterwayIdentity;
    reaches: WaterwayReach[];
  }>(waterwayId, "reaches.json");
  const chaptersFile = loadJson<{ chapters: WaterwayChapter[] }>(
    waterwayId, "chapters.json");
  const timelineFile = loadJson<{ timeline: WaterwayTimelineEntry[] }>(
    waterwayId, "timeline.json");
  const claimsFile = loadJson<{ claims: WaterwayClaim[] }>(
    waterwayId, "claims.json");
  const todayFile = loadJson<{ today: WaterwayToday }>(
    waterwayId, "today.json");

  // A waterway without its measured reaches has nothing honest to show.
  if (!reachesFile || !chaptersFile || !timelineFile || !claimsFile || !todayFile) notFound();

  return (
    <WaterwayContent
      manifest={manifest}
      identity={reachesFile.identity}
      reaches={reachesFile.reaches}
      chapters={chaptersFile.chapters}
      timeline={timelineFile.timeline}
      claims={claimsFile.claims}
      today={todayFile.today}
    />
  );
}
