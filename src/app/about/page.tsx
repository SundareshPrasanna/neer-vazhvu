import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "About — Neer Vazhvu",
  description: "Methodology, data sources, and assumptions behind the Chennai Water Intelligence Dashboard.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">About Neer Vazhvu</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
        An open-source water intelligence dashboard for Chennai, built to make public data accessible and actionable.
      </p>

      <Separator className="my-8" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">How &quot;Days of Water Left&quot; Works</h2>
        <p className="text-slate-600 dark:text-slate-400">
          We compute three scenarios based on current reservoir storage, daily consumption, and inflow patterns:
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Pessimistic (no rain):</span>
              <span className="text-slate-600 dark:text-slate-400"> Assumes zero inflow. Storage divided by net daily demand (consumption minus desalination).</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Current trend:</span>
              <span className="text-slate-600 dark:text-slate-400"> Uses the 7-day rolling average inflow. Storage divided by (demand minus recent inflow).</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Seasonal rains:</span>
              <span className="text-slate-600 dark:text-slate-400"> Uses the historical average inflow for this calendar month across all available years.</span>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Default Assumptions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
              <th className="pb-2 font-medium">Parameter</th>
              <th className="pb-2 font-medium">Default</th>
              <th className="pb-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">Daily consumption</td>
              <td className="py-2 font-mono">830 MLD</td>
              <td className="py-2 text-slate-500 dark:text-slate-400">CMWSSB annual report</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">Desalination output</td>
              <td className="py-2 font-mono">190 MLD</td>
              <td className="py-2 text-slate-500 dark:text-slate-400">Minjur (100) + Nemmeli (100)</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">Groundwater supply</td>
              <td className="py-2 font-mono">Not modeled</td>
              <td className="py-2 text-slate-500 dark:text-slate-400">Conservative assumption</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">Evaporation losses</td>
              <td className="py-2 font-mono">Not modeled</td>
              <td className="py-2 text-slate-500 dark:text-slate-400">Planned for V2</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Users can adjust consumption and desalination values via sliders on the dashboard.
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Data Sources</h2>
        <div className="space-y-3">
          <DataSource
            name="CMWSSB Lake Level Page"
            url="https://cmwssb.tn.gov.in/lake-level"
            description="Daily reservoir levels for 6 reservoirs (storage, inflow, outflow, rainfall)"
            frequency="Daily (scraped at 06:00 IST)"
          />
          <DataSource
            name="NASA POWER"
            url="https://power.larc.nasa.gov/"
            description="Precipitation, temperature, humidity for Chennai coordinates"
            frequency="Daily (2-day lag)"
          />
          <DataSource
            name="OpenCity Chennai"
            url="https://data.opencity.in/"
            description="Ward-wise groundwater levels (200 wards) and historical lake storage"
            frequency="Monthly"
          />
          <DataSource
            name="Kaggle Chennai Water Management"
            url="https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management"
            description="15 years of daily reservoir data (2004–2019) for historical seed"
            frequency="One-time historical"
          />
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Groundwater Map</h2>
        <p className="text-slate-600 dark:text-slate-400">
          The choropleth map shows depth to water table in metres below ground level (mbgl) for each of Chennai&apos;s 200 GCC wards.
          Lower values mean the water table is closer to the surface (healthier).
          Thresholds are based on CGWB classification for South Indian alluvial aquifers.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Year-over-year trends compare the same month across consecutive years. A change of more than 0.5m is classified as improving or declining.
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Limitations & Disclaimers</h2>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
          <li>This is an independent, educational project — not an official government tool.</li>
          <li>Estimates are approximations. Actual water availability depends on factors not modeled (groundwater, Krishna water transfer, distribution losses, industrial use).</li>
          <li>CMWSSB data may occasionally be stale (weekends, holidays). The dashboard shows a freshness indicator.</li>
          <li>Groundwater data from OpenCity may be months behind. The map always shows the most recent available period.</li>
          <li>Ward boundaries are from GCC 2022 delimitation and may not perfectly match current administrative boundaries.</li>
        </ul>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Open Source</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Neer Vazhvu is open source. The code, data pipeline, and methodology are fully transparent.
          Contributions, bug reports, and data corrections are welcome.
        </p>
      </section>
    </div>
  );
}

function DataSource({
  name,
  url,
  description,
  frequency,
}: {
  name: string;
  url: string;
  description: string;
  frequency: string;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {name}
        </a>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{frequency}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}
