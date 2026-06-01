import type { Metadata } from "next";
import { existsSync } from "fs";
import { join } from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { TankerMarketPanel } from "@/components/dashboard/tanker-market-panel";
import { TankerExpandedContext } from "@/components/dashboard/tanker-expanded-context";

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
    description: `What households actually pay for water in ${config.displayName} - longitudinal OpenCity tanker surveys (2015 / 2019 / 2024) + 2025 follow-up.`,
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

      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {config.displayName}&apos;s tanker market
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          The informal tanker market is what households substitute when
          BWSSB&apos;s 48% non-revenue-water gap meets their tap.
          Longitudinal data from OpenCity&apos;s apartment-level surveys
          (2015, 2019, 2024) plus the 2025 follow-up tells the story of
          how the price, frequency, and BWSSB-dependency of tanker use
          has shifted through pre-crisis, crisis, and post-Stage-V
          recovery years.
        </p>
      </header>

      <TankerMarketPanel cityId={cityId} cityDisplayName={config.displayName} />

      {cityId === "bangalore" && <TankerExpandedContext />}

      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          How to read these numbers
        </h2>
        <p>
          The OpenCity surveys are voluntary apartment-association responses,
          not a random population sample - the 2024 numbers in particular
          skew toward apartments that experienced supply stress (which is
          why the &quot;BWSSB supply got worse&quot; rate reaches 90%). What
          they capture cleanly is <span className="font-semibold">price evolution</span>{" "}
          across the three survey years, which moves in step with the
          Cauvery delivery + groundwater + weather variables documented in
          the engineering literature.
        </p>
        <p>
          Tanker rates here are the <span className="font-semibold">informal market</span> -
          private tanker operators charging apartment associations directly.
          BWSSB&apos;s official Kaveriwheels app rates (₹700 / 5kL via the
          tanker tariff) are typically lower but driver-assigned often
          fails (~19,000 downloads in a 14 million city, 2.8/5 rating).
          What households actually pay sits between these two prices.
        </p>
        <p>
          The <Link href={`/${cityId}`} className="text-blue-600 dark:text-blue-400 hover:underline">{config.displayName} home dashboard</Link>{" "}
          documents the structural supply chain the tanker market plugs the
          gap in: BWSSB&apos;s {1310} MLD Cauvery WTP capacity, 48% NRW, and
          the 2049 demand-deficit projection that explains why tankers are
          a long-term structural feature, not a crisis-year anomaly.
        </p>
      </section>
    </div>
  );
}
