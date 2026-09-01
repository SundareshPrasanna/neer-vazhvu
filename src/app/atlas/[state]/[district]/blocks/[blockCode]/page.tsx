import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AtlasBreadcrumbs } from "@/components/atlas/atlas-breadcrumbs";
import {
  AtlasDirectoryExplorer,
  type DirectoryRow,
} from "@/components/atlas/atlas-directory-explorer";
import {
  AtlasContainer,
  AtlasNote,
  AtlasSection,
  StatTile,
} from "@/components/atlas/atlas-primitives";
import { getCuratedBriefs } from "@/lib/atlas/curated-briefs";
import { getDistrictDirectory } from "@/lib/atlas/district-directory";
import { getDistrictReading } from "@/lib/atlas/district-reading";
import {
  blockHref,
  districtHref,
  findAtlasDistrict,
  isAtlasDistrictVisible,
  listVisibleAtlasDistricts,
} from "@/lib/atlas/registry";

interface RouteParams {
  params: Promise<{ state: string; district: string; blockCode: string }>;
}

const num = (value: number): string => Math.round(value).toLocaleString("en-IN");
const pct = (value: number | null): string => (value === null ? "not stated" : `${value.toFixed(1)}%`);

export function generateStaticParams() {
  return listVisibleAtlasDistricts().flatMap((district) => {
    const directory = getDistrictDirectory(district.stateSlug, district.slug);
    return (directory?.blocks ?? []).map((block) => ({
      state: district.stateSlug,
      district: district.slug,
      blockCode: block.code,
    }));
  });
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { state, district: districtSlug, blockCode } = await params;
  const entry = findAtlasDistrict(state, districtSlug);
  if (!entry || !isAtlasDistrictVisible(entry)) return {};
  const directory = getDistrictDirectory(state, districtSlug);
  const block = directory?.blocks.find((item) => item.code === blockCode);
  if (!directory || !block) return {};
  return {
    title: `${block.name} block, ${directory.districtName} | Neer Vazhvu Atlas`,
    description: `${block.panchayatCount} Gram Panchayats in ${block.name} block, ${directory.districtName} district, with the block's taps, irrigation sources and taluk groundwater category.`,
    alternates: { canonical: blockHref(entry, blockCode) },
  };
}

export default async function AtlasBlockPage({ params }: RouteParams) {
  const { state, district: districtSlug, blockCode } = await params;
  const entry = findAtlasDistrict(state, districtSlug);
  if (!entry || !isAtlasDistrictVisible(entry)) notFound();
  const directory = getDistrictDirectory(state, districtSlug);
  const block = directory?.blocks.find((item) => item.code === blockCode);
  if (!directory || !block) notFound();

  const reading = getDistrictReading(state, districtSlug);
  const figures = reading?.blocks.find((item) => item.code === blockCode);
  const reviewed = new Set(getCuratedBriefs(entry.slug).map((brief) => brief.lgdCode));
  const rows: DirectoryRow[] = block.panchayats.map((place) => ({
    lgdCode: place.lgdCode,
    name: place.name,
    blockCode: place.blockCode,
    blockName: place.blockName,
    status: reviewed.has(place.lgdCode)
      ? "reviewed"
      : place.coverage === "water-profile"
        ? "profile"
        : "directory",
  }));
  const reviewedHere = rows.filter((row) => row.status === "reviewed").length;
  const basePath = districtHref(entry);

  return (
    <div className="bg-white dark:bg-slate-950">
      <AtlasContainer className="pt-4 sm:pt-6">
        <AtlasBreadcrumbs
          items={[
            { label: "India", href: "/" },
            { label: entry.stateName },
            { label: directory.districtName, href: basePath },
            { label: block.name },
          ]}
        />
      </AtlasContainer>

      <header className="border-b border-slate-200 dark:border-slate-800">
        <AtlasContainer className="py-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Block
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
            {directory.districtName} district
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {block.name} block
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {block.panchayatCount} Gram Panchayats, {block.waterProfileCount} of them with a water
            profile{reviewedHere > 0 ? `, ${reviewedHere} reviewed by a person` : ""}. Figures below are the
            block&rsquo;s share of the district roll-up
            {reading ? `, read as of ${reading.asOf}` : ""}.
          </p>

          {figures ? (
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                value={pct(figures.tapPercent)}
                label="of households recorded with a tap"
                note={`${num(figures.connections)} connections against ${num(figures.households)} households. ${figures.tapPercent === 100 ? "Exactly 100.0% is read as reported complete, not measured." : ""}`.trim()}
                primary
              />
              <StatTile
                value={pct(figures.canalPercent)}
                label="of irrigated farmland from canals"
                asOf="Census 2011"
                note={`${num(figures.irrigatedHectares)} ha irrigated across ${figures.landPlaces} Panchayats with a land record; wells ${pct(figures.wellPercent)}, tanks ${pct(figures.tankPercent)}.`}
              />
              <StatTile
                value={figures.dominantCategory ? figures.dominantCategory.replace(/_/g, "-") : "not projected"}
                label="taluk groundwater category"
                flag="taluk projection"
                asOf={reading?.groundwater.assessmentYear ? `IN-GRES ${reading.groundwater.assessmentYear}` : undefined}
                note={`The category most of the block's Panchayats inherit from their containing revenue taluk (${figures.projectedPlaces} of ${figures.panchayatCount} projected). Containing-area context, not a measurement of the block.`}
              />
              <StatTile
                value={num(figures.waterBodyCount)}
                label="water bodies in the TNGIS register"
                note={`${num(figures.waterBodyAreaHectares)} ha of mapped waterspread. ${figures.stalePlaces} Panchayats untested for 90+ days; longest gap ${figures.worstSampleAgeDays === null ? "not stated" : `${num(figures.worstSampleAgeDays)} days`}.`}
              />
            </dl>
          ) : null}
        </AtlasContainer>
      </header>

      <main>
        <AtlasContainer>
          <AtlasSection
            id="panchayats"
            title={`Gram Panchayats in ${block.name}`}
            intro="Every LGD-coded Panchayat in the block, with the status of its brief. A directory record is a place the evidence does not yet identify well enough to publish a profile for."
          >
            <AtlasDirectoryExplorer
              rows={rows}
              blocks={[{ code: block.code, name: block.name, count: block.panchayatCount }]}
              basePath={basePath}
              fixedBlockCode={block.code}
              pageSize={60}
            />
            <AtlasNote>
              <Link href={basePath} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                Back to {directory.districtName} district
              </Link>
              , where the blocks are compared side by side.
            </AtlasNote>
          </AtlasSection>
        </AtlasContainer>
      </main>
    </div>
  );
}
