import type { Metadata } from "next";
import { FactsPage } from "@/components/facts/facts-page";
import { STATIC_FACTS } from "@/lib/facts/static-facts";
import { buildLiveFacts } from "@/lib/facts/live-facts";
import type { Fact } from "@/types/facts";

export const metadata: Metadata = {
  title: "Chennai Water Facts | Neer Vazhvu",
  description:
    "Journalist-ready snapshot of Chennai's water state: reservoirs, groundwater, rivers, floods, and infrastructure. Every number dated, sourced, and organised by freshness tier.",
  openGraph: {
    title: "Chennai Water Facts | Neer Vazhvu",
    description:
      "Chennai's water state in 25 quotable stats - reservoirs, groundwater, rivers, floods, infrastructure. All sourced, dated, and organised by data freshness.",
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neer-vazhvu.org/facts",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chennai Water Facts | Neer Vazhvu",
    description:
      "Chennai's water state in 25 quotable stats - reservoirs, groundwater, rivers, floods, infrastructure.",
  },
};

// Revalidate daily - live facts query at request time
export const revalidate = 3600;

export default async function Page() {
  const liveFacts = await buildLiveFacts();
  const facts: Fact[] = [...liveFacts, ...STATIC_FACTS];
  const generatedAt = new Date().toISOString();
  const jsonLd = buildJsonLd(facts);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FactsPage facts={facts} generatedAt={generatedAt} />
    </>
  );
}

function buildJsonLd(facts: Fact[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Chennai Water Facts",
    description:
      "Curated snapshot of Chennai water data across reservoirs, groundwater, rivers, floods, and infrastructure. Each fact has source, date, and methodology attached.",
    url: "https://neer-vazhvu.org/facts",
    creator: {
      "@type": "Organization",
      name: "Neer Vazhvu",
      url: "https://neer-vazhvu.org",
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
    variableMeasured: facts.map((fact) => ({
      "@type": "Observation",
      "@id": `https://neer-vazhvu.org/facts#${fact.id}`,
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
