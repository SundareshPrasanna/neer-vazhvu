"use client";

/**
 * Mumbai-specific "What each page shows" subsections.
 *
 * English-only for now; Marathi prose follows in the i18n pass (the
 * Madurai/Bangalore files carry a second language-conditional variant).
 * Documents the layers actually shipped for Mumbai V1 and is explicit
 * about the honest gaps that distinguish Mumbai from the Chennai
 * baseline.
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

export function MumbaiPageDescriptions({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} is reservoir-impounded like Chennai - the seven BMC lakes (Bhatsa, Upper and
          Middle Vaitarna, Modak Sagar, Tansa, Vihar, Tulsi) are the city&apos;s tap, so the
          headline is an honest days-of-supply-left figure rather than an allocation. Bhatsa alone
          supplies about 48% of the water. Praja Foundation&apos;s 2024 audit puts BMC supply at
          3,975 MLD against a demand of 4,664 MLD (~15% shortfall); BMC&apos;s own stated draw is
          3,850 MLD - a different measure of the same system - and that drawdown rate is what the
          runway divides storage by.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Daily lake levels come from the Maharashtra WRD Pravah dam-safety feed - the official
          daily bulletin covering 5 of the 7 lakes (~97% of system capacity); Vihar and Tulsi
          (BMC-owned, in-city, under 3% of capacity) have no public feed. BMC itself publishes no
          CMWSSB-style bulletin - its Hydraulic Engineer page is a closed portal applet. The lakes
          sit 30-130 km outside the city; they render as source cards, not map pins.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The headline figure is labelled an <strong>upper bound</strong>: storage counts the full
          live water in the five state-owned dams, part of which serves users beyond BMC. And
          because the Pravah bulletin publishes storage only (no inflows), the rain scenarios other
          cities carry collapse here to a single at-current-draw figure that states its divisor.
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">A decade of history; no forecast yet</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The history chart spans February 2015 to the present for Bhatsa and Upper Vaitarna -
            weekly readings recovered from the Central Water Commission&apos;s bulletin archive
            (discontinued May 2025) - and opens on the All-time view. The other three fed lakes have
            no public archive before July 2026; their record accumulates from the daily Pravah
            scrape, which also harvests the bulletin&apos;s same-date-last-year column so each run
            adds two years of context. AutoARIMA forecasts (Chennai-style) follow once the daily
            history banks up. Rainfall pairs IMD&apos;s gridded history with a daily provisional
            layer so the current monsoon appears as it happens, asterisked until IMD confirms it.
          </p>
        </div>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} City and {cityName} Suburban are the only two of Maharashtra&apos;s 35 districts
          left out of the CGWB Dynamic Ground Water Resources Assessment - they are treated as fully
          urban and never classified Safe / Critical / Over-Exploited. So there is no block
          exploitation choropleth to show; the absence is itself the finding.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">CGWB observation-well overlay + ward depth estimate</h4>
        <p className="text-slate-600 dark:text-slate-400">
          What does exist is a point network: 53 CGWB manual dug wells across the metro (25 inside
          Greater Mumbai, the rest in Thane, Vasai and Panvel/Uran), transcribed from the CGWB
          Ground Water Year Book of Maharashtra and shown as click-through markers with each
          well&apos;s seasonal depth history. The ward depth view interpolates these wells into a
          per-ward estimate for the 24 BMC wards.
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Seasonal, not live - and not assessed</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The Year Book runs four seasonal readings a year (currently to January 2025); Mumbai has
            no DWLR (telemetric) stations, so nothing here is a live feed. The ward depth surface is
            an estimate, not a survey - the interpolation method and station count are disclosed on
            the map, and wards too far from any well render as no-data rather than a guess. The
            other corporations&apos; wells appear as points only, because their ward boundaries are
            not published.
          </p>
        </div>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className="text-slate-600 dark:text-slate-400">
          Four rivers - the Mithi, Dahisar, Poisar and Oshiwara - drawn from OpenStreetMap with
          their monitoring points. In CPCB&apos;s October 2025 assessment the Mithi at Mahim is
          <strong> India&apos;s single worst polluted river stretch</strong> (Priority I, max BOD
          210 mg/l); the other three do not appear in the national list at all - they are barely
          monitored as rivers, which is its own finding. The Mithi, an 18 km open drain from the
          Powai/Vihar overflows to Mahim Creek, is the river that overflowed in the 26 July 2005
          deluge.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Mithi water quality (2018-2023)</h4>
        <p className="text-slate-600 dark:text-slate-400">
          The Mithi station carries a real series extracted from the MPCB 2019 Mithi River Action
          Plan (2017-18 monthly pH/DO/BOD/FC at Mithi Bridge) and CPCB&apos;s National Water Quality
          Monitoring Programme (2019-2023 annual maxima, via Praja&apos;s 2024 report). Maximum BOD
          rose from 95 mg/l (2018) to 210 (2023) and faecal coliform reached 540,000 MPN/100 ml,
          far past the bathing norm. MPCB&apos;s live portal returns N/A; these numbers come from the
          report PDFs. The other three rivers (Dahisar, Poisar, Oshiwara) are genuinely not monitored
          by MPCB or CPCB, so they carry no readings.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Sewage-treatment plants</h4>
        <p className="text-slate-600 dark:text-slate-400">
          The map also marks Mumbai&apos;s 9 operational MCGM sewage-treatment plants with their
          capacity and treatment performance (MPCB inventory + Praja&apos;s RTI-obtained per-STP
          inlet/outlet BOD, 2020-2024). Four - Versova, Bhandup, Ghatkopar and Malad - consistently
          fail the 10 mg/l discharge standard; Malad effectively does not treat at all (2023 outlet
          BOD 140.6 vs inlet 144.2). Worli, Bandra, Colaba and Charkop are compliant.
        </p>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk">
        <p className="text-slate-600 dark:text-slate-400">
          Mumbai floods when an intense monsoon cloudburst coincides with a high tide that shuts the
          city&apos;s gravity outfalls and an under-capacity drainage network cannot clear the water -
          a different driver from Madurai&apos;s dam releases, so the page is its own. It maps the
          110 flooding spots in BMC&apos;s own Disaster Management register (official names, wards
          and coordinates, each spot tied to an automatic rain gauge - Hindmata, Milan/Andheri/Khar
          subways, King&apos;s Circle and the rest), with the citywide context stated honestly: the
          2026 pre-monsoon list counts 496 spots, of which only these 110 are published with
          locations. Two further toggles carry the reference event and the mechanism: the 26 July
          2005 deluge layer (sourced from the Concerned Citizens&apos; Commission record, with
          reported depths where the record gives one) and the ~350 km OSM-mapped storm-drain and
          nalla network - real geometry, but community-traced, not BMC&apos;s BRIMSTOWAD as-built
          survey.
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Data we don&apos;t have</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            iFLOWS-Mumbai, the city&apos;s integrated flood-warning system, was built with public
            money but briefs officials only - no public dashboard or API. The BMC publishes no open
            BRIMSTOWAD stormwater-drain GeoJSON and no modelled hazard-zone / return-period polygons.
            The best openly available flood-precursor is the IITM Mumbai-rain mesh, India&apos;s only
            city-scale polarimetric-radar rainfall network.
          </p>
        </div>
      </SubSection>

      <SubSection id="page-my-ward" title="My Ward / Report Card (in build - not yet live)">
        <p className="text-slate-600 dark:text-slate-400">
          Ward-boundary map for the 24 BMC administrative wards (A..T), not the 227 electoral wards -
          those exist only as SEC PDFs with no open geometry. Click a ward for its code, locality,
          area and a link into the rankings.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Ward risk composite (risk_v2_mum)</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Because {cityName} is excluded from the CGWB groundwater assessment, the Chennai /
          Bangalore groundwater-led ward composite is not honest here. {cityName}&apos;s defining
          water risk is service equity - the citywide average supply is just 5.37 hours a day, and
          only one ward in 24 gets 24x7 (Praja 2024) - plus monsoon flooding. The composite is
          equity-first:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                <th className="pb-2 font-medium">Factor</th>
                <th className="pb-2 font-medium">Weight</th>
                <th className="pb-2 font-medium">Direction</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300 text-xs">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Water-supply deficit (per-ward avg hours/day, Praja 2024)</td>
                <td className="py-1.5 font-mono">50%</td>
                <td className="py-1.5">Fewer hours = higher risk</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Chronic flood exposure (hotspots in ward)</td>
                <td className="py-1.5 font-mono">30%</td>
                <td className="py-1.5">More spots = higher risk</td>
              </tr>
              <tr>
                <td className="py-1.5">Priority-I river burden (river length in ward)</td>
                <td className="py-1.5 font-mono">20%</td>
                <td className="py-1.5">More polluted river = higher risk</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          The supply-hours factor uses the real per-ward averages from Praja&apos;s 2024 report
          (Table 4) - from C / Marine Lines at 1.53 h/day to T / Mulund at 24 h - replacing an
          earlier slum-area-share proxy (still computed and shown as context). Each factor is
          converted to a city-wide percentile, weighted and summed; composite ≤20 = A, ≤40 = B, ≤60
          = C, ≤80 = D, &gt;80 = F. The worst-graded wards (Matunga/Sion, Goregaon, Bandra West)
          combine low supply hours with chronic flooding; the best is T / Mulund (24x7).
        </p>
      </SubSection>

      <SubSection id="page-facts" title="Water facts">
        <p className="text-slate-600 dark:text-slate-400">
          Journalist-ready, sourced facts grouped by category - supply, water equity, groundwater,
          rivers, floods, and coast &amp; wetlands. Today {cityName} ships 21 hand-curated facts,
          each with a source URL: the supply-demand gap, 34% non-revenue water (BMC audit, 2024),
          the building-level connections denominator, the slum/non-slum LPCD gap and the one ward
          in 24 with 24x7 supply, the groundwater-assessment exclusion, the Mithi as India&apos;s
          worst river stretch (CPCB, Oct 2025) and Powai&apos;s sewage load, the 26/7/2005 deluge,
          the locked iFLOWS model, the climate budget&apos;s flood bill, and the mangrove /
          salt-pan / Mahul / Gargai signature stories.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies & catchments">
        <p className="text-slate-600 dark:text-slate-400">
          OSM water-body polygons plus a lost-tank inventory and restoration priority scoring, with
          the Catchments view (FABDEM terrain-derived) making every lake clickable for its
          contributing area, feeder streams and downstream flow path - the same pipeline as the
          other cities. Powai&apos;s NGT record anchors the restoration entries.
        </p>
      </SubSection>

      <SubSection id="page-shoreline" title="Shoreline">
        <p className="text-slate-600 dark:text-slate-400">
          The same satellite shoreline-change measurement as Chennai (MNDWI transects, Landsat +
          Sentinel-2), west-coast orientation. No rate-publishing study exists for {cityName}, so
          the measurement is corroborated against the official record instead: NCCR&apos;s 1990-2016
          district table and the 2017 Shoreline Management Plan risk grades.
        </p>
      </SubSection>

      <SubSection id="page-allocations" title="Allocation Ledger">
        <p className="text-slate-600 dark:text-slate-400">
          Who is owed what water: 15 arrangements (source &rarr; authority &rarr; recipient) across
          the metropolitan region with entitled vs received, the instrument each rests on (WRD
          Government Resolutions, STEM board minutes, the MMRDA Annual Report) and a confidence
          grade. Ten of the fifteen carry the &quot;unreported&quot; verdict - a quota exists on
          paper but nobody publishes what actually flows - which is the ledger&apos;s central
          finding about how the region&apos;s water is governed.
        </p>
      </SubSection>

      <SubSection id="page-commitments" title="Commitments Register">
        <p className="text-slate-600 dark:text-slate-400">
          Nineteen dated commitments by named institutions - wastewater-facility commissioning dates
          from BMC&apos;s own climate budget and ESR, the Gargai / Kalu / Manori source projects,
          BRIMSTOWAD, flood-spot mitigation - each checked against time. Statuses change only with a
          dated citation; when a date slips, the old one stays on the record. Cross-linked with the
          Allocation Ledger entry-to-entry.
        </p>
      </SubSection>

      <SubSection id="page-origins" title="Origins">
        <p className="text-slate-600 dark:text-slate-400">
          The four-chapter water history - seven islands with no river, the first pipe at Vihar
          (1860), hydraulic citizenship, and 26/7 with the forty-five litres - with five licensed
          archival and contemporary images whose provenance is recorded file-by-file in the
          repository manifest.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          See also the dedicated Chennai about page (
          <Link href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">
            /about
          </Link>
          ) for the canonical methodology pattern this follows. My Ward is the one page still in
          build for {cityName}; it will be documented here when it ships. Linked
          from <Link href={`/${cityId}/facts`} className="text-blue-600 dark:text-blue-400 hover:underline">{`/${cityId}/facts`}</Link>.
        </p>
      </SubSection>
    </>
  );
}
