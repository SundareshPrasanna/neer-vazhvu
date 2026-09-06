import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AtlasBreadcrumbs } from "@/components/atlas/atlas-breadcrumbs";
import {
  AtlasDirectoryExplorer,
  AtlasQuickFind,
  type DirectoryRow,
} from "@/components/atlas/atlas-directory-explorer";
import { AtlasSectionNav, type AtlasNavSection } from "@/components/atlas/atlas-section-nav";
import { AtlasDistrictMap, type AtlasMapPoint } from "@/components/atlas/atlas-map";
import { AtlasMixBar } from "@/components/atlas/atlas-mix-bar";
import {
  AtlasCard,
  AtlasContainer,
  AtlasFinding,
  AtlasGap,
  AtlasNote,
  AtlasSection,
  StatTile,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
  ToneBadge,
} from "@/components/atlas/atlas-primitives";
import { AtlasSortableTable } from "@/components/atlas/sortable-table";
import { FloodStatement, ScarcityDistrictRead } from "@/components/atlas/scarcity-flood";
import { getCuratedBriefs } from "@/lib/atlas/curated-briefs";
import { loadStateFloodClassification, loadStateScarcityTankers } from "@/lib/atlas/data";
import {
  districtFloodReading,
  districtScarcityReading,
  floodVintageRow,
  scarcityVintageRow,
} from "@/lib/atlas/hazards";
import { getDistrictDirectory } from "@/lib/atlas/district-directory";
import { displayTalukName, getDistrictReading, type DistrictReading } from "@/lib/atlas/district-reading";
import {
  blockHref,
  districtHref,
  findAtlasDistrict,
  isAtlasDistrictVisible,
  listVisibleAtlasDistricts,
  stateHref,
} from "@/lib/atlas/registry";

interface RouteParams {
  params: Promise<{ state: string; district: string }>;
}

const num = (value: number): string => Math.round(value).toLocaleString("en-IN");
const pct = (value: number | null): string => (value === null ? "not stated" : `${value.toFixed(1)}%`);
const categoryLabel = (value: string | null): string => (value ? value.replace(/_/g, "-") : "not projected");

/** The census register's accounting, as one paragraph: what was assigned,
 *  what was counted without a Panchayat, what is drawn. */
function censusWaterBodyNote(waterBodies: NonNullable<DistrictReading["waterBodies"]>, unit: string): string {
  const parts = [`${num(waterBodies.placesWithout)} Panchayats have none in the return.`];
  if (waterBodies.unassigned) {
    const rural =
      waterBodies.unassigned.sharedVillage +
      waterBodies.unassigned.uncoveredVillage +
      waterBodies.unassigned.censusVillageWithoutLgdRow +
      waterBodies.unassigned.unknownVillage;
    parts.push(
      `${num(rural)} rural rows sit in villages the LGD lists under two Panchayats or under none and are counted on the ${unit} without being assigned` +
        (waterBodies.unassigned.urban > 0 ? `, and ${num(waterBodies.unassigned.urban)} are in towns.` : "."),
    );
  }
  parts.push(
    `${num(waterBodies.pointsServed)} carry a recorded coordinate and are drawn on the Panchayat pages` +
      (waterBodies.pointsOutsideDistrict > 0
        ? `; ${num(waterBodies.pointsOutsideDistrict)} fall outside the district and are not.`
        : "."),
  );
  parts.push(`Owned by ${waterBodies.departments.join(", ")}. Read ${waterBodies.retrieved}.`);
  return parts.join(" ");
}

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

  // The state-scoped hazard families: rendered only when the artifact for
  // this district's state exists and carries this district - the section,
  // its nav entry and its vintage rows all gate on the data, never on
  // configuration.
  const scarcityArtifact = loadStateScarcityTankers(entry.stateSlug);
  const floodArtifact = loadStateFloodClassification(entry.stateSlug);
  const scarcity = scarcityArtifact ? districtScarcityReading(scarcityArtifact, entry.name) : null;
  const flood = floodArtifact ? districtFloodReading(floodArtifact, { name: entry.name, slug: entry.slug }) : null;
  const vintages = [
    ...reading.vintages,
    ...(scarcity && scarcityArtifact ? [scarcityVintageRow(scarcityArtifact)] : []),
    ...(flood && floodArtifact ? [floodVintageRow(floodArtifact)] : []),
  ];

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
  // "taluk" in Tamil Nadu, "taluka" in Maharashtra: the assessment unit's own name.
  const unit = groundwater.unitLabel;
  const Unit = unit.charAt(0).toUpperCase() + unit.slice(1);
  // A real place from this district for the finder's placeholder.
  const example = (rows.find((row) => row.status === "reviewed") ?? rows.find((row) => row.status === "profile") ?? rows[0])?.name ?? "";
  // Families with nothing on file fold into one short section rather than
  // each holding a screen of its own between the reader and the directory.
  const gaps: Array<{ id: string; title: string; text: string }> = [];
  if (!reading.waterBodies) {
    gaps.push({
      id: "water-bodies",
      title: "Water bodies",
      text:
        directory.identityAdapter === "lgd-directory"
          ? `No water-body register is wired for ${directory.districtName} yet (the First Census of Water Bodies state return on data.gov.in is the candidate; MRSAC and Bhuvan the GIS leads), so nothing is counted.`
          : "No TNGIS water-body shard exists for this district yet, so nothing is counted.",
    });
  }
  if (!reading.environmentPlan) {
    gaps.push({
      id: "environment-plan",
      title: "District Environment Plan",
      text: `Every district files one on the NGT template, with a water balance in it; the plan for ${reading.districtName} has not been acquired, and this stays a named gap rather than an estimate until it is.`,
    });
  }
  if (!reading.pollutedStretches) {
    gaps.push({
      id: "polluted-stretches",
      title: "CPCB polluted river stretches",
      text: "CPCB's polluted river stretch list is served per district from one national reviewed input; this district's slice has not been produced yet.",
    });
  }
  const sections: AtlasNavSection[] = [
    { id: "runs-on", label: "What it runs on" },
    { id: "groundwater", label: `Groundwater by ${unit}` },
    { id: "blocks", label: "Blocks compared" },
    ...(flood || scarcity ? [{ id: "hazards", label: "Floods and scarcity" }] : []),
    ...(reading.waterBodies ? [{ id: "water-bodies", label: "Water bodies" }] : []),
    ...(reading.environmentPlan ? [{ id: "environment-plan", label: "Environment Plan" }] : []),
    ...(reading.pollutedStretches ? [{ id: "polluted-stretches", label: "Polluted stretches" }] : []),
    ...(gaps.length > 0 ? [{ id: "not-on-file", label: "Not yet on file" }] : []),
    { id: "find", label: "Find a Panchayat" },
    { id: "map", label: "Map" },
    { id: "vintages", label: "How current" },
  ];

  return (
    <div className="bg-white dark:bg-slate-950">
      <AtlasContainer className="pt-4 sm:pt-6">
        <AtlasBreadcrumbs
          items={[
            { label: "India", href: "/" },
            { label: entry.stateName, href: stateHref(entry.stateSlug) },
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
          <div className="mt-5">
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

          <div className="mt-8">
            <AtlasQuickFind rows={rows} basePath={basePath} example={example} />
          </div>
        </AtlasContainer>
      </header>

      <AtlasSectionNav sections={sections} label="Sections of this page" heading="On this page" />

      <main>
        <AtlasContainer className="divide-y divide-slate-200 dark:divide-slate-800">
          <AtlasSection
            id="runs-on"
            title="What the district runs on"
            intro={
              reading.irrigationCurrent ? (
                <>
                  Irrigation from the district tables of the {reading.irrigationCurrent.label},
                  with the Census 2011 village pattern beneath it as the block-level baseline;
                  drinking water from the sources JJM records today. A Panchayat without a measure lowers that
                  measure&rsquo;s denominator rather than counting as a zero.
                </>
              ) : (
                <>
                  Irrigation from the Census village tables ({irrigation.describes}), drinking water from
                  the sources JJM records today. A Panchayat without a measure lowers that measure&rsquo;s
                  denominator rather than counting as a zero.
                </>
              )
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <AtlasCard>
                {reading.irrigationCurrent ? (
                  <div className="space-y-6">
                    <AtlasMixBar
                      title={`Irrigated farmland by source, ${num(reading.irrigationCurrent.netHectares)} ha net (${reading.irrigationCurrent.label})`}
                      shares={reading.irrigationCurrent.shares.map((share) => ({
                        key: share.key,
                        label: share.label,
                        percent: share.percent,
                        detail: `${num(share.value)} ha`,
                      }))}
                      caption={`${reading.irrigationCurrent.label}, Table III-B, the district total: gross ${num(reading.irrigationCurrent.grossHectares)} ha with ${num(reading.irrigationCurrent.moreThanOnceHectares)} ha irrigated more than once (intensity ${reading.irrigationCurrent.intensity}).${reading.irrigationCurrent.supplementaryWellsNote ? ` ${reading.irrigationCurrent.supplementaryWellsNote}` : ""}`}
                    />
                    <AtlasMixBar
                      title={`The block-level baseline: Census 2011, ${num(irrigation.irrigatedHectares)} ha`}
                      shares={irrigation.shares.map((share) => ({
                        key: share.key,
                        label: share.label,
                        percent: share.percent,
                        detail: `${num(share.value)} ha`,
                      }))}
                      caption={`Census 2011 village tables, covering ${irrigation.places} of ${reading.panchayatCount} Panchayats with a land record. Kept beneath the current reading because it is the only served source with a block gradient.`}
                    />
                  </div>
                ) : (
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
                )}
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
            title={`Groundwater by ${unit}`}
            intro={`IN-GRES assesses revenue ${unit}s, not blocks or Panchayats. These are the units the district is actually assessed in, and the headroom reading is written from them.`}
          >
            <AtlasFinding>{groundwater.finding}</AtlasFinding>
            {groundwater.taluks.length > 0 ? (
              <div className="mt-4">
                <AtlasSortableTable label={`Groundwater assessment by ${unit}`}>
                  <table className={TABLE}>
                    <thead className={THEAD}>
                      <tr>
                        <th className={TH}>{Unit}</th>
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
                </AtlasSortableTable>
                <AtlasNote>
                  IN-GRES {groundwater.assessmentYear}. The stage of extraction is annual draft as a share of
                  total availability; above 100 percent, more is drawn each year than the {unit} is assessed
                  to have. Rainfall recharge is one component of that availability. The year is the
                  hydrological-year label, not an edition date.
                  {groundwater.projection
                    ? ` ${groundwater.projection.projected} of ${groundwater.projection.gramPanchayats} Panchayats inherit their containing ${unit}'s category by ${groundwater.projection.method.replace(/-/g, " ")}, as containing-area context rather than a measurement of the place; ${groundwater.projection.deferred} ${groundwater.projection.deferred === 1 ? "is" : "are"} deferred rather than guessed.`
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
              <AtlasSortableTable label="Blocks compared">
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
                        {reading.waterBodies
                          ? `Water bodies, ${reading.waterBodies.register === "tngis" ? "TNGIS" : "Census"}`
                          : "Water bodies"}
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
                      <th className={TH}>{Unit} category, projected</th>
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
              </AtlasSortableTable>
              <AtlasNote>
                Canal, well and tank figures are shares of the irrigated farmland beside them, not of
                households and not of drinking water. They come from Census 2011 ({irrigation.describes})
                and cover only the {irrigation.places}{" "}Panchayats with a Census land record, so a block
                with few such records shows a share of a small area. Tap and testing figures are JJM and
                current at the read date. The {unit} category is the one most of the block&rsquo;s
                Panchayats inherit by projection{groundwater.projection?.method === "administrative-membership" ? `, which here is the ${unit} the register places them in` : `, since blocks and revenue ${unit}s do not nest`}.
                Untested counts Panchayats whose most recent water-quality sample is more than 90 days
                before {reading.asOf}; ninety days is the Atlas&rsquo;s own threshold for calling a series
                stale, not a statutory testing interval.
              </AtlasNote>
            </div>
          </AtlasSection>

          {flood || scarcity ? (
            <AtlasSection
              id="hazards"
              title="Floods and scarcity"
              intro="Two readings the directory families cannot carry: what the state's own disaster plan says about flood exposure here, and - where the state publishes one - the week's tanker register. Both are the state's documents, quoted and dated, not the Atlas's assessment."
            >
              <div className="space-y-8">
                {scarcity ? <ScarcityDistrictRead reading={scarcity} /> : null}
                {flood ? <FloodStatement reading={flood} /> : null}
              </div>
            </AtlasSection>
          ) : null}

          {reading.waterBodies ? (
            <AtlasSection
              id="water-bodies"
              title="Water bodies"
              intro={
                reading.waterBodies.register === "water-bodies-census"
                  ? "The First Census of Water Bodies (Ministry of Jal Shakti, reference years 2017-18 to 2020-21), which locates each water body in a Census village; the LGD's own village list names the Panchayat, so the join is a code match, not a name match."
                  : "The TNGIS all-water-bodies register, joined to each Panchayat by the register's own LGD code rather than by a name match."
              }
            >
              {reading.waterBodies.register === "water-bodies-census" ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                    <AtlasCard>
                      <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {num(reading.waterBodies.count)}
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                        water bodies on the census return, in {num(reading.waterBodies.places)} Panchayats
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {censusWaterBodyNote(reading.waterBodies, unit)}
                      </p>
                    </AtlasCard>
                    <div>
                      <AtlasSortableTable label="Water bodies by census class">
                        <table className={`${TABLE} min-w-[18rem]`}>
                          <thead className={THEAD}>
                            <tr>
                              <th className={TH}>Census class</th>
                              <th className={TH}>Water bodies</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reading.waterBodies.byType.map((row) => (
                              <tr key={row.type} className={TR}>
                                <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{row.type}</td>
                                <td className={TD}>{num(row.count)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AtlasSortableTable>
                      {reading.waterBodies.attributeNote ? (
                        <AtlasNote>
                          {reading.waterBodies.areaBasis === "withheld" ? "Waterspread is not published. " : ""}
                          {reading.waterBodies.attributeNote}
                        </AtlasNote>
                      ) : null}
                    </div>
                  </div>
                ) : (
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
                )}
            </AtlasSection>
          ) : null}

          {reading.environmentPlan ? (
            <AtlasSection
              id="environment-plan"
              title="District Environment Plan"
              intro={`${reading.environmentPlan.document.publisher} prepared the plan on the CPCB model under the NGT's 2019 order. What it states about water is transcribed below, each figure with the page it sits on; nothing here is computed from it.`}
            >
              {reading.environmentPlan ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                    <AtlasCard>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {reading.environmentPlan.document.title}, {reading.environmentPlan.document.editionLabel}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Dated {reading.environmentPlan.document.documentDate}, {reading.environmentPlan.document.pages} pages.{" "}
                        <a
                          href={reading.environmentPlan.document.url}
                          className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Read the plan at MPCB (PDF)
                        </a>
                        . {reading.environmentPlan.document.editionNote}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {reading.environmentPlan.review.status === "verified"
                          ? `Transcription checked against the document on ${reading.environmentPlan.review.verifiedAt}.`
                          : `Transcribed on ${reading.environmentPlan.review.extractedAt} and awaiting a reviewer's check against the document.`}
                      </p>
                    </AtlasCard>
                    {reading.environmentPlan.hasWaterBalance ? null : (
                      <AtlasGap title="The plan prints no water balance">
                        {reading.environmentPlan.document.template} A demand, supply and deficit table for {reading.districtName}{" "}
                        is still to find; the figures the plan does state are below.
                      </AtlasGap>
                    )}
                  </div>
                  <AtlasSortableTable label="What the plan states about water">
                    <table className={`${TABLE} min-w-[40rem]`}>
                      <thead className={THEAD}>
                        <tr>
                          <th className={TH}>Figure</th>
                          <th className={TH}>As stated</th>
                          <th className={TH}>Where</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reading.environmentPlan.figures.map((figure) => (
                          <tr key={figure.id} className={TR}>
                            <td className={`${TD} whitespace-normal`}>
                              <div className="font-medium text-slate-900 dark:text-slate-100">{figure.label}</div>
                              {figure.detail ? (
                                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{figure.detail}</div>
                              ) : null}
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>
                              {figure.value.toLocaleString("en-IN")} {figure.unit}
                            </td>
                            <td className={`${TD} whitespace-nowrap text-xs`}>
                              {`p. ${figure.printedPage} (PDF p. ${figure.pdfPage})`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AtlasSortableTable>
                  <AtlasNote>
                    Action points the plan sets for water:{" "}
                    {reading.environmentPlan.actionPoints.map((point) => point.text.toLowerCase()).join("; ")}.
                    {reading.environmentPlan.document.quirks.length > 0
                      ? ` Two things to know when reading the PDF: ${reading.environmentPlan.document.quirks.join(" ")}`
                      : ""}
                  </AtlasNote>
                </div>
              ) : null}
            </AtlasSection>
          ) : null}

          {reading.pollutedStretches ? (
            <AtlasSection
              id="polluted-stretches"
              title="Polluted river stretches"
              intro={`What CPCB's ${reading.pollutedStretches.editionLabel} report lists for the district. Priority is CPCB's own BOD band on the ${reading.pollutedStretches.bodObservedYears} maximum, I the worst; station BOD for ${reading.pollutedStretches.followUpBodYear} is the report's follow-up annexure. Each row says how it was joined to the district: a place CPCB prints, or the river's course.`}
            >
              {reading.pollutedStretches.count === 0 ? (
                <div className="space-y-3">
                  <AtlasGap title={`CPCB lists no polluted stretch or location in ${reading.districtName}`}>
                    The {reading.pollutedStretches.editionLabel} report names no stretch or monitoring location in this district. That is a statement about CPCB&apos;s list, not a measurement of every river here.
                    {reading.pollutedStretches.notes.map((note) => ` ${note.text}`).join("")}
                  </AtlasGap>
                </div>
              ) : (
                <div className="space-y-4">
                  <AtlasCard>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reading.pollutedStretches.sentence}</div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Source: CPCB, Polluted River Stretches for Restoration of Water Quality, {reading.pollutedStretches.editionLabel} (
                      <a href={reading.pollutedStretches.url} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline" rel="noopener noreferrer" target="_blank">
                        cpcb.gov.in
                      </a>
                      ). The report is cited by annexure serial and PDF page; it is not mirrored here.
                    </p>
                  </AtlasCard>
                  <AtlasSortableTable label="CPCB-listed stretches and locations touching the district">
                    <table className={`${TABLE} min-w-[52rem]`}>
                      <thead className={THEAD}>
                        <tr>
                          <th className={TH}>River</th>
                          <th className={TH}>Stretch or location, as CPCB prints it</th>
                          <th className={TH}>Priority</th>
                          <th className={TH}>Max BOD {reading.pollutedStretches.bodObservedYears} (mg/L)</th>
                          <th className={TH}>Stations, BOD {reading.pollutedStretches.followUpBodYear}</th>
                          <th className={TH}>Since 2018</th>
                          <th className={TH}>Joined to this district by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reading.pollutedStretches.entries.map((entry) => {
                          const bods = entry.stations.map((s) => s.bod2024).filter((b): b is number => b !== null);
                          const stationText =
                            entry.stations.length === 0
                              ? "none listed"
                              : `${entry.stations.length}${bods.length ? `, BOD ${Math.min(...bods) === Math.max(...bods) ? Math.min(...bods) : `${Math.min(...bods)} to ${Math.max(...bods)}`}` : ""}`;
                          const since = entry.since2018
                            ? entry.since2018.class === "new"
                              ? "new in 2025"
                              : entry.since2018.class === "same"
                                ? `same class as 2018 (Priority ${entry.since2018.priority2018})`
                                : `${entry.since2018.class} from Priority ${entry.since2018.priority2018} in 2018`
                            : "not stated";
                          return (
                            <tr key={entry.id} className={TR}>
                              <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{entry.river}</td>
                              <td className={`${TD} whitespace-normal text-xs`}>
                                {entry.text}
                                <span className="text-slate-500 dark:text-slate-400"> (Annexure {entry.serial.annexure}, no. {entry.serial.sno}, PDF p. {entry.serial.pdfPage})</span>
                              </td>
                              <td className={`${TD} whitespace-nowrap`}>{`Priority ${entry.priority}`}</td>
                              <td className={`${TD} whitespace-nowrap`}>{entry.maxBod2022_23 === null ? "not stated" : entry.maxBod2022_23}</td>
                              <td className={`${TD} whitespace-nowrap text-xs`}>{stationText}</td>
                              <td className={`${TD} whitespace-normal text-xs`}>{since}</td>
                              <td className={`${TD} whitespace-normal text-xs`}>
                                {entry.district.kind === "named" ? "a place CPCB prints: " : "the river's course, as read by the maintainer: "}
                                {entry.district.basis}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </AtlasSortableTable>
                  {reading.pollutedStretches.notes.length > 0 ? (
                    <AtlasNote>{reading.pollutedStretches.notes.map((note) => note.text).join(" ")}</AtlasNote>
                  ) : null}
                </div>
              )}
            </AtlasSection>
          ) : null}

          {gaps.length > 0 ? (
            <AtlasSection
              id="not-on-file"
              title="Not yet on file for this district"
              intro="Named gaps, kept short: each becomes a section of its own when its source is wired."
            >
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {gaps.map((gap) => (
                  <li key={gap.id} id={gap.id}>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{gap.title}.</span> {gap.text}
                  </li>
                ))}
              </ul>
            </AtlasSection>
          ) : null}

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
            intro={`Every Panchayat with a mapped boundary is plotted from the centre of its own ${directory.boundary?.label ?? "boundary"} polygon, not from a hand-entered coordinate. The marker is the Panchayat, not a settlement.`}
          >
            <AtlasDistrictMap points={points} />
            <AtlasNote>
              {points.length} of {directory.panchayats.length} Panchayats have a mapped boundary.{" "}
              {directory.boundary?.publicGeometry
                ? `The polygons are ${directory.boundary.description}; each taluka and Panchayat page draws them.`
                : "The polygons themselves are withheld pending the TNGIS licence reply."}
            </AtlasNote>
          </AtlasSection>

          <AtlasSection
            id="vintages"
            title="How current these figures are"
            intro="Not everything on this page is from the same year, and the gap is large. What each figure describes is listed separately from when the Atlas last read it, straight from each artifact's own record."
          >
            <AtlasSortableTable label="Figure vintages">
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
                  {vintages.map((row) => (
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
            </AtlasSortableTable>
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
