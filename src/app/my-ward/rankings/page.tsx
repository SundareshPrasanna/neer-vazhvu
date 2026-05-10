import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadWardRankings } from "@/lib/ward-rankings/load-rankings";
import { RankingsTable } from "@/components/my-ward/rankings-table";

export const metadata: Metadata = {
  title: "Chennai ward rankings | Neer Vazhvu",
  description:
    "All 200 Chennai wards ranked by composite water-stress score. Sortable by grade, zone, and per-metric values.",
  alternates: { canonical: "/my-ward/rankings" },
};

// Daily revalidate. Ranking recomputes from ward-profiles.json which
// refreshes at most daily.
export const revalidate = 86400;

export default async function ChennaiWardRankingsPage() {
  const bundle = loadWardRankings("chennai");
  if (!bundle) notFound();
  return (
    <RankingsTable
      bundle={bundle}
      cityDisplayName="Chennai"
      wardDetailPathPrefix=""
    />
  );
}
