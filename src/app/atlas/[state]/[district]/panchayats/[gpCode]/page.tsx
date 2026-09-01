import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AtlasBreadcrumbs } from "@/components/atlas/atlas-breadcrumbs";
import { AtlasPlaceMap, type AtlasMapMarker, type AtlasMapPolygons } from "@/components/atlas/atlas-map";
import { AtlasSectionNav } from "@/components/atlas/atlas-section-nav";
import {
  AtlasCard,
  AtlasContainer,
  AtlasFinding,
  AtlasGap,
  AtlasNote,
  AtlasTableScroll,
  StatTile,
  StatusPill,
  TABLE,
  TD,
  TH,
  THEAD,
  TR,
  ToneBadge,
  type BriefStatusKey,
  type Tone,
} from "@/components/atlas/atlas-primitives";
import { getCuratedBrief } from "@/lib/atlas/curated-briefs";
import { loadBoundaryShard, loadGroundwaterProjection, loadGroundwaterTaluks, loadWaterBodyShard } from "@/lib/atlas/data";
import { getDistrictBrief, getDistrictDirectory } from "@/lib/atlas/district-directory";
import { displayTalukName, unitLabelOf } from "@/lib/atlas/district-reading";
import {
  blockHref,
  districtHref,
  findAtlasDistrict,
  isAtlasDistrictVisible,
  listVisibleAtlasDistricts,
  panchayatHref,
} from "@/lib/atlas/registry";
import { formatExtractionStage } from "@/lib/atlas/tn-groundwater-projection";

const GAP_REASONS = [
  {
    reason: "unavailable" as const,
    heading: "No source carries it",
    note: "Nothing acquired for this district answers these, so they are named rather than estimated.",
  },
  {
    reason: "not-assessed" as const,
    heading: "Not determined whether it applies here",
    note: "These may not be meaningful for an inland rural Panchayat. Until that is decided, they are neither claimed nor dismissed.",
  },
];

interface RouteParams {
  params: Promise<{ state: string; district: string; gpCode: string }>;
}

const ha = (value: number | null | undefined): string =>
  typeof value === "number" ? `${value.toLocaleString("en-IN")} ha` : "not stated";
const count = (value: number | null | undefined): string =>
  typeof value === "number" ? value.toLocaleString("en-IN") : "not stated";
/** Waterspread is computed from geometry and carries four decimals; a tenth
 *  of a hectare is already finer than the polygons justify. */
const area = (value: number): string => Number(value.toFixed(1)).toLocaleString("en-IN");

/** Any figure that describes the containing taluk (or, in a reviewed brief,
 *  the firka) carries its grain on the tile, every time. */
function grainFlag(fact: { label: string; note: string }): string | undefined {
  const text = `${fact.label} ${fact.note}`;
  if (/firka/i.test(text)) return "firka assessment";
  if (/taluka/i.test(text)) return "taluka projection";
  if (/taluk/i.test(text)) return "taluk projection";
  return undefined;
}

export function generateStaticParams() {
  return listVisibleAtlasDistricts().flatMap((district) => {
    const directory = getDistrictDirectory(district.stateSlug, district.slug);
    return (directory?.panchayats ?? []).map((place) => ({
      state: district.stateSlug,
      district: district.slug,
      gpCode: place.lgdCode,
    }));
  });
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { state, district: districtSlug, gpCode } = await params;
  const entry = findAtlasDistrict(state, districtSlug);
  if (!entry || !isAtlasDistrictVisible(entry)) return {};
  const directory = getDistrictDirectory(state, districtSlug);
  const panchayat = directory?.panchayats.find((item) => item.lgdCode === gpCode);
  if (!directory || !panchayat) return {};
  return {
    title: `${panchayat.name} Gram Panchayat water profile | Neer Vazhvu Atlas`,
    description: `Water evidence for ${panchayat.name} Gram Panchayat in ${panchayat.blockName} block, ${directory.districtName} district, with the gaps named.`,
    alternates: { canonical: panchayatHref(entry, gpCode) },
  };
}

function Chapter({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-6 first:pt-0">
      <header className="mb-3">
        <h2 id={`${id}-title`} className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {intro ? <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}

export default async function AtlasPanchayatPage({ params }: RouteParams) {
  const { state, district: districtSlug, gpCode } = await params;
  const entry = findAtlasDistrict(state, districtSlug);
  if (!entry || !isAtlasDistrictVisible(entry)) notFound();
  const directory = getDistrictDirectory(state, districtSlug);
  const panchayat = directory?.panchayats.find((item) => item.lgdCode === gpCode);
  if (!directory || !panchayat) notFound();

  const basePath = districtHref(entry);
  const blockPath = blockHref(entry, panchayat.blockCode);
  const basinHref = entry.basin
    ? `/embed/basins/${entry.basin.basinId}?sub=${entry.basin.subBasinKey}`
    : null;
  const brief = getDistrictBrief(entry.slug, gpCode);
  // A reviewer's brief is preferred where one exists. It carries what a
  // person understood about the place, which no rule derives.
  const curated = entry.hasCuratedBriefs ? getCuratedBrief(entry.slug, gpCode) : undefined;
  // Served polygons exist only where the licence allows (DataMeet, ODbL);
  // the TNGIS-built districts carry none and the map keeps its marker.
  const boundaryFeature = directory.boundary?.publicGeometry
    ? loadBoundaryShard(entry, panchayat.blockCode)?.features.find(
        (feature) => feature.properties.lgdCode === gpCode,
      )
    : undefined;
  const polygons: AtlasMapPolygons | undefined = boundaryFeature
    ? {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { lgdCode: boundaryFeature.properties.lgdCode, name: boundaryFeature.properties.name },
            geometry: boundaryFeature.geometry,
          },
        ],
      }
    : undefined;
  const projection = loadGroundwaterProjection(entry)?.records.find(
    (record) => record.lgdGramPanchayatCode === gpCode,
  );
  const projectionLimitations = loadGroundwaterProjection(entry)?.projection?.limitations ?? [];

  const status: BriefStatusKey = curated
    ? "reviewed"
    : brief?.status === "brief-ready"
      ? "profile"
      : "directory";
  const verdict = curated
    ? { title: curated.verdictTitle, body: curated.verdictBody }
    : brief?.status === "brief-ready" && brief.verdict
      ? { title: brief.verdict.title, body: brief.verdict.body }
      : undefined;
  const tone: Tone = curated
    ? curated.status === "review-blocked"
      ? "blocked"
      : (brief?.verdict?.tone ?? "neutral")
    : (brief?.verdict?.tone ?? "neutral");
  const facts = curated?.headlineFacts ?? brief?.headlineFacts ?? [];
  const detail = brief?.detail;
  // The census register serves the enumerators' coordinates (open licence);
  // a TNGIS-built district has no point to draw.
  const waterBodyFeature =
    detail?.waterBodies?.register === "water-bodies-census"
      ? loadWaterBodyShard(entry, panchayat.blockCode)?.features.find(
          (feature) => feature.properties.lgdGramPanchayatCode === gpCode,
        )
      : undefined;
  const waterBodyMarkers: AtlasMapMarker[] = (waterBodyFeature?.geometry?.coordinates ?? []).map(
    ([longitude, latitude], index) => ({
      id: `${gpCode}-water-body-${index}`,
      latitude,
      longitude,
      label: "Water body, First Census of Water Bodies",
    }),
  );

  // One list drives both the contents rail and the chapters, so a section
  // can never appear in one and be missing from the other.
  // "taluk" in Tamil Nadu, "taluka" in Maharashtra: the assessment unit's own name.
  const unit = unitLabelOf(loadGroundwaterTaluks(entry));
  const chapters = [
    { id: "where", label: "Place and boundary", show: Boolean(detail?.boundary) },
    { id: "habitations", label: "Habitations", show: Boolean(detail && detail.habitations.length > 0) },
    { id: "water-sources", label: "Where the water comes from", show: Boolean(detail && detail.sources.length > 0) },
    { id: "groundwater", label: `Groundwater, projected from the ${unit}`, show: Boolean(projection) },
    { id: "water-bodies", label: "Tanks and water bodies", show: Boolean(detail?.waterBodies) },
    { id: "sampling", label: "Water-quality testing", show: Boolean(detail?.sampling) },
    { id: "land", label: "Land and irrigation", show: Boolean(detail?.land) },
    { id: "seasonal", label: "Sources through summer", show: Boolean(detail?.seasonal) },
    { id: "reading", label: "What this means here", show: Boolean(curated && curated.insights.length > 0) },
    { id: "missing", label: "What is missing", show: Boolean(brief) },
    { id: "next", label: "What would sharpen this", show: Boolean(curated && curated.nextEvidence.length > 0) },
  ].filter((chapter) => chapter.show);

  return (
    <div className="bg-white dark:bg-slate-950">
      <AtlasContainer className="pt-4 sm:pt-6">
        <AtlasBreadcrumbs
          items={[
            { label: "India", href: "/" },
            { label: entry.stateName },
            { label: directory.districtName, href: basePath },
            { label: panchayat.blockName, href: blockPath },
            { label: panchayat.name },
          ]}
        />
      </AtlasContainer>

      <header className="border-b border-slate-200 dark:border-slate-800">
        <AtlasContainer className="py-8 sm:py-10">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Gram Panchayat</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span>LGD {panchayat.lgdCode}</span>
            <StatusPill status={status} />
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {panchayat.name}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Part of{" "}
            <Link href={blockPath} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
              {panchayat.blockName} block
            </Link>
            ,{" "}
            <Link href={basePath} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
              {directory.districtName} district
            </Link>
            {entry.basin && basinHref ? (
              <>
                , in the{" "}
                <Link href={basinHref} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                  {entry.basin.subBasinName}
                </Link>{" "}
                sub-basin
              </>
            ) : null}
            .{curated ? ` Reviewed by a person on ${curated.reviewedAt}.` : ""}
          </p>

          <div className="mt-6">
            {verdict ? (
              <>
                <ToneBadge tone={tone} />
                <h2 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {verdict.title}
                </h2>
                <p className="mt-2 text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                  {verdict.body}
                </p>
              </>
            ) : (
              <>
                <ToneBadge tone="neutral" />
                <h2 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  No water profile is published for this place
                </h2>
                <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
                  {brief?.statusReason ?? "No profile has been generated for this Panchayat yet."}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  The Panchayat is listed so it can be found and reviewed. A profile is held back rather
                  than published from evidence that cannot identify the place.
                </p>
              </>
            )}
          </div>

          {facts.length > 0 ? (
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {facts.map((fact, index) => (
                <StatTile
                  key={fact.label}
                  value={fact.value}
                  label={fact.label}
                  note={fact.note}
                  primary={index === 0}
                  flag={grainFlag(fact)}
                />
              ))}
            </dl>
          ) : null}
        </AtlasContainer>
      </header>

      <main>
        <AtlasContainer className="py-8 sm:py-10">
          <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10">
            <AtlasSectionNav
              layout="rail"
              label="Profile sections"
              heading="In this profile"
              sections={chapters.map(({ id, label }) => ({ id, label }))}
            />

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {detail?.boundary ? (
                <Chapter
                  id="where"
                  title="Place and boundary"
                  intro={
                    directory.boundary?.publicGeometry
                      ? `The mapped extent is ${directory.boundary.description}, so the place on the map is the place the register describes.`
                      : "The mapped extent comes from the TNGIS Panchayat polygon for this LGD code, so the place on the map is the place the records describe."
                  }
                >
                  <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
                    <AtlasCard>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {[
                          ["LGD Panchayat code", panchayat.lgdCode],
                          ["Block", panchayat.blockName],
                          ["District", directory.districtName],
                          ["Mapped area", `${detail.boundary.areaHectares.toLocaleString("en-IN")} ha`],
                          ["Centroid", `${detail.boundary.latitude.toFixed(4)}, ${detail.boundary.longitude.toFixed(4)}`],
                        ].map(([label, value]) => (
                          <div key={label} className="contents">
                            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </AtlasCard>
                    <figure>
                      <AtlasPlaceMap
                        polygons={polygons}
                        markers={waterBodyMarkers}
                        point={{
                          id: panchayat.lgdCode,
                          name: panchayat.name,
                          blockName: panchayat.blockName,
                          latitude: detail.boundary.latitude,
                          longitude: detail.boundary.longitude,
                        }}
                      />
                      <figcaption className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {directory.boundary?.publicGeometry
                          ? `Plotted from the centroid of the ${directory.boundary.label} polygon. The marker is the Panchayat, not a settlement; the polygon is indicative (a 2001-era digitisation), not a survey boundary.`
                          : "Plotted from the centroid of the TNGIS polygon. The marker is the Panchayat, not a settlement; the polygon is withheld pending the licence reply."}
                        {waterBodyMarkers.length > 0
                          ? ` The ${waterBodyMarkers.length} small markers are the water bodies the First Census of Water Bodies recorded in this Panchayat's villages, at the coordinates its enumerators entered.`
                          : ""}
                      </figcaption>
                    </figure>
                  </div>
                </Chapter>
              ) : null}

              {detail && detail.habitations.length > 0 ? (
                <Chapter
                  id="habitations"
                  title="Habitations"
                  intro="JJM records service for each habitation separately. A Panchayat total can hide a habitation that is behind."
                >
                  <AtlasTableScroll label="Habitations">
                    <table className={`${TABLE} min-w-[28rem]`}>
                      <thead className={THEAD}>
                        <tr>
                          <th className={TH}>Habitation</th>
                          <th className={TH}>Population</th>
                          <th className={TH}>Households</th>
                          <th className={TH}>Tap connections</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.habitations.map((habitation) => (
                          <tr key={habitation.name} className={TR}>
                            <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{habitation.name}</td>
                            <td className={TD}>{count(habitation.population)}</td>
                            <td className={TD}>{count(habitation.households)}</td>
                            <td className={TD}>{count(habitation.connections)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AtlasTableScroll>
                </Chapter>
              ) : null}

              {detail && detail.sources.length > 0 ? (
                <Chapter
                  id="water-sources"
                  title="Where the water comes from"
                  intro="The schemes JJM records as serving this Panchayat, grouped by the kind of source they draw on."
                >
                  <AtlasTableScroll label="Drinking-water sources">
                    <table className={`${TABLE} min-w-[24rem]`}>
                      <thead className={THEAD}>
                        <tr>
                          <th className={TH}>Source</th>
                          <th className={TH}>Category</th>
                          <th className={TH}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.sources.map((source) => (
                          <tr key={source.type} className={TR}>
                            <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{source.type}</td>
                            <td className={TD}>{source.category}</td>
                            <td className={TD}>{count(source.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AtlasTableScroll>
                </Chapter>
              ) : null}

              {projection ? (
                <Chapter
                  id="groundwater"
                  title={`Groundwater, projected from the ${unit}`}
                  intro={`IN-GRES assesses revenue ${unit}s. This Panchayat inherits its containing ${unit}'s category unchanged, as containing-area context rather than a measurement of the place.`}
                >
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <StatTile
                      value={projection.category ? projection.category.replace(/_/g, "-") : "not stated"}
                      label={`${unit} category`}
                      flag={`${unit} projection`}
                      note={`${displayTalukName(projection.talukName)} ${unit}, by ${projection.containment.replace(/-/g, " ")}.`}
                      primary
                    />
                    <StatTile
                      value={`${formatExtractionStage(projection.stageOfExtractionPercent)}%`}
                      label={`stage of extraction, ${unit}`}
                      flag={`${unit} projection`}
                      note={`Groundwater drawn each year as a share of what recharges, for the whole ${unit}. Above 100 is more drawn than recharges.`}
                    />
                    <StatTile
                      value={displayTalukName(projection.talukName)}
                      label={`containing revenue ${unit}`}
                      flag={`${unit} projection`}
                      note={
                        projection.containment === "village-subdistrict-code"
                          ? "Sub-district on the revenue hierarchy, which the register itself places this Panchayat's villages in."
                          : "Sub-district on the revenue hierarchy, which the Panchayat hierarchy does not nest inside."
                      }
                    />
                  </dl>
                  {projectionLimitations.length > 0 ? (
                    <AtlasNote>{projectionLimitations.join(" ")}</AtlasNote>
                  ) : null}
                </Chapter>
              ) : null}

              {detail?.waterBodies ? (
                <Chapter
                  id="water-bodies"
                  title="Tanks and water bodies"
                  intro={
                    detail.waterBodies.register === "water-bodies-census"
                      ? "Enumerated by the First Census of Water Bodies in this Panchayat's villages and placed here through the LGD's own village list, not by a name match."
                      : "Mapped by TNGIS and assigned to this Panchayat by the register itself, not by a name match."
                  }
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      {detail.waterBodies.register === "water-bodies-census" ? (
                        <>
                          <AtlasFinding>
                            {detail.waterBodies.count}{" "}
                            {detail.waterBodies.count === 1 ? "water body is" : "water bodies are"} on the census
                            return for this Panchayat
                            {detail.waterBodies.byType && detail.waterBodies.byType.length > 0
                              ? `: ${detail.waterBodies.byType.map((row) => `${count(row.count)} ${row.type.toLowerCase()}`).join(", ")}`
                              : ""}
                            . {detail.waterBodies.pointCount ?? 0} of them carry a recorded coordinate
                            {waterBodyMarkers.length > 0 ? ", drawn on the map above" : ""}.
                            {detail.waterBodies.areaBasis === "stated"
                              ? ` Stated waterspread ${area(detail.waterBodies.areaHectares)} ha, the largest ${area(detail.waterBodies.largestAreaHectares)} ha.`
                              : ""}
                          </AtlasFinding>
                          <AtlasNote className="mt-0">
                            {detail.waterBodies.areaBasis === "stated"
                              ? "Waterspread is what the enumerator entered, not a measured polygon, and says nothing about whether these hold water through the year."
                              : "The state's return enters template values for waterspread, depth, year and cost on every row, so those are not published: a count, a class and an owner are what it can support. It says nothing about whether these hold water through the year."}
                            {detail.waterBodies.namedCount === 0
                              ? " None of them is named in the return, which reads as a structure register rather than a survey of tanks and lakes."
                              : ` The return names ${detail.waterBodies.namedCount} of them.`}
                          </AtlasNote>
                        </>
                      ) : (
                        <>
                          <AtlasFinding>
                            {detail.waterBodies.count}{" "}
                            {detail.waterBodies.count === 1 ? "water body covers" : "water bodies cover"}{" "}
                            {area(detail.waterBodies.areaHectares)} ha here, the largest of them{" "}
                            {area(detail.waterBodies.largestAreaHectares)} ha. The register names{" "}
                            {detail.waterBodies.namedCount} of them; the names and polygons are withheld
                            pending the TNGIS licence reply.
                          </AtlasFinding>
                          <AtlasNote className="mt-0">
                            Waterspread is the mapped extent, not storage. It says nothing about whether these
                            hold water through the year, whether they are encroached, or when any one of them
                            was last surveyed.
                          </AtlasNote>
                        </>
                      )}
                    </div>
                    <div className="space-y-4">
                      {detail.waterBodies.register === "water-bodies-census" && detail.waterBodies.byType ? (
                        <AtlasTableScroll label="Water bodies by census class">
                          <table className={`${TABLE} min-w-[16rem]`}>
                            <thead className={THEAD}>
                              <tr>
                                <th className={TH}>Census class</th>
                                <th className={TH}>Water bodies</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.waterBodies.byType.map((row) => (
                                <tr key={row.type} className={TR}>
                                  <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{row.type}</td>
                                  <td className={TD}>{count(row.count)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </AtlasTableScroll>
                      ) : null}
                      <AtlasTableScroll
                        label={
                          detail.waterBodies.register === "water-bodies-census"
                            ? "Water bodies by owner"
                            : "Water bodies by registering department"
                        }
                      >
                        <table className={`${TABLE} min-w-[16rem]`}>
                          <thead className={THEAD}>
                            <tr>
                              <th className={TH}>
                                {detail.waterBodies.register === "water-bodies-census" ? "Owned by" : "Registered by"}
                              </th>
                              <th className={TH}>Water bodies</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.waterBodies.byDepartment.map((row) => (
                              <tr key={row.department} className={TR}>
                                <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{row.department}</td>
                                <td className={TD}>{count(row.count)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AtlasTableScroll>
                    </div>
                  </div>
                </Chapter>
              ) : null}

              {detail?.sampling ? (
                <Chapter id="sampling" title="Water-quality testing">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <AtlasFinding>
                        {detail.sampling.total.toLocaleString("en-IN")} samples between{" "}
                        {detail.sampling.earliest ?? "an unstated date"} and{" "}
                        {detail.sampling.latest ?? "an unstated date"}. {detail.sampling.atSource} were
                        taken at a source and {detail.sampling.atHousehold} at households.
                      </AtlasFinding>
                      <AtlasNote className="mt-0">
                        {detail.sampling.unsafe === 0
                          ? "None was recorded unsafe. A clean run this long describes the reporting as much as the water, so read it as an absence of recorded failures rather than as evidence of safety."
                          : `${detail.sampling.unsafe} were recorded unsafe.`}
                      </AtlasNote>
                    </div>
                    <AtlasTableScroll label="Samples by year">
                      <table className={`${TABLE} min-w-[12rem]`}>
                        <thead className={THEAD}>
                          <tr>
                            <th className={TH}>Year</th>
                            <th className={TH}>Samples</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.sampling.byYear.map((row) => (
                            <tr key={row.year} className={TR}>
                              <td className={`${TD} font-medium text-slate-900 dark:text-slate-100`}>{row.year}</td>
                              <td className={TD}>{count(row.count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </AtlasTableScroll>
                  </div>
                </Chapter>
              ) : null}

              {detail?.land ? (
                <Chapter
                  id="land"
                  title="Land and irrigation"
                  intro="Census 2011, reference year 2009. A historical baseline, not current cropping."
                >
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <StatTile
                      value={ha(detail.land.netSownHectares)}
                      label="net area sown"
                      asOf="Census 2011"
                      note={`of ${ha(detail.land.totalAreaHectares)} total.`}
                      primary
                    />
                    <StatTile
                      value={ha(detail.land.irrigatedHectares)}
                      label="irrigated"
                      asOf="Census 2011"
                      note={`canal ${ha(detail.land.canalHectares)}, wells ${ha(detail.land.wellHectares)}, tanks ${ha(detail.land.tankHectares)}.`}
                    />
                    <StatTile
                      value={ha(detail.land.culturableWasteHectares)}
                      label="not cultivated"
                      asOf="Census 2011"
                      note={`culturable waste; barren ${ha(detail.land.barrenHectares)}, forest ${ha(detail.land.forestHectares)}.`}
                    />
                  </dl>
                </Chapter>
              ) : null}

              {detail?.seasonal ? (
                <Chapter id="seasonal" title="Sources through the summer" intro="Census 2011, reference year 2009.">
                  <AtlasFinding>
                    {detail.seasonal.annualSourceTypes} source types were recorded for the year and{" "}
                    {detail.seasonal.summerSourceTypes} held through the summer months.{" "}
                    {detail.seasonal.lostInSummer.length > 0
                      ? `These failed in summer: ${detail.seasonal.lostInSummer.join(", ")}.`
                      : "None failed."}
                  </AtlasFinding>
                  <AtlasNote>
                    This is the 2009 pattern and says nothing about whether today&rsquo;s piped supply holds
                    through summer.
                  </AtlasNote>
                </Chapter>
              ) : null}

              {curated && curated.insights.length > 0 ? (
                <Chapter
                  id="reading"
                  title="What this means here"
                  intro={`Read by a person against the records above, on ${curated.reviewedAt}.`}
                >
                  <div className="space-y-3">
                    {curated.insights.map((insight) => (
                      <AtlasCard key={insight.id}>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {insight.domain.replace(/-/g, " ")}
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{insight.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{insight.text}</p>
                      </AtlasCard>
                    ))}
                  </div>
                </Chapter>
              ) : null}

              {brief ? (
                <Chapter
                  id="missing"
                  title="What is missing"
                  intro={`${brief.adequateCapabilities} of ${brief.assessedCapabilities} capabilities are supported by acquired evidence. The rest are named here rather than left blank.`}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {GAP_REASONS.map(({ reason, heading, note }) => {
                      const gaps = brief.gaps.filter((gap) => gap.reason === reason);
                      if (gaps.length === 0) return null;
                      return (
                        <AtlasGap key={reason} title={`${heading} (${gaps.length})`}>
                          <p>{note}</p>
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {gaps.map((gap) => (
                              <li
                                key={gap.capabilityId}
                                className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400"
                              >
                                {gap.capabilityId.replace(/-/g, " ")}
                              </li>
                            ))}
                          </ul>
                        </AtlasGap>
                      );
                    })}
                  </div>
                </Chapter>
              ) : null}

              {curated && curated.nextEvidence.length > 0 ? (
                <Chapter id="next" title="What would sharpen this">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {curated.nextEvidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Chapter>
              ) : null}

              <div className="py-6 text-sm">
                <Link href={basePath} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                  Back to {directory.districtName} district
                </Link>
              </div>
            </div>
          </div>
        </AtlasContainer>
      </main>
    </div>
  );
}
