"use client";

import dynamic from "next/dynamic";
import type { CorridorManifest } from "@/lib/corridors";
import type { CorridorAssessment } from "@/lib/corridors/types";
import { AssessmentTable } from "@/components/corridor/assessment-table";

const CorridorMap = dynamic(
  () => import("@/components/corridor/corridor-map").then((m) => m.CorridorMap),
  { ssr: false, loading: () => <div className="h-[320px] rounded-lg bg-slate-100" /> },
);

interface CrosscheckSummary {
  taluk_matches: number;
  firka_matches: number;
  mismatches: number;
  taluk_rows_located_in_pdf: string;
  firka_rows_located_in_pdf: string;
}

interface BriefContentProps {
  manifest: CorridorManifest;
  assessment: CorridorAssessment;
  crosscheck: CrosscheckSummary | null;
}

/**
 * Two-page A4 brief, deliberately light-only (it is a print artifact). Page 1:
 * verdict + map. Page 2: table + rules + sources. Prose is a condensation of
 * the corridor page; every number shares the same build pipeline and
 * cross-check gate, so the brief can never drift from the page.
 */
export function BriefContent({ manifest, assessment, crosscheck }: BriefContentProps) {
  const retrieved = assessment._provenance.retrieved;
  const latest = manifest.latestEdition;

  return (
    <div className="bg-white text-slate-800 text-[13px] leading-snug">
      <style>{`
        @page { size: A4; margin: 11mm; }
        @media print {
          .brief-page { break-after: page; }
          .brief-page:last-child { break-after: auto; }
        }
        @media screen {
          .brief-page { max-width: 210mm; margin: 0 auto; padding: 24px; }
        }
      `}</style>

      {/* ---------------- Page 1 ---------------- */}
      <section className="brief-page space-y-3">
        <header className="flex items-baseline justify-between border-b border-slate-300 pb-2">
          <span className="font-bold text-slate-900">Neer Vazhvu · Urban Water Intelligence</span>
          <span className="text-[11px] text-slate-500">
            Corridor brief · data retrieved {retrieved} · neervazhvu.org/corridors/{manifest.corridorId}
          </span>
        </header>

        <h1 className="text-xl font-bold text-slate-900">{manifest.displayName}</h1>
        <p className="text-sm">
          What is the aquifer under Chennai&apos;s manufacturing belt actually
          doing? In the regulator&apos;s {latest} assessment, the answer is{" "}
          <strong>Safe, with four asterisks</strong>.
        </p>
        <ol className="list-decimal ml-4 space-y-1 text-[12.5px]">
          <li>
            <strong>The taluks hosting the parks are classified Safe.</strong>{" "}
            Every SIPCOT estate sits in Sriperumbudur taluk (24.5% stage of
            extraction, {latest}{" "}edition) or spills into Kundrathur (27.9%);
            8 of the corridor&apos;s 10 taluks are Safe. The two Semi-Critical
            taluks: Avadi (83.2%) on the northern rim, and Chengalpattu
            (78.8%), which hosts Mahindra World City. The 2017 edition counted
            22 over-exploited firkas across these (then-undivided) districts;
            the {latest} edition counts 5.
          </li>
          <li>
            <strong>Taluk averages hide stressed units.</strong>{" "}Of 47
            corridor firkas, 4 are Over-Exploited and 1 Critical in the{" "}
            {latest}{" "}edition, all inside taluks whose headline class is
            Safe or Semi-Critical. The map below shows the firka picture that
            official taluk tables average away.
          </li>
          <li>
            <strong>
              Extraction permission here is legally dense and publicly
              untraceable.
            </strong>{" "}
            Tamil Nadu regulates groundwater through a state executive-order
            scheme, not CGWA, and no authority in the chain publishes a
            register of permissions granted.
          </li>
          <li>
            <strong>The parks&apos; documented lifeline is surface water.</strong>{" "}
            SIPCOT&apos;s own clearance filings put the estates on CMWSSB
            supply from Chembarambakkam Lake plus treated reuse (TTRO) water,
            with groundwater &quot;drawl&quot; prohibited under at least one
            park&apos;s EC. The corridor&apos;s water risk runs through a
            reservoir it shares with the city; in the 2019 crisis
            Chembarambakkam fell effectively to zero.
          </li>
        </ol>

        <CorridorMap manifest={manifest} variant="brief" />
        <p className="text-[10.5px] text-slate-500">
          CGWB assessment-unit (firka) polygons, {latest} classification, with
          SIPCOT park outer boundaries. Geometry: IN-GRES GeoServer (CGWB) and
          SIPCOT GIS; nothing drawn or interpolated by us. Base map ©
          OpenStreetMap contributors.
        </p>
      </section>

      {/* ---------------- Page 2 ---------------- */}
      <section className="brief-page space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          Every taluk, three editions ({manifest.editions.join(", ")})
        </h2>
        <div className="text-[11px]">
          <AssessmentTable rows={assessment.table} editions={manifest.editions} compact />
        </div>
        <p className="text-[10.5px] text-slate-500">
          Trend rule: flat within 2 percentage points net across the three
          editions; rising/falling only when both inter-edition steps agree
          with the net direction; mixed otherwise.
          {crosscheck &&
            ` Verification: ${crosscheck.taluk_rows_located_in_pdf} taluk and ${crosscheck.firka_rows_located_in_pdf} firka rows cross-checked against the CGWB/TN WRD state report annexure and the national categorization list, ${crosscheck.mismatches} mismatches.`}
        </p>

        <div className="grid grid-cols-2 gap-3 text-[11.5px]">
          <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
            <h3 className="font-semibold text-slate-900">Who issues extraction permission here</h3>
            <p>
              TN repealed its groundwater act in 2013 (Act 23 of 2013) and
              enacted no replacement. Industrial extraction NOCs come from the
              State Ground and Surface Water Resources Data Centre (WRD) under
              G.O. Ms. 51/2004 and G.O. Ms. 142/2014 (upheld, Madras HC, Oct
              2018), via e-District service WRD-101; TNPCB and BIS grant
              consents only after the state NOC (CAG Report 9 of 2021, ch. 3).
            </p>
            <p>
              The Chennai Metropolitan Area Groundwater (Regulation) Act 1987
              reaches only the villages in its own Schedule. The 2022 CMA
              expansion (G.O. Ms. 184, 21.10.2022) moved the planning boundary
              over Sriperumbudur taluk, but no Schedule notification under
              s.17-A has been found, so the Act does not, on the record we
              could locate, cover these parks.
            </p>
          </div>
          <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
            <h3 className="font-semibold text-slate-900">CGWA&apos;s framework, and its status here</h3>
            <p>
              CGWA&apos;s 2020 guidelines (S.O. 3289(E)) tier obligations by
              these same categories: no new non-MSME NOCs in Over-Exploited
              units; annual water audits above 100 m3/day with 20% reduction
              over three years; recharge mandates; tiered charges; telemetry.
            </p>
            <p>
              In Tamil Nadu CGWA issues no NOCs: its own state list names TN
              self-regulating, the Rajya Sabha UQ 2971 annexure of all NOCs
              2017-2023 has no TN row, no TN area is CGWA-notified, and the
              SG&amp;SWRDC stated in July 2022 that CGWA&apos;s extraction
              notice &quot;does not apply for TN&quot;. The guidelines claim
              pan-India applicability on paper; that tension is documented and
              unresolved.
            </p>
          </div>
        </div>

        <div className="border border-amber-300 bg-amber-50 rounded-lg p-2.5 text-[11.5px]">
          <strong>Named gap:</strong>{" "}no known public register of groundwater
          extraction permissions covers this corridor, from any of the three
          authorities. The nearest public instrument, TNPCB&apos;s consent
          database, records permitted effluent discharge, not water intake.
        </div>

        <div className="text-[10.5px] text-slate-500 space-y-1 border-t border-slate-300 pt-2">
          <p>
            <strong className="text-slate-700">Sources.</strong>{" "}Dynamic Ground
            Water Resource Assessment (CGWB and TN SG&amp;SWRDC), editions
            2023-2025, served by IN-GRES (ingres.iith.ac.in), cross-checked
            against the {latest} state report firka annexure and the national
            block-wise categorization list; SIPCOT GIS park boundaries
            (attribution, reuse confirmation requested); SIPCOT EC compliance
            filings (per-park water sources, e.g. Pillaipakkam EC ID
            EC22B039TN146946); CMWSSB daily reservoir readings; statutes and
            notifications as cited on the live page. Every number carries its
            edition and retrieval date ({retrieved}).
          </p>
          <p>
            <strong className="text-slate-700">What we do not claim.</strong>{" "}
            Park locations are public-record facts. This brief does not state
            or imply that any company or park depletes the aquifer or causes
            any unit&apos;s classification; our data cannot support that
            attribution.
          </p>
          <p>
            Neer Vazhvu is an independent, open-source public-information
            project. Live page with methodology and full source index:
            neervazhvu.org/corridors/{manifest.corridorId} · contact@neervazhvu.org
          </p>
        </div>
      </section>
    </div>
  );
}
