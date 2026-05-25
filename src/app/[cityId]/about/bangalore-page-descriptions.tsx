"use client";

/**
 * Bangalore-specific "What each page shows" subsections.
 *
 * English-only for now; Kannada renderer is a follow-up. Kannada
 * readers fall through to English via the parent gating.
 *
 * Mirrors the structure of madurai-page-descriptions.tsx so cross-
 * city navigation between about-page anchors stays predictable.
 */

import { useLanguage } from "@/lib/i18n/context";

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
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function BangalorePageDescriptions({ cityId, cityName }: Props) {
  // English-only renderer for now. The parent gates Kannada through
  // the same component (no separate Kannada renderer yet); Kannada
  // readers see English prose until a native review is in hand.
  useLanguage();
  return <English cityId={cityId} cityName={cityName} />;
}

function English({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName}&apos;s dashboard does NOT show a Chennai-style
          &quot;days of water left&quot; runway. Bengaluru is a pumped city,
          not a reservoir city: the only operational drinking source is
          Cauvery water lifted 95 km from T.K. Halli and ~500 m in
          elevation, served from BWSSB&apos;s 5 WTPs at the headworks. The
          dashboard hero (the Cauvery Pumping panel) anchors on that
          chain instead - infrastructure, transmission, NRW, and the
          stage-by-stage augmentation history.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Cauvery Pumping hero
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          The hero tile renders engineering numbers from{" "}
          <code>bangalore-supply-overview.json</code>: 1,310 MLD installed
          capacity across Stages I-V; 95 km transmission; 500 m lift;
          48% NRW; ~5.8M population served against ~14M GBA; ~75% of
          revenue absorbed by pumping energy. Every number is anchored
          to the JICA Bengaluru Water Supply and Sewerage Project Phase 3
          Final Report (November 2017) plus BWSSB&apos;s Stage V
          commissioning record (16 Oct 2024) and The Ken&apos;s February
          2026 reporting on Stage V under-delivery (~400 MLD vs 775 MLD
          design).
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Upstream Cauvery basin storage panel
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          Below the hero, four upstream Cauvery reservoirs (KRS, Hemavathi,
          Kabini, Harangi) are surfaced as a basin-storage panel - NOT as
          Bengaluru&apos;s tap supply. These dams are irrigation-primary;
          the city&apos;s share is the carve-out at T.K. Halli. The panel
          mirrors Madurai&apos;s Mullaperiyar pattern: a Kerala-side dam
          tracked because it feeds Madurai&apos;s supply. Daily history
          backfills and AutoARIMA forecasts on these four reservoirs are
          queued for a follow-up round; for now the panel surfaces
          registered capacities + catchment areas.
        </p>
      </SubSection>

      <SubSection id="page-tanker" title="Tanker market">
        <p className="text-slate-600 dark:text-slate-400">
          Bengaluru is the only city in the platform with a dedicated
          tanker page. With ~5,000 tankers operating across the city and
          BWSSB&apos;s piped network reaching only ~5.8M of ~14M
          residents, the tanker economy is a parallel water system - not
          a fringe phenomenon. The page anchors on the OpenCity Bengaluru
          Tanker Water Survey (longitudinal 2015 / 2019 / 2024 / 2025
          waves), surfacing fleet size, rate spreads, IISc-flagged stress
          ward demand concentrations, and the BWSSB official-vs-informal
          rate gap (₹700 per 5 kL on Kaveriwheels vs ₹2,850 per 12 kL at
          summer 2024 crisis peak).
        </p>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName}&apos;s groundwater page combines three views: CGWB
          block exploitation (the official annual classification),
          ward-level risk composite, and the CGWB live monitoring station
          network. Per-ward depth interpolation is deliberately disabled
          here - the underlying station density doesn&apos;t support an
          honest 369-ward choropleth.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Block exploitation (GWR)
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          6 CGWB-classified blocks across Bangalore Urban district -
          Bangalore (North), Bangalore-South, Bangalore-East,
          Bangalore-City, Yelahanka, Anekal - coloured by their latest
          annual draft-vs-recharge percentage from CGWB&apos;s Ground
          Water Estimation Committee assessment. Status classes: Safe /
          Semi Critical / Critical / Over Exploited.{" "}
          <span className="font-semibold">All six blocks have been
          Over-Exploited for the entire 13-year window 2011-2024.</span>{" "}
          Bangalore-East is the worst at 306% (3.06x recharge); Yelahanka
          has accelerated from 140% to 260% in just four years
          (2020-2024). The panel auto-anchors on the worst-exploited
          block when the page loads.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          CGWB monitoring station overlay
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          13 telemetric DWLR stations across the district, drawn as
          click-through markers. The set covers Nimhans, Lalbagh Garden,
          Jayanagar, Hesaraghatta, Thalaghattapura, Anekal, Cubbon Park,
          Dasanapura, Indian Institute of Science, Yelahanka, Adugodi,
          Bangalore University Ars Ls, and Singasandra. Stations sitting
          inside an IISc-flagged stress ward (Jayanagar, Yelahanka) are
          marked as such. Per-station hydrograph readings are queued for
          a follow-up CGWB Year Book transcription.
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Why no per-ward depth choropleth?
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We deliberately do NOT publish an IDW-interpolated per-ward
            depth choropleth for Bengaluru. The 13 CGWB telemetric
            stations spread across 369 GBA wards work out to roughly one
            station per 21 sq km - far too sparse to produce an honest
            per-ward interpolation. Spreading 13 points smoothly across
            369 wards would manufacture precision the underlying data
            doesn&apos;t support. The 6-block GEC classification plus the
            station-point overlay together give an honest picture without
            faking ward-level granularity. Chennai&apos;s ward-depth
            choropleth is supported by OpenCity&apos;s monthly per-ward
            survey, which Bengaluru doesn&apos;t have an equivalent for.
          </p>
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Ward risk composite (3-factor)
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          A 3-factor weighted percentile score per ward, A-F graded.
          Mirrors the Madurai 3-factor composite (Chennai uses 5
          factors but Bengaluru&apos;s drainage / sewerage / flood-
          hazard layers don&apos;t exist publicly yet):
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
          <li>
            <span className="font-semibold">GW block exploitation (50%)</span>{" "}
            - the ward&apos;s parent CGWB block&apos;s draft-vs-recharge
            percentage; higher = higher risk.
          </li>
          <li>
            <span className="font-semibold">Water-body density (20%)</span>{" "}
            - kere per sq km within the ward; denser = lower risk.
          </li>
          <li>
            <span className="font-semibold">Water-body health (30%)</span>{" "}
            - mean restoration-priority score within 3 km; higher
            priority = sicker tanks = higher risk.
          </li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Each factor is converted to a city-wide percentile (0=best,
          100=highest risk), weighted, summed. Composite ≤20 = A, ≤40 =
          B, ≤60 = C, ≤80 = D, &gt;80 = F. With all six blocks at &gt;100%
          exploitation, the GW factor saturates most wards near the high
          end - the city-wide picture is fundamentally bleak.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies">
        <p className="text-slate-600 dark:text-slate-400">
          1,897 OpenStreetMap-traced water-body polygons across BBMP.
          Click any polygon for its tags + restoration-priority score.
          Fourteen flagship lakes carry the full deep-zoom rich-data
          panel (boundary + 1 km halo + 9-year imagery slider + JRC
          water-loss tint + Dynamic World built-gain tint + Open
          Buildings v3 + Overture Maps Q1 2026 stats + curated timeline +
          sources modal): Bellandur, Varthur, Madivala, Ulsoor, Hebbal,
          Sankey, Yelahanka, Kempambudhi, Hesaraghatta, Agara,
          Puttenahalli, Jakkur, Rachenahalli, Iblur.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Lost-narrative overlay
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          Beyond the OSM-current polygons, the page surfaces a curated
          inventory of fully-lost and severely-reduced Kempegowda-era
          kere, anchored on Harini Nagendra&apos;s{" "}
          <em>Nature in the City: Bengaluru</em> (OUP 2016). Dharmambudhi
          (drained for the Majestic bus stand), Sampangi (Sri Kanteerava
          stadium), Karanji Anjaneya (Bishop Cotton playing fields),
          Akkithimmanahalli (hockey stadium), Domlur (BDA layout), and
          severely-reduced bodies like Kempambudhi, Halsoor (Ulsoor),
          and Sankey carry their conversion stories in click-through
          tooltips.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Cascade reconstruction overlay
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          A toggle on the map switches in the platform&apos;s terrain-
          derived cascade graph: 1,033 cascade nodes (water-bodies &gt;= 1
          ha) connected by 1,053 directed edges, draining via 43 river
          outlets into the Vrishabhavathi / Koramangala-Challaghatta /
          Hebbal channels. Multi-outflow scoring is enabled to honour
          Bengaluru&apos;s ridge-city geometry, where traditional kere
          chains had both a feeder and a separate surplus channel.
          Maximum cascade depth is 11 nodes; the top-convergence anchor
          is Doddajala Kere on the Hebbal cascade (degree_in=8). Full
          methodology lives under the{" "}
          <a
            href="#cascade-methodology"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            cascade methodology
          </a>{" "}
          section below; the named-cascade health page lives at{" "}
          <a
            href={`/${cityId}/cascades`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            /{cityId}/cascades
          </a>{" "}
          (when Layer B curation is wired).
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className="text-slate-600 dark:text-slate-400">
          Bengaluru sits on a ridge that splits into three valleys -
          Vrishabhavathi west (to Cauvery via Arkavathy), Koramangala-
          Challaghatta south (the Bellandur-Varthur foam cascade,
          ultimately to Dakshina Pinakini), and Hebbal-Nagavara north
          (also to Dakshina Pinakini via the Nagavara channel). The page
          ships these three named rivers as OSM polylines plus the
          channels feeding them through the BBMP cascade network.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          KSPCB monitoring stations
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          9 monitoring stations across the three rivers, sourced from
          KSPCB&apos;s monthly water quality reports cross-referenced
          with CPCB&apos;s National Water Monitoring Programme (where
          covered). Per-station readings cover BOD, COD, DO, pH and
          coliform counts. Markers are colour-coded by latest BOD: red
          above 6 mg/L, amber above 3, green at or below 3. The
          Vrishabhavathi and K&amp;C downstream stations consistently
          show severe-pollution readings; this is the empirical record
          behind the foam-and-fire narrative on Bellandur and Varthur.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          River events log
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          12 hand-curated event entries: the foam crises and fires (16
          Feb 2017 Bellandur burns, January 2018 second fire, recurring
          post-monsoon 2024 events), the NGT Forward Foundation order
          (OA 222/2014, 75 m / 50 m / 30 m buffer regime), Karnataka
          Lokayukta&apos;s 2011 lake-encroachment report, BDA
          restoration tenders (Bellandur-Varthur joint tender 2020).
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Industrial pollution sources
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          14 industrial clusters mapped as type-coloured markers across
          the three valleys: Peenya industrial estate, Bommasandra,
          Yelahanka, Mahadevapura, Whitefield, Bidadi (Toyota /
          Bidadi industrial belt), Doddaballapur, plus textile-dyeing /
          electroplating / tannery clusters that feed the Vrishabhavathi
          and K&amp;C catchments. Compiled from KIADB records, KSPCB
          consent-to-operate filings, and IISc CES (T.V. Ramachandra)
          academic surveys.
        </p>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk">
        <p className="text-slate-600 dark:text-slate-400">
          Narrative-only stub. Hazard-zone polygons (5/10/25/50/100/200-
          year return periods), historical flood-hotspot layers,
          stormwater-drain GeoJSON, and sewerage overlays for Bengaluru
          aren&apos;t published publicly (in contrast with Chennai&apos;s
          OpenCity-published layers). The page surfaces the rajakaluve
          (storm-drain) network from BWSSB&apos;s GIS extract and notes
          the recurring 2022 / 2024 outer-ring-road inundation
          (Whitefield / Sarjapur / ORR-East) tied to encroached
          rajakaluves and Bellandur-Varthur overflow.
        </p>
      </SubSection>

      <SubSection id="page-my-ward" title="My Ward / Report Card">
        <p className="text-slate-600 dark:text-slate-400">
          Ward-boundary map for the GBA&apos;s 369-ward post-15-May-2025
          delimitation (notified 19 Nov 2025), spread across 5 City
          Corporations. Click a ward to see corporation, area,
          centroid, the parent CGWB block&apos;s exploitation
          percentage, and a link into the per-ward risk panel.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          Per-ward risk panel
        </h4>
        <p className="text-slate-600 dark:text-slate-400">
          Each ward shows its 3-factor risk composite (described above
          under Groundwater), the A-F grade, the ward&apos;s rank within
          the city, and a per-factor breakdown. Without a specific ward
          selected, the page renders an index grouping ward chips by
          grade so you can jump straight to the worst-graded wards.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Bengaluru&apos;s report card is intentionally slimmer than
          Chennai&apos;s. Chennai ships a 5-factor composite plus an
          uplift-planner cost matrix; the costing layer is out of scope
          here because the underlying drainage and flood-hazard layers
          aren&apos;t published for Bengaluru.
        </p>
      </SubSection>

      <SubSection id="page-facts" title="Water facts">
        <p className="text-slate-600 dark:text-slate-400">
          Journalist-ready quotable stats grouped by freshness tier -
          live (this season), derived (last 12 months), historical
          (documented), and heritage (pre-modern). Today {cityName}{" "}
          ships ~32 hand-curated facts spanning the JICA Phase 3
          infrastructure numbers (1,310 MLD supply, 95 km transmission,
          48% NRW, ~5.8M served), the CGWB GEC findings (all 6 blocks
          Over-Exploited since 2011, Bangalore-East at 306%, Yelahanka
          140 → 260 in 4 years), the IISc 65 stress-ward count, the
          foam-and-fire chronology (16 Feb 2017 Bellandur burns), the
          cohort-level water-loss numbers (Hesaraghatta 369.5 ha lost),
          the restoration-recovery numbers (Puttenahalli body water
          +50 pp, Jakkur engineered-wetland model), Heritage anchors
          (1537 Kempegowda founding, 1882 Sankey, 1894 Hesaraghatta),
          and the GBA 369-ward administration baseline.
        </p>
      </SubSection>

      <SubSection id="page-origins" title="Origins (long-read)">
        <p className="text-slate-600 dark:text-slate-400">
          A 4-chapter long-read at{" "}
          <a
            href={`/${cityId}/origins`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            /{cityId}/origins
          </a>{" "}
          covers the Kempegowda founding (1537) → Cantonment +
          Hesaraghatta (1882 / 1894) → Cauvery stages (1974 → 2024) →
          today&apos;s parallel water economy (tankers + over-extracted
          borewells + IISc-flagged stress wards). 11 named sources
          anchor the narrative including Nagendra&apos;s{" "}
          <em>Nature in the City</em>, the JICA Phase 3 Final Report,
          IISc Groundwater Outlook, NGT Forward Foundation v Karnataka,
          and Forward Foundation / Friends of Lakes citizen-group
          accounts. Replaces a Chennai-style runtime LLM CityStory with
          a hand-edited historical narrative.
        </p>
      </SubSection>
    </>
  );
}
