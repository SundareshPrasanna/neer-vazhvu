import type { Metadata } from "next";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
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
import { TankerLedgerPanel } from "@/components/dashboard/tanker-ledger-panel";
import { BillingLedgerPanel } from "@/components/dashboard/billing-ledger-panel";
import type { BillingLedger } from "@/components/dashboard/billing-ledger-panel";
import type { TankerLedger } from "@/components/dashboard/tanker-ledger-panel";

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

  // Self-gate: only cities with tanker data expose this page. Which FILE
  // counts depends on the declared data kind - a utility-ledger city
  // (Hyderabad) has no household survey and never will, so gating on the
  // survey alone 404'd a page that was already in the nav.
  const kind = config.tankerDataKind ?? "household-survey";
  const dataPath = join(
    process.cwd(),
    "public",
    "data",
    kind === "utility-ledger" ? `${cityId}-tankers.json` : `${cityId}-tanker-survey.json`,
  );
  if (!existsSync(dataPath)) {
    notFound();
  }

  if (kind === "utility-ledger") {
    const ledger = JSON.parse(await readFile(dataPath, "utf-8")) as TankerLedger;

    // Optional: the utility's billing ledger, which shares this page's division
    // and section units. Absent -> the panel simply does not render.
    const billingPath = join(process.cwd(), "public", "data", `${cityId}-billing.json`);
    const billing = existsSync(billingPath)
      ? (JSON.parse(await readFile(billingPath, "utf-8")) as BillingLedger)
      : null;
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

        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {config.displayName} tanker demand
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            {config.displayName} is one of the few Indian cities where the water
            utility runs the tanker fleet itself and publishes the record.
            HMWSSB logs every booking and every delivery by division and
            section, so this page shows measured demand rather than a surveyed
            price.
          </p>
        </header>

        <TankerLedgerPanel ledger={ledger} cityDisplayName={config.displayName} />

        {billing && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <BillingLedgerPanel
              billing={billing}
              tankerSections={ledger.sections}
              cityDisplayName={config.displayName}
            />
          </div>
        )}
      </div>
    );
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
