"use client";

/**
 * Delhi-specific "What each page shows" subsections.
 *
 * English-only for now; Hindi prose follows in the i18n pass (the
 * Madurai/Bangalore files carry a second language-conditional variant).
 * Documents the layers actually shipped for Delhi V1 and is explicit
 * about the honest gaps that distinguish Delhi from the Chennai
 * baseline - above all that Delhi has NO ingestible daily supply feed,
 * because no authority publishes one.
 *
 * Provenance for every dataset named here lives in
 * docs/cities/delhi/data-sources.md (publisher, host, acquisition path,
 * licence and retrieval date), and the sources that are watched for new
 * editions are registered in scripts/source-registry/delhi.json.
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

export function DelhiPageDescriptions({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} owns no reservoir. Roughly 90% of its raw water arrives from other states
          under a stack of instruments - the 1994 five-state Yamuna MoU at Wazirabad, the 102-km
          Munak carrier from Haryana (about 70% of the lifeline), a BBMB-resolved share of Bhakra
          240 km away, and Tehri&apos;s release riding the Upper Ganga Canal - with the city&apos;s
          own over-drafted groundwater making up the rest. So the headline is the supply chain
          itself, not a days-of-water runway: nine DJB treatment plants turn that inflow into about
          960 MGD (~4,365 MLD) against an assessed requirement above 1,290 MGD.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The structural numbers are audit-grade rather than self-reported. The CAG&apos;s
          performance audit of the Delhi Jal Board (Report No. 3 of 2025, tabled in the Delhi
          Legislature on 23 March 2026) is the spine: non-revenue water at 51-53% of supply, a
          Rs 4,988 crore revenue impact, Rs 66,595 crore of outstanding loans and interest as of
          March 2022, and only 40% of the water produced ever billed. The source-wise split of raw
          water is DJB&apos;s own, published in the Delhi Economic Survey 2023-24 (Chapter 13) -
          the same chapter that states 52.35% of the city&apos;s water is &quot;wasted or pilfered
          by tanker mafia&quot;. Where DJB&apos;s claimed availability and the CAG&apos;s audited
          production disagree, we show both rather than reconciling them.
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            No daily supply feed exists - and that is the finding
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Every other city on this platform has at least one authority publishing daily storage.
            Delhi has none. There is no public daily gauge for the Wazirabad pond, no flow figure
            for the Munak carrier (its carriage becomes public only when a shortfall reaches court,
            as in June 2024), no daily release against Tehri&apos;s 300-cusec allocation, and no
            DJB tube-well register - the CAG records that last absence as a finding in its own
            right. The two upstream feeds that would carry Bhakra and Tehri are dormant: BBMB&apos;s
            public reservoir page has not updated since September 2025, and CWC&apos;s weekly
            Reservoir Storage Bulletin listing ends in May 2025 (both re-checked 25 July 2026).
            Each source card therefore names who would have to publish the number, and the storage
            history chart says plainly that there is nothing to chart. The
            {" "}<Link href={`/${cityId}/allocations`} className="text-blue-600 dark:text-blue-400 hover:underline">Allocation Ledger</Link>
            {" "}exists precisely to make that asymmetry legible: the entitlements are crisp, the
            receipts are opaque.
          </p>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          What <em>is</em> live daily is rainfall: IMD&apos;s 0.25-degree gridded series for the NCT
          grid point (56 years, long-term mean 624.8 mm - within a millimetre of the figure
          IN-GRES reports for Delhi) extended by Open-Meteo reanalysis for the months IMD has not
          yet published, refreshed by the daily cron and superseded automatically as IMD catches up.
        </p>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className="text-slate-600 dark:text-slate-400">
          The choropleth is CGWB&apos;s Dynamic Ground Water Resource assessment at Delhi&apos;s
          own reporting unit - the 11 mapped districts, plus the non-spatial &quot;Nazul Land&quot;
          estate unit that appears in the tables but has no polygon. In the 2024-25 cycle four
          districts are Over-Exploited (New Delhi 123.2%, Shahdara 112.2%, North East 106.0%,
          South 103.4%) and the NCT as a whole draws 92.1% of what recharges - so the capital is
          pumping close to, and in places well past, what nature returns.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The per-district panel carries four assessment cycles (2021-22, 2022-23, 2023-24,
          2024-25) labelled the way the source labels them. Two caveats are stated on the panel
          itself: the assessment only became annual in 2021-22, and before that Delhi was assessed
          by tehsil (~34 units) rather than by district, so older editions cannot honestly be
          stitched onto this series. The 2022-23 cycle has no mirrored dataset anywhere and was
          taken from IN-GRES directly.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Per-ward depth interpolation and the ward risk composite are deliberately <em>off</em>.
          Delhi&apos;s live monitoring network reaches us only through India-WRIS, which refuses
          connections from outside India, and we will not manufacture per-ward precision from a
          station density we have not verified. The CGWB Year Book point network (162 stations)
          is a fast-follow: the edition we can currently download is 2017-18, too old to present
          as current.
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className="text-slate-600 dark:text-slate-400">
          This page is Yamuna-basin scoped and labelled as such: the reach runs from the Hathnikund
          barrage in Haryana through the 22-km Wazirabad-to-Okhla city stretch that carries roughly
          80% of the whole river&apos;s pollution load. Five channels are mapped - the Yamuna, the
          Western Yamuna Canal / Munak carrier that is the city&apos;s lifeline, the Hindon, and the
          Najafgarh and Sahibi courses, which are the same water: OpenStreetMap maps most of the
          Najafgarh drain as the Sahibi&apos;s engineered reach, so the two entries cross-reference
          each other rather than pretending to be separate rivers.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Water quality is Delhi&apos;s one genuinely high-cadence public feed, and it is
          <strong> monthly</strong> - DPCC samples eight Yamuna stations and about 39 drain points
          every month, which no other state pollution board publishes at that granularity. The
          station panel is derived from that monthly file so the two can never drift apart. The
          shape of the river&apos;s year is visible in it: water arrives at Palla meeting the
          bathing standard and leaves at Asgarpur with dissolved oxygen at nil.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Known gaps: the Barapullah and Shahdara drains are not mapped under those names in
          OpenStreetMap, and the DPCC reports are scanned PDFs, so extending the series is an OCR
          task rather than an API call. The 13 CETP monthly archives (2019-2024) are indexed with a
          transcribed sample but not yet bulk-extracted.
        </p>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk">
        <p className="text-slate-600 dark:text-slate-400">
          Delhi has no public flood model - no CFLOWS or iFLOWS equivalent - so unlike Chennai
          there are no modelled hazard zones or return-period extents to show, and we do not
          substitute something weaker while implying otherwise. What Delhi does have is a
          release-driven threshold structure with a 36-72 hour fuse: water released at Hathnikund
          reaches the Old Railway Bridge gauge two to three days later, where 204.50 m is warning,
          205.33 m danger and 206.00 m evacuation, and the first flood warning goes out when
          Hathnikund discharge crosses about one lakh cusecs.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Seven events are documented from 1978 to 2025, sourced individually. Where the record
          carries gauge levels we cite levels (2023&apos;s 208.66 m, the highest ever recorded, and
          1978&apos;s 207.49 m benchmark); where the Central Water Commission&apos;s own case study
          tabulates peak discharges rather than levels, we state discharges - the 1995 flood was the
          largest flow between 1978 and 2023. The chronic-waterlogging register carries Delhi&apos;s
          named perennial hotspots (Minto Bridge, Pul Prahladpur, Zakhira and the rest) with the
          official count hierarchy alongside: 448 points mapped from traffic-police data, 169
          locations identified for 2025, 71 with a nodal officer. Those full lists are referenced in
          reporting but never published as data, so the register carries the named sites only.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies &amp; restoration">
        <p className="text-slate-600 dark:text-slate-400">
          The polygon base is OpenStreetMap - 1,845 water bodies totalling about 5,805 hectares,
          the largest of which is the 601-hectare remnant of the Najafgarh Jheel. That single
          polygon carries the city&apos;s sharpest loss statistic: the jheel spread over roughly 226
          sq km before colonial-era drainage turned the Sahibi into the Najafgarh drain, and its
          wetland notification has been stuck between Delhi and Haryana since 2014.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Onto that we join the first Census of Water Bodies (&quot;Jal Dharohar&quot;, enumerated
          2022) - all 893 Delhi records with ownership, capacity, depth and khasra number. Only 234
          match an OSM polygon (31 inside one, 203 within 150 m); the remaining 659 are recorded as
          unmatched rather than force-fitted, because the census enumerates johads and recharge pits
          that OSM has never mapped. Restoration priority currently scores the 12-body flagship
          register (the hauz-and-baoli chain plus the modern lakes) rather than all 1,845 polygons,
          so most wards show a count without a scored list - a documented limitation, not an
          omission.
        </p>
      </SubSection>

      <SubSection id="page-my-ward" title="My Ward">
        <p className="text-slate-600 dark:text-slate-400">
          Wards are the 250 of the post-2022 unified MCD - the current delimitation, not the
          pre-merger 272 or the commonly-cited 270. Each ward joins the water bodies and census
          records inside it, the lost-water register, chronic waterlogging hotspots, mapped drain
          length, the nearest DPCC river station, its delimitation population, and its councillor
          with party and seat reservation from the December 2022 election (the party split validates
          against the published result: AAP 134, BJP 104, Congress 9, Independent 3).
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Assembly and parliamentary representatives are not shown: the ward-to-constituency mapping
          exists in the ward geometry, but we have not ingested the assembly and parliamentary
          result sets, and a half-filled card is worse than an honest one. Sewerage is marked
          unavailable - DJB&apos;s network dataset was delisted from its host and no copy survives.
          DUSIB&apos;s 675 JJ-basti roster (306,521 households) is in the repository but not
          ward-attributed: the public PDFs carry no coordinates and use pre-2022 ward numbers, which
          cannot be joined to today&apos;s wards without the delimitation crosswalk.
        </p>
      </SubSection>

      <SubSection id="page-ledgers" title="Allocation Ledger &amp; Commitments Register">
        <p className="text-slate-600 dark:text-slate-400">
          Delhi is the strongest case on the platform for both surfaces. The
          {" "}<Link href={`/${cityId}/allocations`} className="text-blue-600 dark:text-blue-400 hover:underline">Allocation Ledger</Link>
          {" "}tracks five instrument-governed arrangements - the 1994 MoU&apos;s 0.724 BCM/yr, the
          Munak carrier fixed at about 1,050 cusecs by the 2018 Standing Committee, Bhakra&apos;s
          share set meeting-by-meeting in BBMB minutes, Tehri&apos;s 300 cusecs, and unregulated
          groundwater - and grades each on how solid the paper is. The received side is mostly
          null on purpose: that is what the public record actually contains.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The {" "}<Link href={`/${cityId}/commitments`} className="text-blue-600 dark:text-blue-400 hover:underline">Commitments Register</Link>
          {" "}holds eight dated promises with their original citations, and never overwrites a
          date. The lead entry is already overdue: the government&apos;s target to trap all 39 major
          drains by 30 June 2026 passed without a public completion statement. DPCC&apos;s monthly
          drain readings are the instrument that will confirm or refute it - a trapped drain shows
          up as &quot;no flow&quot;.
        </p>
      </SubSection>

      <SubSection id="page-origins" title="Origins">
        <p className="text-slate-600 dark:text-slate-400">
          A four-chapter long-read on how a city that engineered its own water for a thousand years
          - Anangpur&apos;s gravity dam, the Sultanate hauz, the stepwells, Shah Jahan&apos;s
          Nahar-i-Behisht - became one that waits for water from five other states. Every claim is
          drawn from the same sourced corpus as the data pages; paraphrased quotations are marked as
          such rather than presented as verbatim. Images are Wikimedia Commons (public domain or
          CC), with per-file provenance recorded alongside them in the repository.
        </p>
      </SubSection>
    </>
  );
}
