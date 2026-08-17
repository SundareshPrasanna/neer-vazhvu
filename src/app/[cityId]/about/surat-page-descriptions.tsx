"use client";

/**
 * Surat-specific "What each page shows" subsections.
 *
 * English-only for now; Gujarati prose follows in the i18n pass.
 *
 * Documents the layers actually shipped for Surat V1 and is explicit about
 * what distinguishes Surat from the Chennai baseline in BOTH directions. It
 * has a live threshold-referenced flood chain no other city on this platform
 * publishes, and it has no ward geometry at all.
 *
 * Provenance for every dataset named here lives in
 * docs/cities/surat/data-sources.md (publisher, host, acquisition path,
 * licence and retrieval date), and the sources watched for new editions are
 * registered in scripts/source-registry/surat.json.
 *
 * HOUSE RULE APPLIED THROUGHOUT: two columns in the national open-data
 * release for Surat are constants presented as measurements, and neither is
 * repeated here. Nor is any figure from the August 2006 flood, whose numbers
 * currently exist only in secondary sources. Where a number is absent, that is
 * deliberate and is said out loud.
 */

import Link from "next/link";

function SubSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
    >
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function SuratPageDescriptions({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className="text-slate-600 dark:text-slate-400">
          Every other city on this platform opens on a question about how much
          water is left. {cityName} cannot answer that question, because it
          impounds nothing of its own. It abstracts from a weir-cum-causeway
          pond on the Tapi, which is a river reach rather than a reservoir, and
          the water that fills that pond is released from Ukai dam about 100 km
          upstream, which the Gujarat Water Resources Department operates rather
          than the corporation. There is no volume to run down, so a
          days-of-water headline here would not be merely awkward. It would be
          undefined.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          So the dashboard asks the opposite question:{" "}
          <strong>how much room is left before water arrives.</strong> Surat
          Municipal Corporation publishes, hourly and free, a reading{" "}
          <em>and the operational threshold it is measured against</em> at every
          link of the chain - Ukai&apos;s full reservoir level, the
          causeway&apos;s overflow level, and a danger level for each of five
          urban khadis. No other publisher on this platform hands over both
          halves. Every threshold on that card is the corporation&apos;s own
          figure; headroom is the only number we compute, and it is a
          subtraction.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Two honesty notes carried on the card itself. A level past a danger
          mark is a trigger for the corporation to act, not a forecast that a
          given street will flood. And the causeway routinely sits{" "}
          <em>above</em> its overflow level during the monsoon and is closed;
          that negative headroom is rendered as negative rather than clamped to
          zero, because &quot;submerged&quot; is the true state.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>There is no storage history and there never will be.</strong>{" "}
          The chart other cities carry is replaced by a note saying so, rather
          than a promise that it &quot;fills in automatically&quot;. Level over a
          full-reservoir mark is not a quantity of water, and Surat&apos;s share
          of Ukai is not published anywhere.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          One structural caveat on the archive: SMC&apos;s page shows a rolling
          window of about ten readings, with no archive, no dated URL and no
          API. Our record therefore starts the day we began scraping and cannot
          be backfilled from any source.
        </p>
      </SubSection>

      <SubSection id="page-facts" title="Facts">
        <p className="text-slate-600 dark:text-slate-400">
          A static snapshot rather than a live pipeline, every entry carrying
          its own citation. The reuse figures come from the corporation&apos;s
          own dated presentation rather than from press coverage, which reports
          materially different numbers for the same programme.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          One fact is an absence, and it is deliberate.{" "}
          <strong>{cityName} publishes no measured non-revenue water.</strong>{" "}
          The national open-data release contains a &quot;losses including
          NRW&quot; column, but it is exactly 20.0000% of total supply on all 48
          monthly rows, and the accompanying &quot;actual supplied&quot; column
          equals total supply on every row, which contradicts it. It is an
          assumption sitting in a measurement column. The same release&apos;s
          per-sub-ward consumption column is exactly 0.75 x capacity on all 233
          rows. We publish neither, and say why rather than quietly dropping
          them.
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className="text-slate-600 dark:text-slate-400">
          The Tapi and the Mindhola, with CPCB&apos;s 2022 national monitoring
          at eight stations. The Tapi&apos;s seven Gujarat stations happen to
          form a clean upstream-to-sea profile, from Ukai down through Mandavi,
          Kakrapar, Kathore and Rander to the ONGC bridge at Hazira, and reading
          them in order produces a finding that inverts the usual assumption
          about an Indian urban river.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>
            The Tapi is not organically polluted as it passes through {cityName}.
          </strong>{" "}
          BOD sits at or below detection limit at most Surat stations. What
          climbs is conductivity - 369 to 513 umhos/cm at Ukai, 363 to 7,656 at
          Kathore, and 1,537 to 49,720 at Hazira, which is seawater.
          Surat&apos;s river problem is salinity and the estuary, not sewage.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Two limits worth stating. Only one CPCB edition is ingested; the
          annual backfill is available and not yet run. And river geometry comes
          from OpenStreetMap, which names the Tapi and the Mindhola but{" "}
          <strong>none of the five khadis</strong> the corporation monitors
          against danger levels - so the creeks most central to the flood story
          have no line on the map. SMC&apos;s own GIS holds a creek layer, but
          it serves rendered tiles only.
        </p>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className="text-slate-600 dark:text-slate-400">
          94 India-WRIS observation stations across Surat district, 6,563
          readings, 1970 to 2026. A 56-year record: deep in time, thin in space.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          That shape decides how the page renders. The stations are drawn as
          click-through points rather than interpolated into a per-zone depth
          surface, because 94 stations spread across a district cannot support
          that precision - the same call Madurai made at four stations. The
          ward-depth and ward-risk choropleths other cities carry are off here,
          and that is a decision about honesty rather than a missing file.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Two source caveats we correct for rather than inherit. The block
          column is empty for every Surat row in the WRIS export, so block-level
          assessment cannot be derived from it. And telemetry readings arrive
          with mixed sign; raw values are carried unaltered so the correction
          stays visible rather than baked in.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies">
        <p className="text-slate-600 dark:text-slate-400">
          3,401 polygons from ISRO&apos;s Space Applications Centre wetland
          atlas, 1,434 of them inside city limits, carrying area, an
          inland-versus-coastal split, a man-made-versus-natural split and
          turbidity flags.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          It is a strong geometric base and a weak semantic one:{" "}
          <strong>only 34 of the 3,401 carry a name</strong>, and the
          source&apos;s type-classification fields are empty for every Surat
          feature. There is no census of water bodies for {cityName} equivalent
          to Chennai&apos;s or Bengaluru&apos;s, no restoration register, and no
          lost-bodies study - so the ranking, census and lost-bodies layers are
          absent rather than thin.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          There is also no catchment atlas, and that is a judgement about the
          city rather than a missing dataset. The cascade layer reconstructs
          chained tank systems - the Tamil kanmoi networks, the Bengaluru kere
          chains - where each tank&apos;s surplus was engineered to feed the
          next over centuries. Surat&apos;s water bodies are coastal wetlands,
          tidal creeks and urban talavs on a flat estuarine plain. The algorithm
          would find downhill neighbours here because it always does, and
          drawing them as a cascade would assert an inheritance the city does
          not have.
        </p>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk">
        <p className="text-slate-600 dark:text-slate-400">
          Flooding is not a sub-page for {cityName}; it is the front door, and
          the dashboard hero is already a flood surface. This page carries the
          spatial half: the corporation&apos;s own depth-classed footprint of
          the August 2006 inundation, alongside the live khadi network.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>
            You will not find a single number about the 2006 flood anywhere on
            this site,
          </strong>{" "}
          and that is deliberate. It is the defining event in Surat&apos;s water
          history and the obvious thing to render today&apos;s dam release
          against. But every figure for it - the peak discharge, the share of
          the city inundated, the death toll, the losses - currently traces to
          encyclopaedia entries, news coverage or advocacy reports rather than
          to a primary record. Our rule is that external numbers are
          primary-source verified before publication, so these wait for the
          People&apos;s Committee on Gujarat Floods report and the Surat
          Citizens&apos; Council Trust report. The footprint is the half we can
          source, so the footprint is the half we show.
        </p>
      </SubSection>

      <SubSection id="page-commitments" title="Commitments">
        <p className="text-slate-600 dark:text-slate-400">
          A short register, because Surat&apos;s public promises are
          concentrated rather than scattered. All three entries come from one
          document and all three are owned by the corporation itself: reuse 70%
          of treated wastewater by 2030, reach 100% and zero liquid discharge by
          2035, and achieve comprehensive sewerage coverage by 2033.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The sewerage entry carries a caveat the corporation&apos;s own slide
          supplies: its coverage percentages are marked &quot;before city limit
          extension in June 2020&quot;, and that extension took SMC from roughly
          326 to 462.149 sq km. The denominator moved after the percentage was
          calculated.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Status changes only against a dated citation, and history is kept
          rather than overwritten.
        </p>
      </SubSection>

      <SubSection id="page-gaps" title="What is missing, and whose gap it is">
        <p className="text-slate-600 dark:text-slate-400">
          <strong>No ward surfaces.</strong> &quot;Ward&quot; in {cityName}{" "}
          means three incompatible things: 30 electoral wards, about 134
          census and administrative wards in SMC&apos;s own 1961-2011 table, and
          a third scheme inside the corporation&apos;s GIS. None has downloadable
          geometry. SMC&apos;s GIS is the richest municipal system we have found
          on this platform - roughly 390 layers including the full water and
          sewerage networks - but it serves rendered images and attributes only;
          the setting that would release the boundaries themselves is switched
          off. So the analytical unit here is the <strong>zone</strong>, of
          which there are nine, and which is the only unit carrying live data, an
          official current population and the city&apos;s own supply breakdown.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>A vintage conflict we did not smooth over.</strong> SMC&apos;s
          Zones page and its GIS both describe nine zones, with South split into
          A and B. The live rainfall feed still reports eight, with a single
          South Zone. Neither surface has been reconciled by the corporation, so
          the flood-chain data carries the feed&apos;s eight names exactly as
          published rather than remapping them onto the nine.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>No allocation ledger.</strong> The ledger&apos;s whole subject
          is entitled-versus-received, and no published drinking-water
          entitlement from Ukai or the Tapi was found. The entitled half does
          not exist in public.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>No restoration ranking.</strong> SMC restores lakes and says
          so - its reuse programme routes 2 MLD of treated water to lake
          rejuvenation - but publishes no project list, dates, budgets or
          per-body status.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>No industrial effluent layer yet.</strong> The Gujarat
          Pollution Control Board&apos;s continuous-monitoring dashboard and the
          Gujarat Environment Management Institute&apos;s discharge-point
          monitoring for the Pandesara and Sachin common effluent treatment
          plants are both identified and neither is built. For a textile city
          this is the most significant outstanding layer.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Full provenance, including the traps in each source, is in the
          project&apos;s{" "}
          <Link
            href={`/${cityId}/facts`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            facts
          </Link>{" "}
          page and in the per-city data-sources document in the repository.
        </p>
      </SubSection>
    </>
  );
}
