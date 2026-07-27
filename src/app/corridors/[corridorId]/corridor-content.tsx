"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import type { CorridorManifest } from "@/lib/corridors";
import type { CorridorAssessment } from "@/lib/corridors/types";
import { AssessmentTable } from "@/components/corridor/assessment-table";
import { ChembarambakkamPanel } from "@/components/corridor/chembarambakkam-panel";

const CorridorMap = dynamic(
  () => import("@/components/corridor/corridor-map").then((m) => m.CorridorMap),
  { ssr: false, loading: () => <div className="h-[460px] sm:h-[540px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" /> },
);

interface CrosscheckSummary {
  taluk_matches: number;
  firka_matches: number;
  mismatches: number;
  taluk_rows_located_in_pdf: string;
  firka_rows_located_in_pdf: string;
}

interface CorridorContentProps {
  manifest: CorridorManifest;
  assessment: CorridorAssessment;
  crosscheck: CrosscheckSummary | null;
}

/**
 * Milestone 1 corridor page. The site header/footer suppress themselves on
 * /corridors (city-scoped nav would mislabel this surface), so this component
 * carries its own compact chrome. All numbers come from the build pipeline
 * and were cross-checked against the CGWB state report and national
 * categorization PDFs before this prose was written (DECISIONS.md D12d).
 */
export function CorridorContent({ manifest, assessment, crosscheck }: CorridorContentProps) {
  const retrieved = assessment._provenance.retrieved;
  const latest = manifest.latestEdition;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Compact corridor chrome */}
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Neer Vazhvu
          </Link>
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Industrial Corridor
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {/* ---- Verdict-first hero ---- */}
        <section className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {manifest.displayName}
          </h1>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            What is the aquifer under Chennai&apos;s manufacturing belt actually
            doing? In the regulator&apos;s {latest} assessment, the answer is{" "}
            <strong>Safe, with four asterisks</strong>.
          </p>
          <ol className="list-decimal ml-5 space-y-2 text-sm sm:text-base">
            <li>
              <strong>The taluks hosting the parks are classified Safe.</strong>{" "}
              Every SIPCOT estate here sits in Sriperumbudur taluk (24.5% stage
              of extraction in the {latest}{" "}edition) or spills into
              neighbouring Kundrathur (27.9%), and 8 of the corridor&apos;s 10
              taluks are Safe. The two Semi-Critical taluks are Avadi (83.2%)
              on the northern rim and Chengalpattu (78.8%), which hosts
              Mahindra World City. The longer arc is improvement: the 2017
              edition counted 22 over-exploited firkas across undivided
              Kancheepuram and Tiruvallur; the {latest} edition counts 5 across
              all three successor districts.
            </li>
            <li>
              <strong>Taluk averages hide stressed units.</strong>{" "}Of the
              corridor&apos;s 47 firkas, 4 are Over-Exploited and 1 is Critical
              in the {latest}{" "}edition, and all five sit inside taluks whose
              headline class is Safe or Semi-Critical. The map&apos;s firka view
              shows what the official taluk tables average away.
            </li>
            <li>
              <strong>
                Extraction permission in this corridor is legally dense and
                publicly untraceable.
              </strong>{" "}
              Tamil Nadu regulates groundwater through a state executive-order
              scheme, not through CGWA, and no authority in the chain, state or
              central, publishes a register of the permissions it has granted
              here. The rules section below documents who actually issues them.
            </li>
            <li>
              <strong>
                The parks&apos; documented lifeline is surface water, not the
                aquifer.
              </strong>{" "}
              SIPCOT&apos;s own clearance filings put the estates on CMWSSB
              supply from Chembarambakkam plus treated reuse water, with
              groundwater &quot;drawl&quot; prohibited under at least one
              park&apos;s EC. The corridor&apos;s water risk runs through a
              reservoir it shares with the city.
            </li>
          </ol>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All data retrieved {retrieved}. Every number on this page carries
            its assessment edition and source; the methodology section lists
            all of them. This is an independent, educational project, not a
            government tool.{" "}
            <a
              href={`/data/corridors/${manifest.corridorId}/sriperumbudur-corridor-brief.pdf`}
              className="underline text-slate-600 dark:text-slate-300"
            >
              Download the two-page brief (PDF)
            </a>
            .
          </p>
        </section>

        {/* ---- Map ---- */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            The regulator&apos;s own map, at the unit it assesses
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tamil Nadu assesses groundwater at revenue-firka level. The firka
            view renders CGWB&apos;s own unit geometry and classification; the
            taluk view is what official tables publish from the 2023 edition
            onward. The two views are a deliberate pair: compare them over
            Walajabad or Poonamallee to see a Critical or Over-Exploited firka
            disappear into a Safe average.
          </p>
          <CorridorMap manifest={manifest} />
        </section>

        {/* ---- Table ---- */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Every taluk, three editions
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Editions 2023, 2024 and {latest} use identical taluk units, so the
            trend column compares like with like. Arrows follow a fixed rule:
            flat when the net change across the three editions is within 2
            percentage points; rising or falling only when both inter-edition
            steps move in the net direction; mixed otherwise. Earlier editions
            used different units and district boundaries and are deliberately
            not arrowed against these numbers (see methodology).
          </p>
          <AssessmentTable rows={assessment.table} editions={manifest.editions} />
          {crosscheck && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verification: every value above was cross-checked against two
              independent publications of the same assessment, the CGWB and TN
              WRD state report (firka annexure) and the national block-wise
              categorization list: {crosscheck.taluk_rows_located_in_pdf} taluk
              rows and {crosscheck.firka_rows_located_in_pdf} firka rows
              located, {crosscheck.mismatches} mismatches.
            </p>
          )}
        </section>

        {/* ---- What changed ---- */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            What changed across recent assessments
          </h2>
          <div className="space-y-3 text-sm sm:text-base text-slate-700 dark:text-slate-300">
            <p>
              <strong>No corridor taluk changed class</strong>{" "}between the 2024
              and {latest} editions; the classifications above have been stable
              across all three comparable editions. The movement is in the
              stage of extraction: since the 2023 edition, Chengalpattu taluk
              eased from 85.0% to 78.8%, Vandalur from 64.3% to 55.4%, and
              Thirupporur from 59.0% to 52.1%, while Sriperumbudur rose from
              21.0% to 24.5% and Kancheepuram from 47.7% to 51.0%, both from
              low bases.
            </p>
            <p>
              The five stressed firkas are persistent, not new: Chengalpattu
              (108.4% stage in the {latest} state annexure) and Appur (125.9%)
              in Chengalpattu taluk, Thirumullaivoyal (109.2%) in Avadi and
              Vayalanallur (101.5%) in Poonamallee have been Over-Exploited,
              and Walajabad firka (99.2%) Critical, in each of the last three
              editions. Outside the corridor but in its districts, one real
              class change: Tiruttani taluk slipped from Safe to Semi-Critical
              (70.3%) in the {latest} edition.
            </p>
            <p>
              <strong>The longer arc, stated with its caveat:</strong>{" "}in the
              2017 edition, assessed on different units and pre-2019 district
              boundaries, undivided Kancheepuram had 11 over-exploited and 6
              critical firkas of 75, and Tiruvallur 11 over-exploited of 58. In
              the {latest} edition the three successor districts together count
              5 over-exploited and 4 critical firkas of 113. The unit
              definitions and boundaries differ, so we state the comparison in
              counts and do not draw trend arrows across it. Tiruvallur
              district also carries one firka classed saline (the Minjur
              belt), which CGWB does not assess on extraction at all.
            </p>
          </div>
        </section>

        {/* ---- Chembarambakkam dependency (D11) ---- */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            The risk the data does support
          </h2>
          <ChembarambakkamPanel />
        </section>

        {/* ---- Rules ---- */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            What the rules actually are here
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Most national commentary applies the CGWA framework to every Indian
            factory. In this corridor that is wrong in a specific, documented
            way. Two panels: who actually issues extraction permissions here,
            and what the national framework says, with its status in Tamil Nadu
            labeled.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 text-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Panel 1: the regime that governs this corridor
              </h3>
              <p>
                Tamil Nadu repealed its Groundwater (Development and
                Management) Act 2003 by Act 23 of 2013, in force from 14
                September 2013, and has enacted no replacement statute. What
                operates is an executive scheme: G.O. Ms. No. 51, Public Works
                Department, 11.02.2004 gates scheme approvals on the
                assessment categories, and G.O. Ms. No. 142, PWD, 23.07.2014
                requires a No Objection Certificate for commercial groundwater
                extraction, upheld by the Madras High Court in October 2018.
              </p>
              <p>
                The issuer is the State Ground and Surface Water Resources Data
                Centre (SG&amp;SWRDC) of the Water Resources Department,
                through e-District service WRD-101 (Rs 6,000 per well, 40-day
                service window). The enforcement hook, recorded by the CAG
                (Report 9 of 2021, chapter 3), is that TNPCB and BIS grant
                their consents only after the state NOC.
              </p>
              <p>
                The Chennai Metropolitan Area Groundwater (Regulation) Act 1987
                licenses wells in Chennai city and the revenue villages listed
                in its own Schedule. Its reach is the Schedule, not the
                planning boundary: the 2022 expansion of the Chennai
                Metropolitan Area to 5,904 sq km (G.O. Ms. No. 184, Housing and
                Urban Development, 21.10.2022) brought Sriperumbudur taluk
                inside the planning area, but no Schedule notification under
                section 17-A has been found, so the 1987 Act does not, on the
                record we could locate, cover the corridor&apos;s parks.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 text-sm">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Panel 2: the CGWA framework, and its status here
              </h3>
              <p>
                CGWA&apos;s guidelines (S.O. 3289(E), 24 September 2020, as
                amended in March 2023) tier obligations by assessment category:
                no NOCs for new non-MSME industry in Over-Exploited units
                (para 4.1); mandatory annual water audits for industries
                abstracting over 100 m3/day, with a 20% reduction over three
                years (para 4.1(iii)); mandatory rooftop recharge; tiered
                abstraction and restoration charges (para 5); and flow meters
                with telemetry plus piezometers scaled to withdrawal (paras 9
                and 14).
              </p>
              <p>
                <strong>Status in Tamil Nadu, with the record attached:</strong>{" "}
                CGWA&apos;s own state list names Tamil Nadu among the states
                where it does not issue NOCs; the state-wise annexure of every
                NOC CGWA issued from 2017 to 2023 (Rajya Sabha Unstarred
                Question 2971, answered 27.03.2023) contains no Tamil Nadu row;
                CGWA&apos;s notified-areas list contains no Tamil Nadu entry;
                and when CGWA issued a public notice on extraction in July
                2022, the SG&amp;SWRDC publicly clarified that it does not
                apply to Tamil Nadu. The 2020 guidelines nonetheless claim
                pan-India applicability on their face. That tension is
                documented and unresolved; we state it rather than resolve it.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                For auditors: the categories on this page are still the ones
                the CGWA tiers reference, and TN&apos;s own G.O. regime gates
                scheme approvals on the same categories.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
            <strong>The named gap:</strong>{" "}there is no known public register
            of groundwater extraction permissions covering this corridor. The
            CGWA-side portal register did not survive the NOCAP-to-BhuNeer
            migration, and no known public list is published by SG&amp;SWRDC
            (state NOCs) or CMWSSB (1987 Act licenses). The nearest public
            instrument is TNPCB&apos;s consent database, which records
            permitted effluent discharge, not water intake. Extraction
            permission in this corridor is legally dense and publicly
            untraceable; that finding is part of what this page documents.
          </div>
        </section>

        {/* ---- Methodology & sources ---- */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Methodology, sources, and what we do not claim
          </h2>
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <p>
              <strong>Units and editions.</strong>{" "}Tamil Nadu assesses
              groundwater at revenue-firka level in every state edition (1,202
              firkas in the {latest} edition); from the 2023 cycle the
              national compilation apportions results to taluks. This page
              renders firka classifications, firka stage percentages (from the
              state report annexure), and taluk stage percentages from the
              same assessment. Trend arrows compare only editions 2023, 2024
              and {latest}, which use identical units, under a stated rule:
              flat when the net change across the three editions is within 2
              percentage points; rising or falling only when both
              inter-edition steps move in the net direction; mixed otherwise.
              Earlier editions (firka-based 2020 and 2022; pre-split districts
              through 2017) appear as context prose only, never as arrows.
            </p>
            <p>
              <strong>Geometry.</strong>{" "}Firka polygons are CGWB&apos;s own
              assessment-unit geometry from the IN-GRES GeoServer, joined to
              assessment categories by unit uuid; taluk shapes are dissolved
              from those firkas. Park outlines are the SIPCOT GIS outer
              boundaries. No boundary on this page was digitized, estimated or
              interpolated by us. There is no interpolation anywhere on this
              page.
            </p>
            <p>
              <strong>Verification.</strong>{" "}Before publication, every taluk
              value and every firka classification was cross-checked across
              two independent publications of the same assessment, the state
              report PDF (CGWB SECR and TN SG&amp;SWRDC, {latest} edition) and
              the national block-wise categorization list
              {crosscheck ? ` (${crosscheck.taluk_matches} taluk and ${crosscheck.firka_matches} firka matches, ${crosscheck.mismatches} mismatches)` : ""}.
              Firka stage percentages come from the state report annexure
              alone, because the machine-served series does not carry them;
              the annexure&apos;s classification for each of the 47 firkas is
              enforced to agree with the served classification, and the build
              fails rather than publish a disagreement. Had any publications
              disagreed, both numbers would be shown.
            </p>
            <p>
              <strong>What we do not claim.</strong>{" "}Park locations are facts
              from public records. This page does not state or imply that any
              company or park is depleting the aquifer, is non-compliant, or is
              responsible for any unit&apos;s classification. Our data cannot
              support attribution of aquifer status to any actor, and we do
              not attempt it. Where a park&apos;s water source is described,
              the statement comes from that park&apos;s own clearance
              documents, cited per park; parks without a fetched document say
              so.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {[
              {
                name: "Dynamic Ground Water Resource Assessment (CGWB and TN SG&SWRDC), served by IN-GRES",
                url: "https://ingres.iith.ac.in/",
                freq: `annual (editions 2023, 2024, ${latest}; retrieved ${retrieved})`,
                desc: "Classification, stage of extraction, recharge and draft per assessment unit. The taluk series is the national apportionment of TN's firka assessment. GoI publication, cited with attribution.",
              },
              {
                name: "IN-GRES GeoServer, layer gec:indgec_vers_tamilnadu",
                url: "https://ingres.iith.ac.in/geoserver/ows",
                freq: `per assessment cycle (year=2022 vintage; retrieved ${retrieved})`,
                desc: "CGWB's own firka polygons, joined to categories by unit uuid. The uuid join is asserted by the build script and fails loudly if the vintage drifts.",
              },
              {
                name: "Dynamic Ground Water Resources of Tamil Nadu, state report PDF",
                url: "https://cgwb.gov.in/",
                freq: `annual (${latest} edition; retrieved ${retrieved})`,
                desc: "The published firka-level annexure used to cross-check every classification on this page.",
              },
              {
                name: "SIPCOT GIS, Government of Tamil Nadu",
                url: "https://sipcotgis.tn.gov.in/",
                freq: `retrieved ${retrieved}`,
                desc: "Park outer boundaries (cadastral fidelity). Outer boundaries only; plot-level data is deliberately not rendered. Reuse confirmation requested from SIPCOT; boundaries carry attribution pending reply.",
              },
              {
                name: "SIPCOT environmental clearance compliance reports and EIA summaries",
                url: "https://sipcotweb.tn.gov.in/Compliance_Report",
                freq: `half-yearly filings (latest June 2026; retrieved ${retrieved})`,
                desc: "Per-park water requirement and source declarations (e.g. Pillaipakkam, EC ID EC22B039TN146946: 1 MGD, CMWSSB Chembarambakkam and TTRO, no groundwater drawl permitted). Cited per park.",
              },
              {
                name: "CGWA guidelines S.O. 3289(E) of 24.09.2020 and the TN instruments (Act 23 of 2013, G.O. 51/2004, G.O. 142/2014, 1987 CMA Act, G.O. 184/2022)",
                url: "https://cgwb.gov.in/en/ground-water-regulation",
                freq: `statutes and notifications (retrieved ${retrieved})`,
                desc: "The full citation set behind the rules panels, including the Rajya Sabha UQ 2971 annexure (27.03.2023) and CAG Report 9 of 2021 chapter 3.",
              },
              {
                name: "SG&SWRDC clarification that CGWA's 2022 public notice does not apply to Tamil Nadu (DT Next, 06.07.2022)",
                url: "https://www.dtnext.in/tamilnadu/2022/07/06/cgwa-notice-on-groundwater-extraction-not-applicable-for-tn",
                freq: `news record (retrieved ${retrieved})`,
                desc: "The state data centre's on-record statement that CGWA's extraction notice \"does not apply for TN as we function with our own State department\". This is the specific anchor for the inoperative-in-practice label in panel 2.",
              },
              {
                name: "CMWSSB daily reservoir readings (Chembarambakkam)",
                url: "https://cmwssb.tn.gov.in/",
                freq: "daily",
                desc: "The storage series in the dependency panel, identical to the Chennai dashboard's.",
              },
            ].map((s) => (
              <div key={s.name} className="p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-900 dark:text-slate-100 underline decoration-slate-300 dark:decoration-slate-600"
                  >
                    {s.name}
                  </a>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{s.freq}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-sm space-y-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Named gaps</h3>
            <ul className="list-disc ml-5 space-y-1 text-slate-700 dark:text-slate-300">
              <li>
                No known public register of extraction permissions from any of
                the three authorities whose writ runs here (see the rules
                section).
              </li>
              <li>
                Firka stage percentages exist in one publication only (the
                state report annexure); the machine-served assessment series
                carries firka classifications without stages, so no second
                source exists to cross-check those percentages against.
              </li>
              <li>
                No known public CGWB district brochure or District Environment
                Plan exists for post-2019 Chengalpattu district.
              </li>
              <li>
                One Hub Chennai (private) has no known public boundary and is
                not drawn.
              </li>
              <li>
                The consolidated current Schedule of the 1987 CMA Groundwater
                Act (243 or 302 villages, sources disagree) could not be
                retrieved; both counts are reported.
              </li>
              <li>
                Well-level water level time series exist (223 stations across
                the three districts, live through June 2026) and are planned
                for the next milestone, not shown yet.
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p>
            An open-source, independent public-information project.{" "}
            <Link href="/" className="underline">neervazhvu.org</Link> · Contact:{" "}
            <a href="mailto:contact@neervazhvu.org" className="underline">contact@neervazhvu.org</a>
          </p>
          <p>
            Data: CGWB / TN SG&amp;SWRDC (IN-GRES), SIPCOT GIS, CMWSSB, and the
            cited statutes and filings. Base map © OpenStreetMap contributors.
          </p>
        </div>
      </footer>
    </div>
  );
}
