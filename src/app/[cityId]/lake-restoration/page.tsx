import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import {
  LakeRestorationContent,
  type LostFile,
  type FlagshipFile,
  type ProjectsFile,
  type RestorationPriorityFile,
} from "./lake-restoration-content";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Lake Restoration | Neer Vazhvu" };
  return {
    title: `${config.displayName} Lake Restoration | Neer Vazhvu`,
    description: `Lost tanks, flagship water bodies, and restoration programmes for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/lake-restoration` },
  };
}

async function loadJson<T>(filename: string): Promise<T | null> {
  try {
    const text = await fs.readFile(path.join(process.cwd(), "public", "data", filename), "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default async function CityLakeRestorationPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const [lostFile, flagshipFile, projectsFile, priorityFile] = await Promise.all([
    loadJson<LostFile>(`water-bodies-lost-${cityId}.json`),
    loadJson<FlagshipFile>(`water-bodies-flagship-${cityId}.json`),
    loadJson<ProjectsFile>(`restoration-projects-${cityId}.json`),
    loadJson<RestorationPriorityFile>(`restoration-priority-${cityId}.json`),
  ]);

  // Gate on what the page NEEDS to say something: a flagship register and the
  // active programmes. The lost/vanished register is genuinely optional - it is
  // historical, city-specific research that several cities will never have -
  // and requiring it stubbed out cities that had everything else. Its cards
  // self-hide when the file is absent.
  if (!flagshipFile || !projectsFile) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Lake Restoration"
        scope="district-admin"
        parityVerdict="MEDIUM"
        whatItShowsForChennai="restoration priority scoring across 1,700+ water bodies + lost-tank inventory + active programme tracking"
        dataGapNote="No curated lake-restoration data files for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/water-bodies`, label: "Water bodies map" },
        ]}
      />
    );
  }

  return (
    <LakeRestorationContent
      cityId={cityId}
      cityDisplayName={config.displayName}
      lostFile={lostFile}
      flagshipFile={flagshipFile}
      projectsFile={projectsFile}
      priorityFile={priorityFile}
    />
  );
}
