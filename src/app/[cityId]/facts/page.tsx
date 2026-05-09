import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FactsPage } from "@/components/facts/facts-page";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import type { Fact, FactTier } from "@/types/facts";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// Refresh hourly so live + derived rebuilds reach the page on the next visit.
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Facts | Neer Vazhvu" };
  return {
    title: `${config.displayName} Water Facts | Neer Vazhvu`,
    description: `Journalist-ready quotable stats for ${config.displayName}'s water state - reservoirs, groundwater, water bodies, governance.`,
    alternates: { canonical: `/${cityId}/facts` },
    openGraph: {
      title: `${config.displayName} Water Facts | Neer Vazhvu`,
      description: `Quotable snapshot of ${config.displayName}'s water state. Every number dated, sourced, organised by data freshness.`,
      type: "website",
      locale: "en_IN",
      siteName: "Neer Vazhvu",
      url: `https://neervazhvu.org/${cityId}/facts`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${config.displayName} Water Facts | Neer Vazhvu`,
      description: `${config.displayName}'s water state in quotable stats - reservoirs, groundwater, water bodies, governance.`,
    },
  };
}

interface RawFact {
  id: string;
  tier: number;
  category: string;
  title: string;
  value: string;
  unit: string;
  interpretation: string;
  data_date?: string;
  source_url: string;
  source_label: string;
  title_ta?: string;
  interpretation_ta?: string;
}

interface FactsFile {
  generated_at: string;
  facts: RawFact[];
}

/**
 * Hydrate the slim per-city facts JSON into the full Fact shape the
 * shared FactsPage component expects. Fields not present in the city
 * file get sensible defaults so a journalist sees the same render
 * across cities.
 */
function hydrate(raw: RawFact, retrievedAt: string): Fact {
  const tier = Math.max(1, Math.min(4, Math.round(raw.tier))) as FactTier;
  return {
    id: raw.id,
    tier,
    category: raw.category,
    title: raw.title,
    value: raw.value,
    unit: raw.unit ?? "",
    interpretation: raw.interpretation,
    data_date: raw.data_date ?? null,
    published_date: null,
    retrieved_at: retrievedAt,
    computed_at: null,
    source_url: raw.source_url,
    source_label: raw.source_label,
    method_id: raw.id,
    confidence: "high",
    claim_status: tier === 1 || tier === 2 ? "observed" : "historical",
    quote_text: raw.interpretation,
    title_ta: raw.title_ta,
    interpretation_ta: raw.interpretation_ta,
  };
}

async function loadFacts(cityId: string): Promise<FactsFile | null> {
  try {
    const text = await fs.readFile(
      path.join(process.cwd(), "public", "data", `facts-${cityId}.json`),
      "utf-8",
    );
    return JSON.parse(text) as FactsFile;
  } catch {
    return null;
  }
}

function buildJsonLd(facts: Fact[], cityName: string, cityId: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${cityName} Water Facts`,
    description: `Curated snapshot of ${cityName} water data across reservoirs, groundwater, rivers, and infrastructure. Each fact has source, date, and methodology attached.`,
    url: `https://neervazhvu.org/${cityId}/facts`,
    creator: {
      "@type": "Organization",
      name: "Neer Vazhvu",
      url: "https://neervazhvu.org",
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
    variableMeasured: facts.map((fact) => ({
      "@type": "Observation",
      "@id": `https://neervazhvu.org/${cityId}/facts#${fact.id}`,
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

export default async function CityFactsPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const factsFile = await loadFacts(cityId);
  if (!factsFile) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Water facts"
        scope="city-admin"
        parityVerdict="MEDIUM"
        whatItShowsForChennai="quotable findings derived from reservoirs, groundwater, rivers, water bodies, and demographics - tagged by category, tier, and source for journalists"
        dataGapNote="No curated facts file for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  const retrievedAt = new Date().toISOString();
  const facts: Fact[] = factsFile.facts.map((f) => hydrate(f, retrievedAt));
  const jsonLd = buildJsonLd(facts, config.displayName, cityId);

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
        generatedAt={factsFile.generated_at ?? retrievedAt}
        cityName={config.displayName}
        cityNameTa={config.displayNameTa}
      />
    </>
  );
}
