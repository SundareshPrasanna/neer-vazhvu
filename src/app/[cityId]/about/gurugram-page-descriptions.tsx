"use client";

/**
 * Gurugram-specific "What each page shows" subsections.
 *
 * English-only for now; Hindi prose follows in the i18n pass, the same
 * posture Kannada, Marathi and Bengali had at their launches.
 *
 * Documents the layers actually shipped for Gurugram V1 and is explicit
 * about the ways Gurugram refuses the Chennai baseline: it impounds
 * nothing, it has no river at all, its groundwater is assessed but its
 * water level has not been published since June 2020, and the body most
 * people would petition about a pond owns a fifth of the register.
 *
 * Every number named here is read from a shipped artifact rather than
 * from research notes. Provenance lives in
 * docs/cities/gurugram/data-sources.md (publisher, host, acquisition
 * path, licence and retrieval date); the graded comparison against
 * Chennai is in docs/cities/gurugram/parity-scorecard.md; and the
 * sources watched for new editions are registered in
 * scripts/source-registry/gurugram.json.
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

function Gap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</h4>
      <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">{children}</div>
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function GurugramPageDescriptions({ cityId, cityName }: Props) {
  const P = "text-slate-600 dark:text-slate-400";
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className={P}>
          {cityName} owns no water. It impounds nothing, it has no river, and it treats no source
          of its own. What it has is a canal from the Yamuna, an aquifer it draws down faster than
          any district around it, and a tanker market. So the &quot;days of water left&quot;
          question every other city on this platform answers has no answer here - there is no
          stored volume to divide. That is the shape of the city, not a gap in the data.
        </p>
        <p className={P}>
          The headline is <strong>treatment capacity</strong>: 572 MLD installed across two plants,
          Chandu Budhera at 300 and Basai at 272. Both numbers are read out of GMDA&apos;s own
          asset register when the page is built, so they cannot drift from what the authority
          publishes. Raw water reaches both through the Gurgaon Water Supply Channel from the
          Yamuna at Kakroi, roughly 70 km away.
        </p>
        <Gap title="The number we deliberately do not publish">
          <p>
            <strong>No demand figure, and therefore no deficit.</strong> Peak demand for
            {" "}{cityName} is widely quoted at 675-700 MLD, which against 572 MLD of capacity
            would make a headline. Every one of those figures traces to press reporting rather
            than to a published document. GMDA&apos;s Final Development Plan and its Social
            Infrastructure Development Plan would settle it, and both are scanned PDFs with no
            text layer.
          </p>
          <p>
            A supply-minus-demand gap computed from a number we cannot source would be the most
            quotable thing on this page and the least defensible. So the page shows capacity and
            says what is missing.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className={P}>
          This is {cityName}&apos;s signature issue and the page draws it at
          {" "}<strong>district</strong> resolution: six districts, four assessment years
          (2021-22 through 2024-25), from the Central Ground Water Board&apos;s IN-GRES
          assessment. Gurugram district sits at <strong>194.6% stage of extraction</strong> - it
          withdraws close to twice what recharges - alongside Faridabad at 175.4% and Rewari at
          133.2%, all three categorised over-exploited. Palwal is critical at 92.0%, Nuh
          semi-critical at 72.3%, and Jhajjar safe at 49.6%.
        </p>
        <p className={P}>
          The neighbours matter here, which is why the map is not clipped to
          {" "}{cityName} alone. An over-drawn district ringed by other over-drawn districts has
          nowhere to borrow from.
        </p>
        <Gap title="Why there is no water-level map">
          <p>
            Chennai&apos;s groundwater page shows measured <em>depth</em> interpolated across
            wards. {cityName} has no equivalent and we could not build one honestly. The
            India-WRIS level series for this district is <strong>37 stations that stop in June
            2020</strong>, and Haryana&apos;s telemetry network does not cover {cityName} at all -
            a 95 MB state export returns zero rows for it.
          </p>
          <p>
            So the page reports the <em>assessment</em>, which is current and official, and does
            not report the <em>level</em>, which has not been published for five years. A
            contoured depth surface drawn from 2020 readings would look authoritative and mean
            nothing. This is a live watch: if the Haryana Water Resources Authority or a CGWB
            Year Book publishes post-2020 levels, the page gains a layer.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies">
        <p className={P}>
          <strong>824 water bodies across 2,851 acres</strong>, from the register GMDA compiled
          for the National Green Tribunal. This is not an OpenStreetMap trace: each body carries
          its village, tehsil, recorded area, ownership and the authority&apos;s own remark.
        </p>
        <p className={P}>
          Ownership is the finding. Gram panchayats hold <strong>392</strong> of the 824 and
          private owners <strong>208</strong>, while the Municipal Corporation holds
          {" "}<strong>62</strong>. Only 163 of the 824 fall inside the Corporation&apos;s
          boundary at all, against 454 inside the wider GMDA area. The body most residents would
          petition about a filled pond is responsible for a fraction of the register, and that is
          usually the thing worth knowing before writing the letter.
        </p>
        <p className={P}>
          The lost-bodies layer is derived from the publisher&apos;s <em>own</em> cross-survey
          attribution rather than from a spatial join of ours. GMDA flags each body against the
          1956 record of rights, the 1976 Survey of India sheets, 2012 WorldView imagery, a drone
          pass and Google Earth. Of the <strong>283</strong> bodies it can match to a 1956 revenue
          plot, <strong>29</strong> were not seen in the 2012 satellite pass, and one of those is
          absent from Google Earth as well.
        </p>
        <Gap title="Three things this layer does not claim">
          <p>
            <strong>It is a floor, not a total.</strong> The register is the 2012-known
            population, so a pond that existed in 1956 and had already gone by 2012 is not a row
            in it at all. The real loss is larger and this layer cannot size it.
          </p>
          <p>
            <strong>Absence from imagery is not proof of destruction.</strong> A seasonal johad
            photographed dry, or one under tree cover, is missing from a satellite pass for
            reasons that have nothing to do with being filled. Every entry reads &quot;not seen in
            2012 imagery&quot;, never &quot;lost&quot;.
          </p>
          <p>
            <strong>The vintage counts are not a time series.</strong> The three surveys count
            640, 519 and 824 bodies respectively - the number <em>rises</em> at the end, because
            satellite imagery picks up construction pits and seasonal water that a revenue clerk
            never listed. Charting those three numbers as a trend would be false, so we do not.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-tanker" title="Tanker water">
        <p className={P}>
          {cityName} is the only city on this platform where the tanker economy is a ledger rather
          than a story. GMDA publishes its own bulk-water booking MIS, and it is granular:
          {" "}<strong>29,284 bookings, 1.72 billion litres and Rs 8.72 crore</strong> over 36
          months from January 2019 to December 2021, across 259 buyers, 5,287 delivery sites and 7
          filling stations.
        </p>
        <p className={P}>
          The page leads on <strong>composition</strong>, not volume. Non-potable water went from
          29.7% of litres sold to 51.2% in three years while the three tariffs held flat - potable
          at about Rs 70.5 per kilolitre, recycled at Rs 30, CETP-treated at Rs 8.
        </p>
        <p className={P}>
          Read carelessly that looks like recycling taking hold. It is not. The share moved
          because the <strong>potable side collapsed 64%</strong>, from 562 to 202 million litres,
          while non-potable fell too, by about 10%. The whole market contracted. What the series
          is really measuring is construction stopping, which is also why the volume line carries
          its caveat rather than leading: these are the COVID years.
        </p>
        <Gap title="What we do not republish, and what we are waiting for">
          <p>
            gmda.gov.in asserts all rights reserved and publishes no reuse policy, so this
            artifact carries <strong>aggregates only</strong> - counts, sums and shares. No
            upstream row is republished, the delivery-address column is dropped at build time,
            and the full buyer list is not shown; the concentration is the finding, not the
            names.
          </p>
          <p>
            The publisher stopped after 2021. A 2022 file appearing is the event we watch for,
            and until it does this page is a closed three-year window rather than a live series.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-origins" title="Origins">
        <p className={P}>
          Six chapters on how a place with no river became a city of three million. The spine is
          one comparison: the municipal limit grew from <strong>20.1 to 297.3 square
          kilometres</strong> between 1985 and 2020, and the Central Ground Water Board notified
          the block a dark zone in 2008 - roughly two-thirds of the way through that expansion,
          with most of the building still to come.
        </p>
        <p className={P}>
          The last chapter is about where the water goes rather than where it comes from.
          {" "}{cityName}&apos;s surface runoff drains north into the Najafgarh jheel and then
          into Delhi&apos;s Najafgarh drain, which is the Sahibi river under another name. The
          city is upstream of somebody.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Four images, all Wikimedia Commons under CC BY-SA or public domain, with licence and
          photographer recorded in a manifest beside the files. Every candidate was opened and
          looked at before selection and the alt text describes what is in the frame rather than
          what the Commons caption claims, because one candidate&apos;s caption advertises towers
          that do not appear in it. Two were fetched and then rejected: a johad that turned out to
          be geotagged 90 km away in Charkhi Dadri, and an aerial whose identification rests only
          on its uploader&apos;s title. Chapters 3 and 5 carry no image at all - there is no
          Haryana borewell or water-tanker photograph on Commons, and borrowing one from another
          state would be worse than a gap.
        </p>
      </SubSection>

      <Gap title={`What is not built for ${cityName} yet`}>
        <p>
          Six of the platform&apos;s sixteen routes are live. The rest are switched off rather
          than shipped empty, and each has a stated reason and a removal condition in
          {" "}<code>docs/cities/gurugram/parity-audit.md</code>.
        </p>
        <p>
          <strong>Rivers is not a gap.</strong> {cityName} has no river: every national monitoring
          station in the district is a lake or a borewell. There is nothing to build.
        </p>
        <p>
          <strong>Flood risk is the largest thing we could build next.</strong> {cityName} floods
          by waterlogging on a paved catchment rather than by a river breaking its banks, and the
          inputs are reachable: 117 mapped waterlogging sites, the master storm-water network,
          natural flow direction and ten watersheds. Only the drain legs are harvested so far.
        </p>
        <p>
          <strong>My Ward is blocked on data, not geometry.</strong> All 36 municipal ward
          polygons are harvested, but nothing is joined to them yet - and GMDA&apos;s ward layer
          publishes a number and a zone code with no ward name, so any ward surface here will
          label by number.
        </p>
        <p>
          <strong>Treatment compliance is buildable.</strong> The Haryana State Pollution Control
          Board publishes inlet and outlet BOD, COD and TSS for 18 {cityName} sewage treatment
          plants and one common effluent plant against consent limits. It is not wired up yet.
        </p>
        <p className="text-xs">
          The graded comparison against Chennai, the reference build, is in
          {" "}<code>docs/cities/gurugram/parity-scorecard.md</code>, alongside the provenance
          file at <code>docs/cities/gurugram/data-sources.md</code>. Where {cityName} carries
          less, the reason is stated; where the feature cannot exist here at all, it is marked as
          such rather than counted as a shortfall. What is live is at
          {" "}<Link href={`/${cityId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
            the {cityName} dashboard
          </Link>.
        </p>
      </Gap>
    </>
  );
}
