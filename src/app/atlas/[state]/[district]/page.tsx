import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AtlasBreadcrumbs } from "@/components/atlas/atlas-breadcrumbs";
import {
  AtlasDirectoryExplorer,
  type DirectoryRow,
} from "@/components/atlas/atlas-directory-explorer";
import { AtlasDistrictMap, type AtlasMapPoint } from "@/components/atlas/atlas-map";
import { AtlasMixBar } from "@/components/atlas/atlas-mix-bar";
import {
  AtlasCard,
  AtlasContainer,
  AtlasFinding,
  AtlasGap,
  AtlasNote,
  AtlasSection,
  AtlasTableScroll,
  StatTile,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
  ToneBadge,
} from "@/components/atlas/atlas-primitives";
import { getCuratedBriefs } from "@/lib/atlas/curated-briefs";
import { getDistrictDirectory } from "@/lib/atlas/district-directory";
import { displayTalukName, getDistrictReading } from "@/lib/atlas/district-reading";
import {
  blockHref,
  districtHref,
  findAtlasDistrict,
  isAtlasDistrictVisible,
  listVisibleAtlasDistricts,
} from "@/lib/atlas/registry";

interface RouteParams {
  params: Promise<{ state: string; district: string }>;
}

const num = (value: number): string => Math.round(value).toLocaleString("en-IN");
const pct = (value: number | null): string => (value === null ? "not stated" : `${value.toFixed(1)}%`);
const categoryLabel = (value: string | null): string => (value ? value.replace(/_/g, "-") : "not projected");

/** Preview districts build on a preview deployment; production leaves them
 *  unlisted and the layout guard 404s them. One function feeds both. */
export function generateStaticParams() {
  return listVisibleAtlasDistricts().map((d) => ({ state: d.stateSlug, district: d.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { state, district: districtSlug } = await params;
  const entry = findAtlasDistrict(state, districtSlug);
  if (!entry || !isAtlasDistrictVisible(entry)) return {};
  const reading = getDistrictReading(state, districtSlug);
  return {
    title: `${entry.name} district water | Neer Vazhvu Atlas`,
    description: reading?.verdict.sentence,
    alternates: { canonical: districtHref(entry) },
  };
}

export default async function AtlasDistrictPage({ params }: RouteParams) {
  const { state, district: districtSlug } = await params;
  const entry = findAtlasDistrict(state, districtSlug);
  if (!entry || !isAtlasDistrictVisible(entry)) notFound();
  const directory = getDistrictDirectory(state, districtSlug);
  const reading = getDistrictReading(state, districtSlug);
  if (!directory || !reading) notFound();

  const basePath = districtHref(entry);
  const basinHref = entry.basin
    ? `/embed/basins/${entry.basin.basinId}?sub=${entry.basin.subBasinKey}`
    : null;
  const reviewed = new Set(getCuratedBriefs(entry.slug).map((brief) => brief.lgdCode));

  const rows: DirectoryRow[] = directory.panchayats.map((place) => ({
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
  const blocks = directory.blocks.map((block) => ({
    code: block.code,
    name: block.name,
    count: block.panchayatCount,
  }));
  const points: AtlasMapPoint[] = directory.panchayats
    .filter((place) => place.latitude !== undefined && place.longitude !== undefined)
    .map((place) => ({
      id: place.lgdCode,
      name: place.name,
      blockName: place.blockName,
      latitude: place.latitude!,
      longitude: place.longitude!,
    }));

  const { verdict, facts, irrigation, drinking, mettur, groundwater, blockFindings } = reading;

  return (
    <div className="bg-white dark:bg-slate-950">
      <AtlasContainer className="pt-4 sm:pt-6">
        <AtlasBreadcrumbs
          items={[
            { label: "India", href: "/" },
            { label: entry.stateName },
            { label: entry.name },
          ]}
        />
      </AtlasContainer>

      {/* Hero: the verdict, not the directory. */}
      <header className="border-b border-slate-200 dark:border-slate-800">
        <AtlasContainer className="py-8 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            District
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
            {entry.stateName}
            {entry.basin && basinHref ? (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
                <Link href={basinHref} className="text-cyan-700 dark:text-cyan-400 hover:underline">
                  {entry.basin.subBasinName} sub-basin
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {reading.districtName} district
          </h1>
          <div className="mt-5 max-w-3xl">
            <ToneBadge tone={verdict.tone} />
            <p className="mt-3 text-lg sm:text-xl leading-relaxed text-slate-800 dark:text-slate-200">
              {verdict.sentence}
            </p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Read as of {reading.asOf}, from {reading.panchayatCount} Gram Panchayats in{" "}
              {reading.blockCount} blocks, {reading.briefReady} of them with a brief that cleared
              the evidence floor.
            </p>
          </div>

          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {facts.map((fact, index) => (
              <StatTile
                key={fact.label}
                value={fact.value}
                label={fact.label}
                asOf={fact.asOf}
                note={fact.note}
                primary={index === 0}
              />
            ))}
          </dl>

          {verdict.nextSteps.length > 0 ? (
            <div className="mt-8 max-w-3xl">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                What would sharpen this reading
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {verdict.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </AtlasContainer>
      </header>

      <main>
        <AtlasContainer className="divide-y divide-slate-200 dark:divide-slate-800">
          <AtlasSection
            id="runs-on"
            title="What the district runs on"
            intro={
              <>
                Irrigation from the Census village tables ({irrigation.describes}), drinking water from
                the sources JJM records today. A Panchayat without a measure lowers that measure&rsquo;s
                denominator rather than counting as a zero.
              </>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <AtlasCard>
                <AtlasMixBar
                  title={`Irrigated farmland by source, ${num(irrigation.irrigatedHectares)} ha`}
                  shares={irrigation.shares.map((share) => ({
                    key: share.key,
                    label: share.label,
                    percent: share.percent,
                    detail: `${num(share.value)} ha`,
                  }))}
                  caption={`Census 2011 village tables, covering ${irrigation.places} of ${reading.panchayatCount} Panchayats with a land record. A historical baseline, not current cropping.`}
                />
              </AtlasCard>
              <AtlasCard>
                <AtlasMixBar
                  title={`Drinking-water sources by category, ${num(drinking.total)} sources`}
                  shares={drinking.shares.map((share) => ({
                    key: share.key,
                    label: share.label,
                    percent: share.percent,
                    detail: num(share.value),
                  }))}
                  caption={`${drinking.describes}. Commonest source types: ${drinking.topTypes
                    .map((type) => `${type.label} (${num(type.value)})`)
                    .join(", ")}.`}
                />
                <AtlasFinding className="mt-4">{drinking.sentence}</AtlasFinding>
              </AtlasCard>
            </div>
            {mettur ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
                <AtlasCard>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">The Mettur dependence</h3>
                  <AtlasFinding className="mt-2">{mettur.sentence}</AtlasFinding>
                </AtlasCard>
                <AtlasGap title="Live Mettur storage">{mettur.gap}</AtlasGap>
              </div>
            ) : null}
          </AtlasSection>

          <AtlasSection
            id="groundwater"
            title="Groundwater by taluk"
            intro="IN-GRES assesses revenue taluks, not blocks or Panchayats. These are the units the district is actually assessed in, and the headroom reading is written from them."
          >
            <AtlasFinding>{groundwater.finding}</AtlasFinding>
            {groundwater.taluks.length > 0 ? (
              <div className="mt-4">
                <AtlasTableScroll label="Groundwater assessment by taluk">
                  <table className={TABLE}>
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>Taluk</th>
                        <th className={TH}>Stage of extraction</th>
                        <th className={TH}>Category</th>
                        <th className={TH}>Rainfall recharge (ham)</th>
                        <th className={TH}>Total availability (ham)</th>
                        <th className={TH}>Left for future use (ham)</th>
                        <th className={TH}>Rainfall (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groundwater.taluks.map((taluk) => (
                        <tr key={taluk.name} className={TR}>
                          <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>
                            {displayTalukName(taluk.name)}
                          </td>
                          <td className={TD}>{taluk.stageOfExtractionPercent.toFixed(1)}%</td>
                          <td className={TD}>{categoryLabel(taluk.category)}</td>
                          <td className={TD}>{num(taluk.annualRechargeHam)}</td>
                          <td className={TD}>
                            {taluk.totalAvailabilityHam === null ? "not stated" : num(taluk.totalAvailabilityHam)}
                          </td>
                          <td className={TD}>{num(taluk.availabilityForFutureUseHam)}</td>
                          <td className={TD}>{Math.round(taluk.rainfallMm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AtlasTableScroll>
                <AtlasNote>
                  IN-GRES {groundwater.assessmentYear}. The stage of extraction is annual draft as a share of
                  total availability; above 100 percent, more is drawn each year than the taluk is assessed
                  to have. Rainfall recharge is one component of that availability. The year is the
                  hydrological-year label, not an edition date.
                  {groundwater.projection
                    ? ` ${groundwater.projection.projected} of ${groundwater.projection.gramPanchayats} Panchayats inherit their containing taluk's category by ${groundwater.projection.method.replace(/-/g, " ")}, as containing-area context rather than a measurement of the place; ${groundwater.projection.deferred} ${groundwater.projection.deferred === 1 ? "is" : "are"} deferred rather than guessed.`
                    : ""}
                </AtlasNote>
              </div>
            ) : null}
          </AtlasSection>

          <AtlasSection
            id="blocks"
            title="Blocks compared"
            intro="The same measures per block. Where a district average hides a gradient, this is where it shows, and the findings are written before the table rather than left for the reader to find."
          >
            <div className="space-y-3">
              <AtlasFinding>{blockFindings.gradient}</AtlasFinding>
              <AtlasFinding>{blockFindings.tapGap}</AtlasFinding>
              {blockFindings.artifact ? (
                <AtlasFinding className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3">
                  {blockFindings.artifact}
                </AtlasFinding>
              ) : null}
            </div>
            <div className="mt-5">
              <AtlasTableScroll label="Blocks compared">
                <table className={`${TABLE} min-w-[64rem]`}>
                  <thead className={THEAD}>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className={TH} colSpan={2} />
                      <th className={TH} colSpan={1}>
                        Drinking water, JJM
                      </th>
                      <th className={TH} colSpan={4}>
                        Farmland irrigation, Census 2011
                      </th>
                      <th className={TH} colSpan={1}>
                        Groundwater, IN-GRES
                      </th>
                      <th className={TH} colSpan={1}>
                        Water bodies, TNGIS
                      </th>
                      <th className={TH} colSpan={2}>
                        Water-quality testing, JJM
                      </th>
                    </tr>
                    <tr>
                      <th className={TH}>Block</th>
                      <th className={TH}>Panchayats</th>
                      <th className={TH}>Households with a tap</th>
                      <th className={TH}>Irrigated area</th>
                      <th className={TH}>from canals</th>
                      <th className={TH}>from wells</th>
                      <th className={TH}>from tanks</th>
                      <th className={TH}>Taluk category, projected</th>
                      <th className={TH}>Mapped</th>
                      <th className={TH}>Untested 90+ d</th>
                      <th className={TH}>Longest since tested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reading.blocks.map((block) => (
                      <tr key={block.code} className={TR}>
                        <td className={`${TD} whitespace-nowrap`}>
                          <Link
                            href={blockHref(entry, block.code)}
                            className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                          >
                            {block.name}
                          </Link>
                        </td>
                        <td className={TD}>{block.panchayatCount}</td>
                        <td className={TD}>{pct(block.tapPercent)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{num(block.irrigatedHectares)} ha</td>
                        <td className={TD}>{pct(block.canalPercent)}</td>
                        <td className={TD}>{pct(block.wellPercent)}</td>
                        <td className={TD}>{pct(block.tankPercent)}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {categoryLabel(block.dominantCategory)}
                          {block.projectedPlaces > 0 ? (
                            <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                              ({block.projectedPlaces} of {block.panchayatCount})
                            </span>
                          ) : null}
                        </td>
                        <td className={TD}>{num(block.waterBodyCount)}</td>
                        <td className={TD}>{block.stalePlaces}</td>
                        <td className={TD}>
                          {block.worstSampleAgeDays === null ? "not stated" : `${num(block.worstSampleAgeDays)} d`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AtlasTableScroll>
              <AtlasNote>
                Canal, well and tank figures are shares of the irrigated farmland beside them, not of
                households and not of drinking water. They come from Census 2011 ({irrigation.describes})
                and cover only the {irrigation.places}{" "}Panchayats with a Census land record, so a block
                with few such records shows a share of a small area. Tap and testing figures are JJM and
                current at the read date. The taluk category is the one most of the block&rsquo;s
                Panchayats inherit by projection, since blocks and revenue taluks do not nest.
                Untested counts Panchayats whose most recent water-quality sample is more than 90 days
                before {reading.asOf}; ninety days is the Atlas&rsquo;s own threshold for calling a series
                stale, not a statutory testing interval.
              </AtlasNote>
            </div>
          </AtlasSection>

          <AtlasSection
            id="water-bodies"
            title="Water bodies"
            intro="The TNGIS all-water-bodies register, joined to each Panchayat by the register's own LGD code rather than by a name match."
          >
            {reading.waterBodies ? (
              <div className="max-w-xl">
                <AtlasCard>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {num(reading.waterBodies.count)}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    water bodies, {num(reading.waterBodies.areaHectares)} ha of mapped waterspread
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    In {reading.waterBodies.places} Panchayats; {reading.waterBodies.placesWithout} have
                    none in the register. Registered by {reading.waterBodies.departments.join(", ")}.
                    Waterspread is the mapped extent, not storage: it says nothing about whether these
                    hold water through the year or when any one of them was last surveyed. Read{" "}
                    {reading.waterBodies.retrieved}.
                  </p>
                </AtlasCard>
              </div>
            ) : (
              <AtlasGap title="No water-body register acquired">
                No TNGIS water-body shard exists for this district yet, so nothing is counted here.
              </AtlasGap>
            )}
          </AtlasSection>

          <AtlasSection
            id="environment-plan"
            title="District Environment Plan water balance"
            intro="Every district files an Environment Plan on the NGT template, with a water balance in it. When the plan for this district is found, its balance is read here."
          >
            <AtlasGap title="No District Environment Plan on file for this district">
              The NGT-template plan and its water balance have not been acquired for{" "}
              {reading.districtName}. This section stays a named gap rather than an estimate until it is.
            </AtlasGap>
          </AtlasSection>

          <AtlasSection
            id="find"
            title="Find a Gram Panchayat"
            intro={
              <>
                Every one of the {directory.panchayats.length} LGD-coded Gram Panchayats is listed. A
                place shows a water profile only where its evidence cleared the floor (identity,
                population and drinking-water service established); the rest are directory records,
                kept so they can be found and reviewed.
              </>
            }
          >
            <AtlasDirectoryExplorer rows={rows} blocks={blocks} basePath={basePath} />
          </AtlasSection>

          <AtlasSection
            id="map"
            title="The district on a map"
            intro="Every Panchayat with a mapped boundary is plotted from the centre of its own TNGIS polygon, not from a hand-entered coordinate. The marker is the Panchayat, not a settlement."
          >
            <AtlasDistrictMap points={points} />
            <AtlasNote>
              {points.length} of {directory.panchayats.length} Panchayats have a mapped boundary. The
              polygons themselves are withheld pending the TNGIS licence reply.
            </AtlasNote>
          </AtlasSection>

          <AtlasSection
            id="vintages"
            title="How current these figures are"
            intro="Not everything on this page is from the same year, and the gap is large. What each figure describes is listed separately from when the Atlas last read it, straight from each artifact's own record."
          >
            <AtlasTableScroll label="Figure vintages">
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Figures</th>
                    <th className={TH}>Describes</th>
                    <th className={TH}>Last read</th>
                    <th className={TH}>Produced</th>
                    <th className={TH}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {reading.vintages.map((row) => (
                    <tr key={row.label} className={TR}>
                      <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{row.label}</td>
                      <td className={TD}>
                        {row.historical ? (
                          <span className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-px text-xs font-medium text-amber-800 dark:text-amber-300">
                            {row.describes}
                          </span>
                        ) : (
                          row.describes
                        )}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{row.retrieved}</td>
                      <td className={`${TD} whitespace-nowrap`}>{row.produced}</td>
                      <td className={`${TD} min-w-[16rem] text-xs leading-relaxed`}>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AtlasTableScroll>
            <AtlasNote>
              The land, irrigation and seasonal-source figures are the oldest thing here by a wide
              margin. India&rsquo;s 2021 census did not take place, so Census 2011 remains the most
              recent village-level enumeration and there is no newer source of the same granularity to
              replace it with. Those figures are kept under capabilities named historical, and the
              current-crop capability is left empty rather than answered with a 2009 number.
            </AtlasNote>
          </AtlasSection>
        </AtlasContainer>
      </main>
    </div>
  );
}
