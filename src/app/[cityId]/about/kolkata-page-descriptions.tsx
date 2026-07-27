"use client";

/**
 * Kolkata-specific "What each page shows" subsections.
 *
 * English-only for now; Bengali prose follows in the i18n pass (native
 * review pending). Documents the layers actually shipped for Kolkata V1
 * and is explicit about the ways Kolkata refuses the Chennai baseline -
 * it impounds no water, has no dam to watch, is not assessed on
 * groundwater extraction at all, and its largest treatment asset lies
 * outside its own boundary.
 *
 * Provenance for every dataset named here lives in
 * docs/cities/kolkata/data-sources.md (publisher, host, acquisition
 * path, licence and retrieval date); the graded comparison against
 * Chennai is in docs/cities/kolkata/parity-scorecard.md; and the sources
 * watched for new editions are registered in
 * scripts/source-registry/kolkata.json.
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

export function KolkataPageDescriptions({ cityId, cityName }: Props) {
  const P = "text-slate-600 dark:text-slate-400";
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className={P}>
          {cityName} impounds nothing. There is no dam anywhere in its water system: supply is
          run-of-river abstraction from the Hooghly at Palta, about 22 km north in Barrackpore,
          plus roughly 110 MLD of deep tube wells. So the &quot;days of water left&quot; question
          every other city on this platform answers has no answer here - the numerator does not
          exist. That is not a data gap; it is the shape of the city.
        </p>
        <p className={P}>
          The headline instead is <strong>drainage capacity</strong>. KMC&apos;s own sewerage
          document states the main network &quot;was designed to discharge a rainfall of 6 mm. per
          hour&quot;, across 180 km of century-old brick sewer with most pumping stations built 50
          to 100 years ago. We measure how often the sky beats that, from 26 years of hourly
          rainfall (232,896 values, 2000-2025): a mean of 31.8 hours a year, but 19.2 hours a year
          in 2000-2012 against 44.5 in 2013-2025. The threshold slider is the divisor - move it and
          the count recomputes, because most Indian storm-water codes use 12-25 mm/h and
          {" "}{cityName}&apos;s standard is a Victorian one.
        </p>
        <p className={P}>
          Below the hero sits the sewage balance, because for a city whose emergency is drainage
          rather than scarcity, &quot;where does it go&quot; is the question straight after
          &quot;how often do the drains fail&quot;.
        </p>
        <Gap title="Two numbers we deliberately do not publish">
          <p>
            <strong>No total supply capacity.</strong> KMC&apos;s water-supply page lists plants
            summing to 2,214.7 MLD plus about 110 MLD of tube wells, while the same page describes
            a target of roughly 1,900 MLD and a requirement of about 1,660 MLD. It is labelled
            &quot;(DRAFT)&quot;, footered 2013, and refers to 2025 in the future tense. Publishing
            any total would launder that contradiction, so no capacity total appears anywhere in
            this product until it reconciles.
          </p>
          <p>
            <strong>No litres-per-capita figure.</strong> KMC contests its own denominator: its
            Environment Plan gives more than 4.5 million residents plus a floating population of
            60,00,000 a day, while its water-supply pages frame demand off a &quot;static
            population&quot; of 44.96 lakh. Whatever LPCD anyone quotes for {cityName}, the
            denominator is disputed by the publisher.
          </p>
          <p>
            <strong>And no non-revenue-water figure</strong>, because none was found to exist.
            Combined with near-absent domestic volumetric charging and largely unmetered
            connections, NRW and distributional equity are structurally invisible here.
          </p>
        </Gap>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The rainfall is ERA5-family reanalysis, which smooths short convective bursts, so every
          exceedance count is a <strong>lower bound</strong> rather than a rain-gauge reading. The
          6 mm/h standard itself comes from a 2009 document describing British-era sewers;
          post-rehabilitation stretches may carry a different rating, which is why the standard is
          configuration with a citation rather than a constant.
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className={P}>
          Four channels: the Hooghly, which supplies essentially all the city&apos;s drinking
          water; the Adi Ganga, the original course of the Ganga running through south {cityName}
          {" "}past Kalighat, now largely the engineered channel also called Tolly&apos;s Nullah;
          the Bidyadhari, which drains the East Kolkata Wetlands eastward; and the Saraswati,
          carried for basin context.
        </p>
        <p className={P}>
          The water quality is the deepest series on this platform - <strong>41 stations and
          3,209 samples from 2010 to 2026</strong>, roughly quarterly, from the West Bengal
          Pollution Control Board&apos;s EMIS portal. The longest single series is the Ganga at
          Dakshineswar: 281 samples spanning 28 January 2010 to 7 July 2026. For comparison,
          Chennai&apos;s river page runs on annual CPCB sampling.
        </p>
        <p className={P}>
          <strong>Tidal station pairing is unique to {cityName} here.</strong> WBPCB samples each
          of six Adi Ganga points <em>separately at high tide and at low tide</em>, because the
          Hooghly is tidal this far inland and the same location is a different water body six
          hours apart. We keep the two apart rather than averaging them - and that is what
          surfaces the finding: at Bansdroni on 7 May 2026, dissolved oxygen was NIL and faecal
          coliform 4,900,000 MPN/100ml at high tide, and <em>worse</em> at low tide, BOD 14.53
          against 10.75 and faecal coliform 8.4 million against 4.9 million. The board&apos;s own
          observers recorded the water as &quot;Blackish&quot; and &quot;Pungent&quot;.
        </p>
        <Gap title="What the rivers page cannot show">
          <p>
            WBPCB publishes no station coordinates, so the 15 mapped stations are hand-placed from
            their names against the mapped channel and flagged as approximate; a further 26
            stations have real readings but no position we would defend, and are carried with
            their full series rather than dropped or given invented coordinates.
          </p>
          <p>
            There is no equivalent of Chennai&apos;s geo-located sewage-inlet inventory, and no
            industrial-source overlay - see the water-bodies note below for why that last one is
            KMC&apos;s own admission rather than our omission.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk">
        <p className={P}>
          {cityName}&apos;s flood risk is drainage-capacity-driven, not release-driven. It has no
          dam and no barrage, so there is no upstream gate to watch: the trigger is rainfall
          intensity against the same 6 mm/hour standard the dashboard runs on. Most of the core
          city drains through a <strong>combined</strong> system, carrying sewage and stormwater in
          one conduit, which is the single fact tying the city&apos;s flooding, its river pollution
          and its dependence on the wetlands together. A drainage failure and a pollution event
          here are the same event.
        </p>
        <p className={P}>
          The page is anchored on KMC&apos;s own <strong>weekly waterlogging register</strong> -
          the chart its Mechanical Sewer Cleansing wing publishes listing every pocket it sent
          de-silting machines to, with a borough/ward attribution on every row. The week of
          20-26 July 2026 named 66 pockets across 53 wards and 15 boroughs, with 469 machine
          deployments. Flooding in {cityName} is not an annual event; it is a weekly operating
          condition.
        </p>
        <Gap title="No flood model, and no working warning system">
          <p>
            There is no CFLOWS-equivalent hazard model for {cityName}, so this page carries no
            hazard choropleth and no 5/10/25/50/100-year extents. West Bengal&apos;s legal
            red/blue flood-line map sheets exist as scanned A0 plots and are not georeferenced.
          </p>
          <p>
            The storm-water drain network is PDF-only: KMC publishes 80 per-ward drainage maps as
            documents, so the 182 drain segments shown here come from OpenStreetMap, against
            Chennai&apos;s 10,308 surveyed segments.
          </p>
          <p>
            And the KEIIP programme site still links a flood <strong>Early Warning System</strong>
            {" "}at kflood.in whose domain no longer resolves. A city that floods weekly has no live
            public warning surface at all.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className={P}>
          This page corrects an assumption the research started with. {cityName} is <em>not</em>
          {" "}groundwater-poor: a full India-WRIS station census, paged to exhaustion over
          2010-2026, finds <strong>703 observation wells and 201,221 readings</strong> across the
          six districts of the metropolitan area - 23 in Kolkata district itself, live to 4 June
          2026. That is denser than Delhi&apos;s 237-well network.
        </p>
        <p className={P}>
          Two districts have gone quiet and are shown as such rather than interpolated over:
          Howrah has not reported since 30 April 2023, Hooghly since 30 November 2022. Liveness is
          itself a finding, so per-district recency is published alongside the readings.
        </p>
        <Gap title="Kolkata is not assessed on groundwater extraction at all">
          <p>
            The national assessment (IN-GRES, the official CGWB and state portal) does not
            classify Kolkata district as safe, semi-critical, critical or over-exploited. It
            classifies it as <strong>salinity</strong> - a water-quality category, not a stage
            band - and the district therefore carries no availability, resource or extraction
            figures, because saline aquifers are not assessed on extraction. South 24 Parganas is
            the same. So the exploitation choropleth Chennai has cannot be drawn here: the
            framework classifies {cityName} on a different axis, which is a finding rather than a
            missing file.
          </p>
          <p>
            The surrounding ring <em>is</em> assessed, and it moved: North 24 Parganas - the
            district holding both the Palta intake and the arsenic belt - went from safe to
            semi-critical in 2024-25. Nadia is semi-critical; Hooghly and Howrah safe.
          </p>
          <p>
            Per-ward depth interpolation stays off. 703 wells is a dense network, but count is not
            coverage, and painting a continuous surface over a delta from unvalidated spread would
            invent values no instrument saw.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies and lake restoration">
        <p className={P}>
          5,526 water-body polygons from OpenStreetMap, plus <strong>3,051 GPS-located bodies</strong>
          {" "}from the 1st Census of Water Bodies - ten times the census layer Chennai carries. That
          census matters more here than anywhere: KMC&apos;s own working inventory is a
          departmental tank list compiled in <strong>1993</strong>, supplemented by a 2004 aerial
          map, so the national census is the only modern per-water-body register {cityName} has and
          it is not the corporation&apos;s.
        </p>
        <p className={P}>
          Nobody agrees how many ponds there are. For 2006 alone there are four published counts:
          KMC&apos;s own list said 3,873, the National Atlas organisation&apos;s map census said
          8,731, a satellite count said 4,889, and KMC&apos;s earlier 1997 list had said 1,786.
          That last pair is a trap - KMC&apos;s count rose because the corporation searched harder,
          not because ponds appeared. The widely-cited <strong>44% loss</strong> comes from
          comparing the map census against the satellite count in the same year.
        </p>
        <p className={P}>
          The <strong>lost water bodies</strong> layer is built differently here for an honest
          reason: no per-pond inventory of what was filled exists. So it enumerates toponymic
          evidence instead - localities and streets still carrying a pond&apos;s name with no water
          body mapped within 300 m today. Eleven of sixteen such localities and twelve of
          twenty-five such streets qualify, which corroborates the 44% figure by a completely
          different method. Each entry is evidence a named pond is gone, not a death certificate
          for a specific pond, and every one is flagged as toponymic.
        </p>
        <p className={P}>
          Restoration is a court docket rather than a programme. Four flagship bodies (Rabindra
          Sarobar, Subhas Sarobar, Lal Dighi and the East Kolkata Wetlands), four projects, and the
          NGT&apos;s November 2017 order appointing KMDA custodian of Rabindra Sarobar - which the
          Tribunal then upheld against KMDA&apos;s own plea to relax it. Water quality for both
          Sarobars is pulled from our own WBPCB ingest, so this page and the rivers page read the
          same samples.
        </p>
      </SubSection>

      <SubSection id="page-sewage" title="Sewage, allocations and commitments">
        <p className={P}>
          The signature finding sits on the dashboard: by KMC&apos;s own statutory accounting,
          <strong> 910 of {cityName}&apos;s 1,400 MLD of sewage</strong> is treated in the
          sewage-fed fisheries of the East Kolkata Wetlands - roughly five times what all five of
          the city&apos;s treatment plants manage between them (179 MLD), with 311 MLD (22.21%)
          untreated or only partly treated. The wetlands are 12,500 hectares of working fisheries
          that nobody built, nobody pays for, and which lie <strong>outside the corporation&apos;s
          boundary</strong>, in North and South 24 Parganas. That fact is why this platform models
          {" "}{cityName} as a region rather than a city.
        </p>
        <p className={P}>
          The allocation ledger is unusual because {cityName} has no entitlement document for its
          own water - run-of-river abstraction is not a quota with a receipt. What exists on paper
          is what KMC sells <em>onward</em>: 90 MLD to Bidhannagar and 22.7 MLD to Budge Budge,
          both entitled-but-unverifiable, since neither seller nor buyer publishes delivered
          volumes.
        </p>
        <p className={P}>
          The commitments register has a real verification calendar for the first time. Alongside
          two 2021 promises with no follow-up, it now tracks the KMC-SHARP sewerage packages
          financed under ADB Loan 4584-IND - named contractors, contractual completion dates, and a
          percentage-progress figure refreshed every six months by a disclosure obligation rather
          than at the implementing agency&apos;s discretion. As of 31 December 2025, five packages
          had been awarded and commenced, and every one stood at <strong>0.0% physical
          progress</strong>. That is a baseline the next report either moves or does not.
        </p>
        <Gap title="KMC declared the industrial gap itself">
          <p>
            In KMC&apos;s statutory District Environment Plan the entire industrial-wastewater
            section is <strong>blank</strong> - every field empty, with the state pollution board
            named as responsible. That is a corporation recording a gap in its own legally mandated
            filing, and we surface it rather than fill it from weaker sources.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-not-shipped" title="What {cityName} does not have, and why">
        <p className={P}>
          Several Chennai surfaces are absent here, and most are differences rather than
          deficiencies. There are no reservoir cards or storage history because nothing is
          impounded; no shoreline page because {cityName} is a tidal river port some 130 km
          upstream of the Bay of Bengal, not a coastal city; no tank cascades because the Gangetic
          delta drains rather than cascades; and no dam-release flood trigger because there is no
          dam.
        </p>
        <Gap title="There is no catchment view, and that is a decision">
          <p>
            Four cities here let you click a lake and see its catchment - the area of influence
            that drains into it. {cityName} does not, and the reason is terrain rather than a
            missing file. Catchments are delineated by tracing water downhill across a 30 m
            bare-earth elevation model, which needs a gradient. Kolkata has about{" "}
            <strong>11 metres of fall across 40 kilometres</strong> of delta, against 43 m in
            Chennai, 94 m in Madurai, 194 m in Bengaluru and 338 m in Mumbai - the four cities
            where the view ships.
          </p>
          <p>
            At that gradient, with 5,526 water bodies each claiming a catchment and most of the
            city&apos;s runoff actually travelling through a combined sewer network rather than
            over the ground, the algorithm would return polygons that look authoritative and are
            not. We would rather show nothing than draw boundaries the ground does not support.
          </p>
          <p>
            The consequence worth naming: the rooftop rainwater-harvest estimate is an enrichment
            of those catchment polygons, so {cityName} does not carry a per-water-body harvest
            figure either. The inputs for one do exist - Overture building footprints and an IMD
            annual normal of 1,641 mm - so a ward-level version is buildable against a different
            boundary.
          </p>
        </Gap>
        <p className={P}>
          Ward-level surfaces - <code>my-ward</code>, ward profiles, the per-ward risk composite -
          are switched off for a concrete reason. The only public ward geometry carries 141 of
          KMC&apos;s 144 wards. Wards 142, 143 and 144 are missing, and they are not slivers: they
          account for about 18.93 km², roughly <strong>9.2% of the city</strong>. A ward map that
          silently drops three wards is worse than none, because a resident of ward 143 would get
          &quot;not found&quot; rather than &quot;not yet mapped&quot;.
        </p>
        <p className={P}>
          A full graded comparison against Chennai - every feature scored, with the reason recorded
          wherever parity is not reachable - is published in the repository at{" "}
          <code>docs/cities/kolkata/parity-scorecard.md</code>, alongside the provenance file at{" "}
          <code>docs/cities/kolkata/data-sources.md</code>.
        </p>
        <p className={P}>
          The long-form account of how this system came to work the way it does is on the{" "}
          <Link href={`/${cityId}/origins`} className="text-blue-600 dark:text-blue-400 hover:underline">
            {cityName} origins page
          </Link>
          .
        </p>
      </SubSection>
    </>
  );
}
