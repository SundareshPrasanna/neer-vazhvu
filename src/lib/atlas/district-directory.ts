import { loadBriefs, loadDirectory } from "./data";
import type { BoundaryProvenance, DistrictDirectoryArtifact, IdentityAdapter } from "./artifacts";
import {
  boundaryProvenance,
  identityAdapterOf,
  identityDistrictCode,
  identityMasterVintage,
  identityVintage,
} from "./artifacts";
import type { PlaceBrief } from "./place-brief";
import { findAtlasDistrict, listAtlasDistricts, type AtlasDistrict } from "./registry";
import { validateDirectoryPayload } from "./tn-district-refresh";

export type DirectoryCoverage = "directory-only" | "water-profile";

export interface PanchayatDirectoryEntry {
  lgdCode: string;
  name: string;
  blockCode: string;
  blockName: string;
  coverage: DirectoryCoverage;
  /** From the mapped boundary, so every Panchayat can be plotted rather than
   * the handful that once had hand-entered coordinates. */
  latitude?: number;
  longitude?: number;
}

export interface BlockDirectoryEntry {
  code: string;
  name: string;
  panchayatCount: number;
  waterProfileCount: number;
  panchayats: PanchayatDirectoryEntry[];
}

export interface DistrictDirectory {
  slug: string;
  stateSlug: string;
  districtCode: string;
  districtName: string;
  stateName: string;
  identityAdapter: IdentityAdapter;
  lgdSourceAsOf: string;
  currentMasterAsOf: string;
  currentMasterCount: number;
  blocks: BlockDirectoryEntry[];
  panchayats: PanchayatDirectoryEntry[];
  waterProfileCount: number;
  /** Who drew the polygons behind the centroids, for the pages' copy. */
  boundary: BoundaryProvenance | null;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase("en-IN");
}

function displayName(value: string): string {
  return normalizedName(value).replace(/\b[a-z]/g, (letter) =>
    letter.toLocaleUpperCase("en-IN"),
  );
}

/** TNRD's LGD list shouts its names; the current master does not. */
export function directoryPlaceName(value: string): string {
  const trimmed = value.trim();
  return trimmed === trimmed.toLocaleUpperCase("en-IN")
    ? displayName(trimmed)
    : trimmed;
}

/**
 * Builds a district's public directory from its served artifacts.
 *
 * Coverage comes from the generated briefs rather than a hand-listed set of
 * profiled places: a Panchayat shows a water profile when its brief cleared
 * the evidence floor, and stays a directory entry when it did not. That keeps
 * the public surface and the fail-closed rule in step.
 */
export function buildDistrictDirectory(
  district: AtlasDistrict,
  artifact: DistrictDirectoryArtifact,
  briefs: PlaceBrief[],
): DistrictDirectory {
  const errors = validateDirectoryPayload(artifact);
  if (errors.length > 0) {
    throw new Error(
      `Invalid ${district.name} directory artifact:\n- ${errors.join("\n- ")}`,
    );
  }
  const briefReady = new Set(
    briefs.filter((brief) => brief.status === "brief-ready").map((brief) => brief.placeId),
  );

  const panchayats = artifact.panchayats.map((record) => {
    const entry: PanchayatDirectoryEntry = {
      lgdCode: record.lgdCode,
      name: directoryPlaceName(record.name),
      blockCode: record.blockCode,
      blockName: displayName(record.blockName),
      coverage: briefReady.has(record.lgdCode) ? "water-profile" : "directory-only",
    };
    if (record.boundary) {
      entry.longitude = record.boundary.centroid[0];
      entry.latitude = record.boundary.centroid[1];
    }
    return entry;
  });

  const blockMap = new Map<string, PanchayatDirectoryEntry[]>();
  for (const panchayat of panchayats) {
    const entries = blockMap.get(panchayat.blockCode) ?? [];
    entries.push(panchayat);
    blockMap.set(panchayat.blockCode, entries);
  }

  const collator = new Intl.Collator("en-IN", {
    numeric: true,
    sensitivity: "base",
  });
  panchayats.sort((a, b) => collator.compare(a.name, b.name));
  const blocks = [...blockMap.entries()]
    .map(([code, entries]) => {
      entries.sort((a, b) => collator.compare(a.name, b.name));
      return {
        code,
        name: entries[0].blockName,
        panchayatCount: entries.length,
        waterProfileCount: entries.filter(
          (entry) => entry.coverage === "water-profile",
        ).length,
        panchayats: entries,
      } satisfies BlockDirectoryEntry;
    })
    .sort((a, b) => collator.compare(a.name, b.name));

  return {
    slug: district.slug,
    stateSlug: district.stateSlug,
    districtCode: identityDistrictCode(artifact),
    districtName: artifact.district.name,
    stateName: district.stateName,
    identityAdapter: identityAdapterOf(artifact),
    lgdSourceAsOf: identityVintage(artifact).sourceAsOf,
    currentMasterAsOf: identityMasterVintage(artifact).sourceAsOf,
    currentMasterCount: identityMasterVintage(artifact).recordCount,
    boundary: boundaryProvenance(artifact),
    blocks,
    panchayats,
    waterProfileCount: panchayats.filter(
      (entry) => entry.coverage === "water-profile",
    ).length,
  };
}

/** The generated brief for one Panchayat, by LGD code. */
export function findBrief(briefs: PlaceBrief[], lgdCode: string): PlaceBrief | undefined {
  return briefs.find((brief) => brief.placeId === lgdCode);
}

const directoryCache = new Map<string, DistrictDirectory>();

export function getDistrictDirectory(
  stateSlug: string,
  districtSlug: string,
): DistrictDirectory | undefined {
  const district = findAtlasDistrict(stateSlug, districtSlug);
  if (!district) return undefined;
  const key = `${district.stateSlug}/${district.slug}`;
  const existing = directoryCache.get(key);
  if (existing) return existing;
  const artifact = loadDirectory(district);
  if (!artifact) return undefined;
  const built = buildDistrictDirectory(district, artifact, loadBriefs(district));
  directoryCache.set(key, built);
  return built;
}

function districtBySlug(districtSlug: string): AtlasDistrict | undefined {
  return listAtlasDistricts().find((district) => district.slug === districtSlug);
}

export function getDistrictBrief(
  districtSlug: string,
  lgdCode: string,
): PlaceBrief | undefined {
  const district = districtBySlug(districtSlug);
  if (!district) return undefined;
  return findBrief(loadBriefs(district), lgdCode);
}

/** Every brief for a district, for roll-ups that read the district as a whole. */
export function getDistrictBriefs(districtSlug: string): PlaceBrief[] {
  const district = districtBySlug(districtSlug);
  return district ? loadBriefs(district) : [];
}

/** Directories for every registered district whose artifacts are present. */
export function getAllDistrictDirectories(): DistrictDirectory[] {
  return listAtlasDistricts()
    .map((district) => getDistrictDirectory(district.stateSlug, district.slug))
    .filter((directory): directory is DistrictDirectory => directory !== undefined);
}

/** Drop the built directories. */
export function clearDistrictDirectoryCache(): void {
  directoryCache.clear();
}
