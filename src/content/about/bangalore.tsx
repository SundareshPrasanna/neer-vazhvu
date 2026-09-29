"use client";

import { getPlaceConfig } from "@/lib/cities";
import { SubSection, DataSource, type LostBodyEntry } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { BangalorePageDescriptions } from "./bangalore-pages";

// Documented lost + severely-reduced Bengaluru kere, anchored on
// Harini Nagendra, Nature in the City: Bengaluru (OUP 2016) +
// Fathima Samana (2008) + IISc CES survey + Citizen Matters
// reporting. 5 fully-lost and 4 severely-reduced; conservative
// inventory of NAMED conversions. Greater Bengaluru had ~280
// kere in 19th-century gazetteers vs ~100 functional today,
// so the fully-lost set runs into the dozens at BBMP scale.
const BANGALORE_LOST_BODIES: LostBodyEntry[] = [
  { name: "Dharmambudhi tank",       status: "Fully lost",       source: "Nagendra (OUP 2016) - drained 1950s for Majestic bus station" },
  { name: "Sampangi tank",           status: "Fully lost",       source: "Nagendra (OUP 2016) - now Sri Kanteerava stadium complex" },
  { name: "Karanji Anjaneya tank",   status: "Fully lost",       source: "Nagendra (OUP 2016) - Bishop Cotton Boys School playing fields" },
  { name: "Akkithimmanahalli tank",  status: "Fully lost",       source: "Nagendra (OUP 2016) - hockey stadium uses the tank's name" },
  { name: "Domlur tank",             status: "Fully lost",       source: "Nagendra (OUP 2016) - BDA Domlur Layout + arterial road network" },
  { name: "Kempambudhi tank",        status: "Severely reduced", source: "INTACH Bengaluru + Nagendra (OUP 2016) - Kempegowda family-deity tank, sewage-receiving" },
  { name: "Halsoor (Ulsoor) Lake",   status: "Severely reduced", source: "Nagendra (OUP 2016) - 1811 Cantonment encroachment cut into original perimeter" },
  { name: "Sankey Tank",             status: "Severely reduced", source: "Nagendra (OUP 2016) - 1882 colonial decorative tank, foot-of-its-former extent" },
  { name: "Bellandur Lake",          status: "Severely reduced", source: "T.V. Ramachandra IISc CES + NGT Forward Foundation v Karnataka OA 222/2014" },
];

/** Bangalore's About-page content: the slots of the shared About frame that
 *  are specific to Bangalore. A slot not listed renders the frame's default. */

export default function BangaloreAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "reading-1":
      return (
        <>
            <SubSection title="How Bengaluru's tap is fed today">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Bengaluru&apos;s drinking water travels a much longer path than Chennai&apos;s or Madurai&apos;s:
                <span className="font-semibold"> Cauvery river (Karnataka allocation 270 TMC of the CWDT 726-TMC pool) → 4 upstream Karnataka reservoirs (KRS 48.4 TMC + Hemavathi 35.7 + Kabini 19.5 + Harangi 8.5) → BWSSB pumps from T.K. Halli 95 km north + 500 m elevation lift → 6 WTPs at the headworks (Cauvery Stages I-V, 2,293 MLD installed) → ~14,384 km BWSSB distribution mains → 84 ground-level reservoirs / 84 distribution stations across 9 administrative zones → ~11.46 lakh piped connections → tap.</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                Three structural facts worth knowing when reading the dashboard&apos;s headline:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
                <li>
                  <span className="font-semibold">The 4 upstream dams aren&apos;t Bengaluru&apos;s tap supply.</span> They are irrigation-primary reservoirs owned by the Karnataka Water Resources Department; the city&apos;s drinking-water carve-out is the slice released into BWSSB&apos;s pumping line at T.K. Halli. We track them because they set the seasonal ceiling on what BWSSB can pump - similar to how Madurai tracks Mullaperiyar even though it&apos;s in Kerala.
                </li>
                <li>
                  <span className="font-semibold">~36% non-revenue water.</span> Audited at 36% for 2017-18 (ISEC Working Paper 505, computed from BWSSB data), down from ~48% in 2007/2017; BWSSB reports a further reduction toward ~30%, not yet independently audited. Even at 36%, more than a third of what BWSSB pumps 95 km is lost between WTP and household meter (physical leakage + commercial losses + unmetered uses). Bringing NRW under 20% would free more water than the entire Stage V augmentation.
                </li>
                <li>
                  <span className="font-semibold">BWSSB&apos;s ~14M jurisdiction overstates piped reach.</span> BWSSB now reports serving ~14M residents, but &quot;served&quot; is a within-jurisdiction figure, not piped coverage: independent benchmarking (ISEC) put actual coverage at ~71% (2017-18), and ~11.46 lakh metered connections in a 14M-person city leave large gaps filled by private borewells (over-extracted - all 6 CGWB blocks Over-Exploited since 2011) and the ~5,000-tanker informal economy. The piped/non-piped split is the single biggest equity gap in Bengaluru&apos;s water story.
                </li>
              </ul>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                What the dashboard <span className="font-semibold">does</span> show: the Cauvery Pumping hero (2,293 MLD installed across Stages I-V / 6 WTPs, ~1,500 MLD delivered, 95 km / 500 m lift, 36% NRW, ~14M served), live daily storage at the 4 upstream Karnataka dams (from Karnataka&apos;s own KWRIS reservoir feed - the state&apos;s native numbers for its own dams, which read higher and fresher than Tamil Nadu&apos;s downstream-monitoring figures we used earlier), 8 years of daily history per dam (2018-today, pre-2026-07 history from the TN Agriculture feed), 14-day AutoARIMA forecasts per dam, and the Stage V under-delivery flag from The Ken (Feb 2026: ~400 MLD actual vs 775 MLD design).
              </p>
            </SubSection>
          
            <SubSection title="What's missing today">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Several daily-operations layers aren&apos;t part of Bengaluru&apos;s public dataset. Most are tracked inside BWSSB&apos;s SCADA / IoT systems for internal monitoring; they just aren&apos;t routed to a public surface. Listed here so users know where this dashboard&apos;s daily view ends, and which RTI / partnership unlocks would move it from structural numbers to a real measured runway.
              </p>
              <div className="space-y-3 mt-3">
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Daily T.K. Halli WTP raw + treated throughput per stage</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    The 5 Cauvery Stage I-V WTPs at T.K. Halli have SCADA-monitored daily raw-water intake and treated-water output. The JICA Phase 3 report flagged Stage V&apos;s designed 775 MLD; The Ken&apos;s Feb 2026 reporting put actual delivery at ~400 MLD - a daily series would close the gap between &quot;commissioned&quot; and &quot;delivering&quot;.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Per-zone supply across the 9 BWSSB administrative zones</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Zone-level supply telemetry isn&apos;t in the public dataset today. With it the dashboard could show which IISc-flagged stress wards (65 wards on the 2025 IISc Groundwater Outlook) are actually getting served vs which rely on tankers + over-extracted borewells.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">CWR-wise live storage (84 ground-level reservoirs)</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Aggregate CWR + WDSS count is documented in `bangalore-supply-overview.json` from JICA Phase 3; per-CWR live levels live in BWSSB&apos;s SCADA. Per-CWR readings would surface zone-level supply gaps in near real time.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Tanker calls served via Kaveriwheels app</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    BWSSB&apos;s Kaveriwheels app booking + delivery log would let us correlate stress-ward demand against IISc&apos;s 65-ward critical list. With ~19,000 downloads in a 14M city (2.8/5 rating), it&apos;s nowhere near the full ~5,000-tanker informal market scale OpenCity surveys - a public booking feed would expose that gap.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">39 STP daily compliance + treated-effluent quality</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    KSPCB&apos;s OCEMS (Online Continuous Effluent Monitoring System) collects per-STP outlet readings continuously, but the public-facing dashboard is intermittent and partial. A daily public feed would link STP underperformance to the K&amp;C cascade foam events at Bellandur / Varthur.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">In flight: BWSSB Stage V monthly progress report</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    BWSSB publishes Stage V commissioning + Phase 3 progress reports irregularly. Parsing them to convert the headline static &quot;775 MLD design&quot; into a measured monthly delivery time series is the next planned data unlock here.
                  </p>
                </div>
              </div>
            </SubSection>
          
        </>
      );
    case "pages-1":
      return (
        <>
            <BangalorePageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="TN Agriculture - daily reservoir page + dated archive"
                url="https://tnagriculture.in/ARS/home/reservoir"
                description="The same TN Agri page that feeds Madurai's Vaigai + Mullaperiyar also serves daily storage / level / inflow / outflow for the 4 upstream Karnataka Cauvery dams (KRS, Hemavathi, Kabini, Harangi). Cauvery is a shared inter-state basin, so the dams appear on the same TN page even though they sit in Karnataka. Dated archive back to 2018-01-01 powers the 8-year history chart per dam."
                frequency="daily + 2018 archive"
              />
              <DataSource
                name="JICA Phase 3 Final Report (Bengaluru Water Supply and Sewerage Project)"
                url="https://www.jica.go.jp/"
                description="Historical stage build-out, allocation and demand projections from the JICA Phase 3 Preparatory Survey Final Report (November 2017): 95 km transmission distance + 500 m elevation lift; 84 ground-level CWRs + 84 WDSS across 9 zones; 2,235 MLD CWSS allocation; 2034 demand projection 2,608 MLD; project cost Rs 5,690 crore (85% JICA loan). Supply capacity, connections, population, network and NRW/per-capita figures refreshed June 2026 to BWSSB-official sources (BWSSB 'About' page + April 2026 Chairman interview, Elets eGov; ISEC Working Paper 505 for audited NRW): 2,293 MLD installed across 6 WTPs (Stage V commissioned 16 Oct 2024) / ~1,500 MLD delivered; 36% NRW (audited 2017-18); ~14M served; ~11.46 lakh connections; ~14,384 km mains; 108 LPCD consumption. Powers the Cauvery Pumping hero + bangalore-supply-overview.json."
                frequency="static (Nov 2017 baseline; periodic refresh on subsequent JICA reports)"
              />
              <DataSource
                name="BWSSB Stage V commissioning + The Ken under-delivery reporting"
                url="https://the-ken.com/"
                description="Stage V was commissioned at T.K. Halli on 16 October 2024 with 775 MLD design capacity. The Ken reported in Feb 2026 that actual delivery is ~400 MLD - about half the design. The shortfall is part of why ~33% of BBMP wards (IISc Groundwater Outlook 2025) still rely on tankers + over-extracted borewells."
                frequency="incident-driven"
              />
              <DataSource
                name="Reservoir forecast (AutoARIMA)"
                url={`/${config.cityId}`}
                description="14-day forecast with 80% confidence band per dam (KRS, Hemavathi, Kabini, Harangi), refit daily as new readings land. Fitted on a 2-year history window for tractable wall-clock; seasonal AutoARIMA with annual season_length=365."
                frequency="daily refit"
              />
            </>
          
        </>
      );
    case "data-sources-3":
      return (
        <>
            <DataSource
              name="OSM Nominatim + Overpass - locality search points"
              url="https://overpass-api.de/"
              description="369 Bengaluru neighbourhood points (Whitefield, Indiranagar, Koramangala, HSR Layout, JP Nagar, Yelahanka, Hesaraghatta, Bommanahalli, etc.) - one per GBA ward. Powers locality-name -> ward resolution in the my-ward search box."
              frequency="periodic (one-off refresh today)"
            />
          
        </>
      );
    case "data-sources-4":
      return (
        <>
            <>
              <DataSource
                name="CGWB telemetric DWLR station inventory (Bangalore Urban district)"
                url="https://indiawris.gov.in/wris/"
                description="13 telemetric DWLR stations across Bangalore Urban district observed via the India-WRIS API: Nimhans, Lalbagh Garden, Jayanagar (IISc stress ward), Hesaraghatta Piezometer, Thalaghattapura, Anekal, Cubbon Park, Dasanapura, Indian Institute of Science, Yelahanka (IISc stress ward), Adugodi, Bangalore University Ars Ls, Singasandra. Density ~1 station per 21 sq km is too sparse to honestly IDW across 369 GBA wards - so the per-ward depth choropleth is deliberately disabled here (Chennai's depth view is supported by OpenCity's monthly per-ward survey, which Bengaluru doesn't have an equivalent for)."
                frequency="annual (Year Book hydrograph back-fill is a follow-up RTI / PDF parse)"
              />
              <DataSource
                name="IISc Groundwater Outlook for Bengaluru (April 2025)"
                url="https://bwssb.karnataka.gov.in/"
                description="BWSSB-commissioned IISc Groundwater Outlook (April 2025) identifies 65 of 198 BBMP wards (~33%) as critically over-extracted - operating beyond CGWB's safe-yield limit. Stage V was designed to relieve these wards via piped supply; the Stage V under-delivery is why most remain on groundwater + tankers. Referenced by the round-7 cgwb-stations file (per-station proximity flag) and surfaced in the dashboard's headline."
                frequency="periodic (per IISc release)"
              />
              <DataSource
                name="WELL Labs Bengaluru Urban Water Balance Report (Jan 2024)"
                url="https://welllabs.org/"
                description="Independent academic-grade water balance for Greater Bengaluru: rainfall, runoff, recharge, demand, supply gap, source-mix accounting. Used as a cross-check against JICA Phase 3 numbers; cited in `bangalore-supply-overview.json._secondary_local_source`."
                frequency="periodic (per WELL Labs release)"
              />
            </>
          
        </>
      );
    case "data-sources-5":
      return (
        <>
            <>
              <DataSource
                name="OSM bbox extract - 1,897 water-body polygons (BBMP)"
                url="https://www.openstreetmap.org/"
                description="OpenStreetMap community-mapped water bodies across BBMP, fetched via Overpass bbox query. 1,033 polygons larger than 1 ha become cascade nodes in the round-10 reconstruction; the rest are sub-hectare ponds."
                frequency="periodic (manual refresh)"
              />
              <DataSource
                name="Lake names - ATREE/CSEI + BBMP masterlist + KWRIS MI_Tanks"
                url="https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area"
                description="~67% of OSM water polygons ship unnamed. Real toponyms are backfilled by a priority-ordered spatial join of three named open sources onto still-unnamed polygons: the ATREE/CSEI named-lake census (1,349 polygons) and BBMP lakes masterlist (181) by polygon overlap, then Karnataka WRIS's KA:MI_Tanks Minor-Irrigation register (open GeoServer, 328 tank points in the Bengaluru bbox) by point-in-polygon. Every name carries its source + match-confidence; OSM-native names are never overwritten. The remaining unnamed bodies are honestly left blank rather than given a guessed name."
                frequency="periodic (re-run on source refresh)"
              />
              <DataSource
                name="Harini Nagendra - Nature in the City: Bengaluru (OUP 2016)"
                url="https://global.oup.com/academic/product/nature-in-the-city-9780199465927"
                description="Canonical academic source for Bengaluru kere history: ~280 named kere in 19th-century Greater Bengaluru gazetteers, ~100 functional today. The 9 fully-lost / severely-reduced bodies surfaced in our lost-narrative overlay (Dharmambudhi -> Majestic, Sampangi -> Sri Kanteerava, Karanji Anjaneya -> Bishop Cotton, etc.) are anchored on Nagendra's documentation."
                frequency="static (book; supplements added via DHAN / INTACH / IISc CES papers)"
              />
              <DataSource
                name="T.V. Ramachandra (IISc CES) - Wetlands of Bengaluru"
                url="https://wgbis.ces.iisc.ac.in/energy/water/paper/ETR101/bangalore.html"
                description="IISc Centre for Sustainable Technologies (CES) 105-lake survey + ongoing Bellandur / Varthur monitoring. Cited in restoration-priority narrative, the K&amp;C foam cascade story, and the rich-body cohort's water-trend caveats."
                frequency="periodic (academic papers)"
              />
              <DataSource
                name="NGT Forward Foundation v State of Karnataka (OA 222/2014)"
                url="https://greentribunal.gov.in/"
                description="The 2016 NGT order that imposed the 75 m no-construction buffer around BBMP lakes + 50 m around rajakaluves + 30 m around secondary drains, and halted Mantri Tech Park (Espana) and Coremind constructions encroaching the Bellandur buffer. The legal anchor for every BBMP rich-body panel's status badges."
                frequency="incident-driven (NGT orders + compliance hearings)"
              />
              <DataSource
                name="Bengaluru rich-data lake cohort (14 bodies)"
                url={`/${config.cityId}/water-bodies`}
                description="14 flagship lakes with the full deep-zoom panel: Bellandur, Varthur, Madivala, Ulsoor, Hebbal, Sankey, Yelahanka, Kempambudhi, Hesaraghatta, Agara, Puttenahalli, Jakkur, Rachenahalli, Iblur. Each ships polygon + 1 km halo + 37-year imagery slider (1990-2026 yearly) + JRC water-loss tint (1988-92 vs 2017-21) + Dynamic World water-class extension (2022-now) + Dynamic World built-gain tint (2016-18 vs 2023-25) + Open Buildings v3 + Overture Q1 2026 stats + curated timeline + sources modal."
                frequency="periodic (cohort additions in rich-body rounds)"
              />
            </>
          
        </>
      );
    case "data-sources-6":
      return (
        <>
            <>
              <DataSource
                name="KSPCB / CPCB river quality monitoring"
                url="https://kspcb.karnataka.gov.in/"
                description="9 stations across the 3 Bengaluru rivers (Vrishabhavathi / Arkavathi / Dakshina Pinakini) extracted from KSPCB monthly water quality reports cross-referenced with CPCB NWMP annual River Water Quality reports. Per-station BOD / COD / DO / pH / fecal coliform readings, 2020-2024 covered. Station coordinates are government-record GPS locations, field-verified with Paani Earth (Jul 2026). Note: OSM polylines for these rivers are partial through built-up BBMP (urban segments flow as storm drains), so some markers sit away from the drawn river lines."
                frequency="monthly (KSPCB) + annual (CPCB)"
              />
              <DataSource
                name="NGT + Karnataka HC litigation on Bellandur / Varthur foam events"
                url="https://greentribunal.gov.in/"
                description="The 16 Feb 2017 Bellandur foam fire drew international news + a PMO statement. NGT constituted a Bellandur-Varthur monitoring committee under retired Justice Santosh Hegde and ordered the 75 m / 50 m / 30 m buffer regime. A second foam fire in January 2018 escalated compliance pressure. The 2017 NGT order is the legal anchor for both the rich-body panels' status badges and the K&amp;C foam cascade in the round-18 cascades page."
                frequency="incident-driven"
              />
              <DataSource
                name="K&amp;C valley + Vrishabhavathi industrial pollution sources (14 clusters)"
                url={`/${config.cityId}/rivers`}
                description="14 industrial clusters mapped as type-coloured markers across the three valleys: Peenya, Bommasandra, Yelahanka, Mahadevapura, Whitefield, Bidadi (Toyota / Bidadi industrial belt), Doddaballapur, plus textile-dyeing / electroplating / tannery clusters that feed the Vrishabhavathi and K&amp;C catchments. Compiled from KIADB records, KSPCB consent-to-operate filings, and IISc CES academic surveys."
                frequency="manual"
              />
              <DataSource
                name="KSPCB OCEMS - online effluent monitoring"
                url="https://kspcb.karnataka.gov.in/"
                description="Karnataka State Pollution Control Board's online continuous effluent monitoring system for red-category industries. Public-facing dashboard is intermittent and partial; cross-check reference for the curated industrial sources list."
                frequency="real-time (when feed is up)"
              />
              <DataSource
                name="Arkavathi Polluted River Stretch (PRS) surface"
                url={`/${config.cityId}/rivers`}
                description="The polluted-stretch entry point on the basin atlas: the CPCB/NGT stretch 2020 vs 2025, its priority, and per-area gaps (sewage, industrial, solid, hazardous, FSTP, e-flow, treated-water reuse, flood plain). Built from 7 NMCG Monthly Progress Reports (Karnataka, 2020-2026), the CPCB &lsquo;Polluted River Stretches for Restoration of Water Quality - 2025&rsquo; report (Oct 2025; Arkavathi Priority I, BOD 72 mg/L, Hesaraghatta to d/s Kanakapura), District Environment Plans (Ramanagara 2021, Bengaluru Urban 2022), and Paani Earth&apos;s digitised stretch geometry. KSPCB&apos;s own 2022-23 lab reads Priority IV - shown as a central-vs-state divergence. Every figure carries its admin level; &lsquo;nil / not reported&rsquo; means absent from the documents, not necessarily absent on the ground. Co-built with Paani Earth."
                frequency="NMCG monthly; CPCB + DEP periodic"
              />
              <DataSource
                name="KSPCB F-register - consented-industry register (2019)"
                url="https://kspcb.karnataka.gov.in/sites/default/files/inline-files/Ramanagara.pdf"
                description="The KSPCB Regional-Office registers of consented industries (Water/Air Act), as on 31-03-2019, published as scanned PDFs. Extracted per taluk and by pollution category (Red/Orange/Green/White) for the basin&apos;s ROs - Ramanagara (Ramanagara/Kanakapura/Magadi/Channapatna), Peenya + Dasarahalli (Vrishabhavathi valley), Nelamangala and Doddaballapura (headwaters). ~11,800 consented industries basin-wide, at least ~37% Red/Orange - the industrial denominator against which only ~12 appear on CPCB continuous monitoring. Per-taluk counts on the Gaps layer; basin summary in the PRS Industrial tab. Counts are OCR-extracted and approximate; SE/N Bengaluru ROs (Bommanahalli/Yelahanka) excluded as they drain to other basins. See scripts/build_fregister.py."
                frequency="periodic (KSPCB republishes registers)"
              />
            </>
          
        </>
      );
    case "data-sources-7":
      return (
        <>
            <DataSource
              name="Google Earth Engine layers (shipped in the rich-lake panels)"
              url={`/${config.cityId}/water-bodies`}
              description="Already live for the 14-lake rich cohort rather than planned: 37-year yearly imagery sliders (Landsat + Sentinel-2, 1990-2026), JRC Global Surface Water loss tint (1988-92 vs 2017-21), Dynamic World water-class extension (2022-now) and built-gain tint (2016-18 vs 2023-25), plus Open Buildings and Overture building stats per lake halo."
              frequency="periodic (per cohort round)"
            />
          
        </>
      );
    case "data-quality-2":
      return (
        <>
            <SubSection title={`Open data gaps in ${cityName}`}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Layers we&apos;d like to surface for Bengaluru that aren&apos;t publicly released yet. Each one has the workaround currently in place; tracked as RTI / partnership follow-ups.
              </p>
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public flood-hazard return-period layer</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Standard 5 / 10 / 25 / 50 / 100 / 200-year flood return-period polygons are not currently published for Bengaluru. The flood-risk page surfaces the BWSSB rajakaluve / sewerage trunk network + a narrative on recurring Whitefield / Sarjapur / ORR-East inundation tied to encroached storm drains and Bellandur-Varthur overflow.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public BBMP rajakaluve GeoJSON</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The primary stormwater drain (rajakaluve) network is mapped internally by BBMP but the GeoJSON is not publicly released. NGT Forward Foundation order set a 50 m buffer regulation around them but enforcement requires the boundary; tracked as an RTI / GBA-partnership follow-up.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public BWSSB tanker call log / Kaveriwheels feed</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    BWSSB&apos;s Kaveriwheels app (~19K downloads in a 14M city) collects booking + delivery data but does not publish a feed. OpenCity Tanker Survey 2024-25 fills the gap with a ~5,000-tanker estimate + crisis-peak rate spreads; a public Kaveriwheels feed would let us correlate stress-ward demand against IISc&apos;s 65-ward critical list.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">No per-ward depth choropleth (deliberate)</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Bengaluru has 13 CGWB telemetric DWLR stations across 369 GBA wards - density ~1 station per 21 sq km, far too sparse to honestly interpolate a per-ward choropleth. Instead the groundwater page surfaces the 13-station point overlay alongside the 6-block GEC exploitation classification + 3-factor ward risk composite. The IDW-interpolated view that Chennai uses is deliberately disabled because Bengaluru lacks Chennai&apos;s equivalent of the OpenCity monthly per-ward survey.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Per-station hydrograph readings deferred</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The 13 CGWB station markers carry name + block + IISc-stress-ward proximity but the annual hydrograph series (peer-reviewed quarterly depth-to-water-level readings) hasn&apos;t been transcribed from the CGWB Karnataka Year Book yet. Tracked as a follow-up Year Book PDF parse / RTI.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Lost-kere coordinates not populated</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The 9 Nagendra-anchored lost / severely-reduced kere have name + status + conversion note but no lat/lng - the fully-lost ones (Dharmambudhi, Sampangi, Karanji Anjaneya, Akkithimmanahalli, Domlur) have no OSM presence (they&apos;re under bus stations, stadiums, schools and BDA layouts). The 4 severely-reduced bodies are mappable via their OSM osm_ids (Kempambudhi, Ulsoor, Sankey, Bellandur) and already surface in the rich-body cohort. Listed as a Tier 3 follow-up.
                  </p>
                </div>
              </div>
            </SubSection>
          
        </>
      );
    case "data-quality-3":
      return (
        <>
            <SubSection title="Documented lost + severely-reduced kere (Nagendra OUP 2016 + IISc CES)">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Conservative named-only inventory. Greater Bengaluru had ~280 kere in 19th-century gazetteers vs ~100 functional today, so the fully-lost set runs into the dozens at BBMP scale - this table lists only the named cases where conversion to built use is unambiguously documented.
              </p>
              <div className="overflow-x-auto hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {BANGALORE_LOST_BODIES.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 font-medium">{row.name}</td>
                        <td className="py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === "Fully lost"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500 dark:text-slate-400 text-xs">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden space-y-2">
                {BANGALORE_LOST_BODIES.map((row) => (
                  <div key={row.name} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
                      <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.status === "Fully lost"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                      }`}>
                        {row.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.source}</div>
                  </div>
                ))}
              </div>
            </SubSection>
          
        </>
      );
    case "source-imd-rainfall":
      return (
        <>
          <DataSource
            name="IMD Gridded Rainfall (via imdlib)"
            url="https://imdlib.readthedocs.io/"
            description="India Meteorological Department 0.25-degree gridded rainfall, 1970-present. Bengaluru grid cell at 12.97 deg N, 77.6 deg E. Used for monsoon-context overlays (Bengaluru is south-west monsoon dominant with a smaller north-east monsoon tail through Oct-Nov; Cauvery basin recharge depends on both)."
            frequency="monthly archive"
          />
        </>
      );
    case "source-wris-gwr":
      return (
        <>
          <DataSource
            name="India WRIS / CGWB - block-level Dynamic GWR"
            url="https://indiawris.gov.in/"
            description="Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited). 6 canonical blocks across Bangalore Urban district (Bangalore (North), Bangalore-East, Bangalore-South, Bangalore-City, Yelahanka, Anekal) across 9 editions: 2011-2017 from the WRIS ArcGIS REST endpoint, 2019-20 to 2025-26 from the IN-GRES API. All 6 blocks are Over-Exploited in every edition (Bangalore-East worst at 395% of extractable groundwater in 2025-26; Yelahanka 157% in 2021-22, when the units were last redrawn, 251% in 2025-26)."
            frequency="annual"
          />
        </>
      );
    case "flood-infrastructure":
      return (
        <>
            <>
              <DataSource
                name="BWSSB sewerage trunk network (14,121 km)"
                url={`/${config.cityId}/water-bodies`}
                description="14,121 km of mapped underground sewerage trunks feeding the 39 BWSSB STPs, extracted from a BWSSB GIS source. Gravity-fed except across the ridge between valleys, where pumping stations lift to the next basin."
                frequency="static (manual refresh)"
              />
              <DataSource
                name="BWSSB STP inventory (39 plants)"
                url={`/${config.cityId}/water-bodies`}
                description="39 STPs as of 2024 (vs 14 at the JICA Phase 3 baseline in 2017) with locations + design capacity. Aggregate installed capacity ~1,500 MLD against ~1,400 MLD generation; the treatment-meets-generation milestone disguises persistent KSPCB compliance gaps at older plants."
                frequency="static (manual refresh)"
              />
              <DataSource
                name="Pending RTI to BBMP / GBA - flood hazard zones + rajakaluve network"
                url={`/${config.cityId}/flood-risk`}
                description="Standard 5 / 10 / 25 / 50 / 100 / 200-year flood return-period polygons + the BBMP rajakaluve (primary storm drain) GeoJSON + historical flood hotspots (Whitefield / Sarjapur / ORR-East inundation events 2022 / 2024) aren't publicly released for Bengaluru today. Tracked as RTI follow-ups to BBMP and the Greater Bengaluru Authority."
                frequency="data gap"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
