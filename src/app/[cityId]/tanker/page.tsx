import type { Metadata } from "next";
import { existsSync } from "fs";
import { join } from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { TankerMarketPanel } from "@/components/dashboard/tanker-market-panel";
import {
  TankerExpandedContext,
  TankerDataGaps,
} from "@/components/dashboard/tanker-expanded-context";
import { IIScStressWardsMap } from "@/components/dashboard/iisc-stress-wards-map";
import { TankerPageHeader, TankerPageFooter } from "@/components/dashboard/tanker-page-chrome";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Tanker market | Neer Vazhvu" };
  return {
    title: `${config.displayName} tanker market | Neer Vazhvu`,
    description:
      config.tankerSummary ??
      `What households actually pay for water in ${config.displayName} - longitudinal OpenCity tanker surveys (2015 / 2019 / 2024) + 2025 follow-up.`,
    alternates: { canonical: `/${cityId}/tanker` },
  };
}

export default async function CityTankerPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Self-gate: only cities with a tanker-survey JSON expose this page.
  // Avoids a broken-link surface for Chennai/Madurai where the survey
  // doesn't exist.
  const surveyPath = join(
    process.cwd(),
    "public",
    "data",
    `${cityId}-tanker-survey.json`,
  );
  if (!existsSync(surveyPath)) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <nav className="text-xs text-slate-500 dark:text-slate-400">
        <Link
          href={`/${cityId}`}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← {config.displayName} dashboard
        </Link>
      </nav>

      <TankerPageHeader cityId={cityId} cityDisplayName={config.displayName} />

      <TankerMarketPanel cityId={cityId} cityDisplayName={config.displayName} />

      {cityId === "bangalore" && <TankerExpandedContext />}
      {cityId === "bangalore" && <IIScStressWardsMap />}
      {cityId === "bangalore" && <TankerDataGaps />}

      <TankerPageFooter cityId={cityId} cityDisplayName={config.displayName} />
    </div>
  );
}
