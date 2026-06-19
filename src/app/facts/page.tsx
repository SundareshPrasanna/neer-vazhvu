import type { Metadata } from "next";
import { DynamicFactsContent } from "@/app/[cityId]/facts/dynamic-facts-content";

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
    url: "https://neervazhvu.org/facts",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chennai Water Facts | Neer Vazhvu",
    description:
      "Chennai's water state in 25 quotable stats - reservoirs, groundwater, rivers, floods, infrastructure.",
  },
};

// Revalidate daily. Underlying live-fact sources (CMWSSB lake-level
// scrape, OpenCity groundwater monthly, etc.) don't refresh faster
// than once per day, so re-rendering more often just burns Supabase
// queries without surfacing newer numbers.
export const revalidate = 86400;

export default async function Page() {
  return (
    <DynamicFactsContent cityId="chennai" cityName="Chennai" cityNameTa="சென்னை" />
  );
}
