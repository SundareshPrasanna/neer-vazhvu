import { FactsPage } from "@/components/facts/facts-page";
import { STATIC_FACTS } from "@/lib/facts/static-facts";
import { buildLiveFacts } from "@/lib/facts/live-facts";
import { buildDerivedFacts } from "@/lib/facts/derived-facts";
import type { Fact } from "@/types/facts";

/**
 * Dynamic facts variant: assembles facts at request time from the live +
 * derived + static sources, instead of loading a static per-city JSON
 * snapshot. Selected by `config.facts.dynamicPipeline` (Chennai today).
 *
 * Shared by contract - any city that gains a live/derived pipeline opts in
 * via config. The live/derived builders are currently Chennai-scoped;
 * generalizing them per city is tracked in
 * docs/specs/multi-city-component-discipline.md.
 *
 * `pagePathPrefix` is the city's route prefix ("" for the legacy flat
 * Chennai route, "/chennai" under the namespaced route).
 */
export async function DynamicFactsContent({
  cityId,
  cityName,
  cityNameTa,
  pagePathPrefix = "",
}: {
  cityId: string;
  cityName: string;
  cityNameTa?: string;
  pagePathPrefix?: string;
}) {
  const [liveFacts, derivedFacts] = await Promise.all([
    buildLiveFacts(),
    buildDerivedFacts(),
  ]);
  const facts: Fact[] = [...liveFacts, ...derivedFacts, ...STATIC_FACTS];
  const generatedAt = new Date().toISOString();
  const jsonLd = buildJsonLd(facts, cityName, pagePathPrefix);
  const originsUrl = pagePathPrefix ? `${pagePathPrefix}/origins` : "/origins";

  return (
    <>
      {/* JSON-LD goes in a plain <script> tag (not next/script) so it
          renders in the SSR HTML and search engines pick it up. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FactsPage
        facts={facts}
        generatedAt={generatedAt}
        cityName={cityName}
        cityNameTa={cityNameTa}
        originsUrl={originsUrl}
        pagePathPrefix={pagePathPrefix}
      />
    </>
  );
}

function buildJsonLd(facts: Fact[], cityName: string, pagePathPrefix: string) {
  const base = `https://neervazhvu.org${pagePathPrefix}/facts`;
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${cityName} Water Facts`,
    description: `Curated snapshot of ${cityName} water data across reservoirs, groundwater, rivers, floods, and infrastructure. Each fact has source, date, and methodology attached.`,
    url: base,
    creator: {
      "@type": "Organization",
      name: "Neer Vazhvu",
      url: "https://neervazhvu.org",
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
    variableMeasured: facts.map((fact) => ({
      "@type": "Observation",
      "@id": `${base}#${fact.id}`,
      name: fact.title,
      measuredProperty: fact.category,
      value: fact.value,
      unitText: fact.unit,
      observationDate: fact.data_date ?? fact.retrieved_at,
      description: fact.interpretation,
      measurementMethod: fact.method_id,
      citation: {
        "@type": "CreativeWork",
        name: fact.source_label,
        url: fact.source_url,
      },
    })),
  };
}
