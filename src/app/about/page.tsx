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
        <div className="overflow-x-auto">
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
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Users can adjust consumption and desalination values via sliders on the dashboard.
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Data Sources &amp; Aggregation</h2>
        <p className="text-slate-600 dark:text-slate-400">
          All data is collected automatically by our Python pipeline, which runs daily at 06:00 IST.
          Raw data is upserted into Supabase (PostgreSQL) and processed through ETL and intelligence stages.
        </p>
        <div className="space-y-3">
          <DataSource
            name="CMWSSB Lake Level Page"
            url="https://cmwssb.tn.gov.in/lake-level"
            description="Daily reservoir levels for 6 reservoirs: Poondi, Cholavaram, Red Hills, Chembarambakkam, Veeranam, and Kannankottai. Includes storage (mcft), water level (ft), inflow/outflow (cusecs), and rainfall (mm)."
            frequency="Daily (scraped at 06:00 IST)"
          />
          <DataSource
            name="NASA POWER"
            url="https://power.larc.nasa.gov/"
            description="Satellite-derived weather data for Chennai (13.08°N, 80.27°E): precipitation, max/min temperature, and relative humidity. No API key required."
            frequency="Daily (2-day lag)"
          />
          <DataSource
            name="OpenCity Chennai (Groundwater)"
            url="https://data.opencity.in/"
            description="Ward-wise depth to water table (metres below ground level) for all 200 GCC wards across 15 zones. Sourced from CGWB/GCC monitoring wells. Data available from 2021 onwards."
            frequency="Monthly (fetched days 1–3)"
          />
          <DataSource
            name="OpenCity Chennai (Lake Storage)"
            url="https://data.opencity.in/"
            description="Monthly reservoir storage data (mcft) for all 6 reservoirs, spanning 2003–2021. Used as historical seed for the forecasting model."
            frequency="Historical (2003–2021)"
          />
          <DataSource
            name="Kaggle Chennai Water Management"
            url="https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management"
            description="15 years of daily reservoir data (2004–2019) compiled by Sudalai Rajkumar. Used as additional historical training data for the forecasting model."
            frequency="One-time historical seed"
          />
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Intelligence Layer</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Beyond raw data display, Neer Vazhvu runs three intelligence modules daily to generate actionable insights.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Ward Risk Scoring:</span>
              <span className="text-slate-600 dark:text-slate-400"> Each of Chennai&apos;s 200 wards receives a composite risk score (0–100) based on groundwater depth (40%), year-over-year trend (30%), city-wide reservoir stress (20%), and seasonal vulnerability (10%). Scores are fully explainable.</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Daily Briefing:</span>
              <span className="text-slate-600 dark:text-slate-400"> A template-based intelligence summary generated each morning with a headline, key metrics, threshold-based alerts, and actionable recommendations. No LLM required — purely data-driven.</span>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reservoir Forecasting</h2>
        <p className="text-slate-600 dark:text-slate-400">
          The dashed violet line on the storage trend chart shows an ARIMAX-based forecast for each reservoir, extending 6 months into the future. The shaded band around it represents an 80% confidence interval — the range within which actual storage is expected to fall, 4 out of 5 times.
        </p>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Technique</h3>
        <p className="text-slate-600 dark:text-slate-400">
          We use <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">AutoARIMA</span> from
          the <a href="https://nixtla.github.io/statsforecast/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">statsforecast</a> library with <span className="font-medium">exogenous regressors</span> (ARIMAX). AutoARIMA automatically selects the best ARIMA(p,d,q) order and seasonal component by testing multiple model configurations and choosing the one with the lowest information criterion (AICc).
        </p>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
          <li>Each reservoir is forecasted independently — six separate models are fitted.</li>
          <li>The model is re-trained daily as new data arrives from the CMWSSB scraper.</li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Exogenous variables:</span> Inflow and outflow (cusecs) are fed as external regressors alongside storage. This lets the model respond more quickly to changing flow conditions (e.g. early monsoon onset or unexpected dry spells) rather than relying solely on historical storage trends.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Future flow estimation:</span> Since future inflow/outflow are unknown, the model uses historical seasonal averages — mean flow for each day-of-year (daily) or month (monthly) — as proxy values for the forecast horizon.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Graceful fallback:</span> If a reservoir has sparse inflow/outflow data (less than 30% non-zero in the last 2 years), the model automatically falls back to pure ARIMA without exogenous variables.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Seasonal detection:</span> The pipeline auto-detects data frequency. With weekly CMWSSB data (median gap &le; 15 days), it uses daily frequency with a 365-day seasonal period. With monthly OpenCity data, it uses a 12-month seasonal period.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Minimum data requirement:</span> At least 24 historical data points per reservoir. If fewer than 2 full seasonal cycles are available, the model falls back to non-seasonal ARIMA.
          </li>
          <li>All predictions are clamped to [0, reservoir capacity] — the model cannot predict negative storage or more than 100% full.</li>
        </ul>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Training Data</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">OpenCity CKAN (lake storage)</td>
                <td className="py-2 font-mono">2003–2021</td>
                <td className="py-2">Monthly storage only</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">CMWSSB scraper (backfill)</td>
                <td className="py-2 font-mono">2022–present</td>
                <td className="py-2">Storage + inflow/outflow</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">CMWSSB scraper (daily)</td>
                <td className="py-2 font-mono">Ongoing</td>
                <td className="py-2">Storage + inflow/outflow</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">What the Forecast Does Not Model</h3>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Rainfall predictions:</span> The model uses historical seasonal flow patterns as future proxies but does not incorporate real-time weather forecasts. An unusually dry or wet spell will widen the actual vs. predicted gap.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Policy decisions:</span> Emergency releases, inter-basin transfers (e.g. Krishna water), or rationing orders are not captured.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Demand changes:</span> The model forecasts supply (storage levels), not demand. Population growth, industrial usage shifts, or seasonal consumption patterns are not inputs.
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">Evaporation:</span> While implicitly captured in historical depletion patterns, explicit evaporation modeling (which varies with temperature and surface area) is not included.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Reading the Chart</h3>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-0.5 bg-blue-500 flex-shrink-0" />
            <span><span className="font-medium text-slate-700 dark:text-slate-300">Solid blue line/area:</span> Actual recorded storage (historical data)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-0.5 border-t-2 border-dashed border-violet-500 flex-shrink-0" />
            <span><span className="font-medium text-slate-700 dark:text-slate-300">Dashed violet line:</span> ARIMAX forecast (predicted storage)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-3 bg-violet-500/10 rounded flex-shrink-0" />
            <span><span className="font-medium text-slate-700 dark:text-slate-300">Violet shaded band:</span> 80% confidence interval — actual values are expected to fall within this range most of the time</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-0.5 bg-green-600 flex-shrink-0" />
            <span><span className="font-medium text-slate-700 dark:text-slate-300">Green line (toggle):</span> Inflow (cusecs) — right Y-axis</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-0.5 bg-red-600 flex-shrink-0" />
            <span><span className="font-medium text-slate-700 dark:text-slate-300">Red line (toggle):</span> Outflow (cusecs) — right Y-axis</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-0.5 border-t-2 border-dashed border-slate-400 flex-shrink-0" />
            <span><span className="font-medium text-slate-700 dark:text-slate-300">Dashed grey line:</span> Reservoir capacity (when viewing a single reservoir)</span>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The forecast updates automatically each time the daily pipeline runs. Use the Inflow/Outflow checkboxes to overlay flow data on a dual Y-axis (storage in mcft on the left, flow in cusecs on the right). Click any reservoir card to see its individual forecast; click &quot;All Reservoirs&quot; to return to the combined view.
        </p>
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
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Disclaimer</h2>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Not an official government tool.</span>{" "}
            Neer Vazhvu is an independent, open-source project. It is not affiliated with, endorsed by, or connected to CMWSSB, GCC, CGWB, or any government body.
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Informational purposes only.</span>{" "}
            All data, estimates, and forecasts are provided &quot;as is&quot; for general awareness. They should not be used as the sole basis for emergency planning, policy decisions, or any action where inaccurate information could cause harm. Always refer to official CMWSSB advisories for critical decisions.
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">No warranty.</span>{" "}
            We make no guarantees about the accuracy, completeness, or timeliness of the data displayed. Upstream sources (CMWSSB, OpenCity, NASA POWER) may contain errors, lag, or go offline without notice.
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">No personal data collected.</span>{" "}
            Neer Vazhvu does not collect, store, or process any personal information. There are no user accounts, cookies, or analytics trackers. All data shown is derived from publicly available government sources.
          </p>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Known Limitations</h2>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
          <li>Estimates are approximations. Actual water availability depends on factors not modeled (groundwater extraction, Krishna water transfer, distribution losses, industrial use).</li>
          <li>CMWSSB data may occasionally be stale (weekends, holidays). The dashboard shows a freshness indicator.</li>
          <li>Groundwater data from OpenCity may lag by months. The map always shows the most recent available period.</li>
          <li>Ward boundaries are from GCC 2022 delimitation and may not perfectly match current administrative boundaries.</li>
          <li>Forecasts use ARIMAX (AutoARIMA with inflow/outflow as exogenous regressors) and work best with 2+ years of daily data. Future inflow/outflow are estimated from historical seasonal averages, not real-time weather forecasts. With monthly historical data, predictions are at month-level granularity.</li>
          <li>Risk scores are relative indicators for comparison between wards, not absolute measures of water safety.</li>
        </ul>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Open Source</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Neer Vazhvu is fully open source. The code, data pipeline, and methodology are transparent and available on GitHub.
          Contributions, bug reports, and data corrections are welcome.
        </p>
        <a
          href="https://github.com/SundareshPrasanna/neer-vazhvu"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          View on GitHub
        </a>
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
