import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtlasBreadcrumbs } from "@/components/atlas/atlas-breadcrumbs";
import { AtlasContainer, AtlasNote } from "@/components/atlas/atlas-primitives";
import { DistrictCard, buildStateBoard } from "@/components/atlas/district-card";
import { listVisibleAtlasStates } from "@/lib/atlas/registry";

/**
 * The state tier of the Atlas: /atlas/tn, /atlas/mh. The Districts view
 * opens at states, and a state opens to the districts inside it - the
 * hierarchy a reader expects, and the page where state-level reads (the
 * district signal ledger's sourced columns, once each passes review) will
 * live. Until then this page is deliberately thin: a doorway, not a surface
 * inventing content it does not have.
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
          <div className="mt-8">
            <AtlasNote>
              State-level readings are not served yet: the columns of the district
              signal ledger (groundwater by taluka, polluted stretches, tanker
              deployments, drought declarations, flood classifications) each enter
              here only after their source, mapping and licence pass review. Until
              then this page is the doorway to the districts, nothing more.
            </AtlasNote>
          </div>
        </AtlasContainer>
      </main>
    </div>
  );
}
