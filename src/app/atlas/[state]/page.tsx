import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtlasBreadcrumbs } from "@/components/atlas/atlas-breadcrumbs";
import { AtlasContainer, AtlasNote, AtlasSection } from "@/components/atlas/atlas-primitives";
import { FloodStatement, ScarcityStateTable } from "@/components/atlas/scarcity-flood";
import { loadStateFloodClassification, loadStateScarcityTankers } from "@/lib/atlas/data";
import { latestScarcityWeek, stateFloodReading } from "@/lib/atlas/hazards";
import { DistrictCard, buildStateBoard } from "@/components/atlas/district-card";
import { listVisibleAtlasStates } from "@/lib/atlas/registry";

/**
 * The state tier of the Atlas: /atlas/tn, /atlas/mh. The Districts view
 * opens at states, and a state opens to the districts inside it - the
 * hierarchy a reader expects, and the page where the state-level reads
 * live: the columns of the district signal ledger, each rendered only when
 * its served artifact exists. Today that is the week's tanker register
 * (Maharashtra) and the disaster plan's flood classification; the rest of
 * the ledger lands a column at a time.
 */

interface RouteParams {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  return listVisibleAtlasStates().map((s) => ({ state: s.stateSlug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { state } = await params;
  const entry = listVisibleAtlasStates().find((s) => s.stateSlug === state.toLowerCase());
  if (!entry) return {};
  const n = entry.districts.length;
  return {
    title: `${entry.stateName} district atlas | Neer Vazhvu`,
    description: `${n} ${n === 1 ? "district" : "districts"} of ${entry.stateName} in the Atlas: a verdict, dated facts and a Gram Panchayat directory for each, with the gaps named.`,
    alternates: { canonical: `/atlas/${entry.stateSlug}` },
  };
}

export default async function StatePage({ params }: RouteParams) {
  const { state } = await params;
  const entry = listVisibleAtlasStates().find((s) => s.stateSlug === state.toLowerCase());
  if (!entry) notFound();
  const board = buildStateBoard().find((b) => b.state.stateSlug === entry.stateSlug);
  const cards = (board?.board ?? []).filter((b) => b.status !== "onboarding");
  const onboarding = (board?.board ?? []).filter((b) => b.status === "onboarding");

  // State-level reads, gated on the served artifacts and nothing else.
  const scarcityArtifact = loadStateScarcityTankers(entry.stateSlug);
  const week = scarcityArtifact ? latestScarcityWeek(scarcityArtifact) : null;
  const floodArtifact = loadStateFloodClassification(entry.stateSlug);
  const flood = floodArtifact ? stateFloodReading(floodArtifact) : null;

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen">
      <AtlasContainer className="pt-4 sm:pt-6">
        <AtlasBreadcrumbs items={[{ label: "India", href: "/" }, { label: entry.stateName }]} />
      </AtlasContainer>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <AtlasContainer className="pb-8 pt-4 sm:pb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            District Atlas
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
            {entry.stateName}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">{entry.hook}</p>
        </AtlasContainer>
      </header>
      <main>
        <AtlasContainer className="py-8 sm:py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cards.map((b) => (
              <DistrictCard key={b.district.scopeId} {...b} />
            ))}
            {onboarding.map((b) => (
              <DistrictCard key={b.district.scopeId} {...b} />
            ))}
          </div>
        </AtlasContainer>
        {week || flood ? (
          <AtlasContainer className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {week ? (
              <AtlasSection
                id="scarcity"
                title="Tankers this week"
                intro="The Water Supply and Sanitation Department publishes a weekly report of every village and wadi on tanker supply, district by district. This is that report's latest week, served as the department prints it."
              >
                <ScarcityStateTable week={week} />
              </AtlasSection>
            ) : null}
            {flood ? (
              <AtlasSection
                id="flood"
                title="What the disaster plan says about floods"
                intro="The state's own disaster management plan, quoted with its page. The Atlas classifies nothing itself; each district page carries the plan's statement for that district."
              >
                <FloodStatement reading={flood} />
              </AtlasSection>
            ) : null}
          </AtlasContainer>
        ) : null}
        <AtlasContainer className="py-8">
          <AtlasNote>
            The remaining columns of the district signal ledger (groundwater by
            taluka, polluted river stretches, drought declarations) land here one
            at a time, each as its source, mapping and licence are pinned down;
            the page never invents a column it cannot source.
          </AtlasNote>
        </AtlasContainer>
      </main>
    </div>
  );
}
