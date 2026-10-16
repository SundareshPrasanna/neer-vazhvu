"use client";

import { useLanguage } from "@/lib/i18n/context";
import { getPlaceConfig } from "@/lib/cities";
import { DataSource, DataSourceGroupHeader, SubSection } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { NagpurPageDescriptions } from "./nagpur-pages";

/** Nagpur's About-page content: the slots of the shared About frame that are
 *  specific to Nagpur. A slot not listed renders the frame's default.
 *
 *  data-sources-1 replaces the frame's default source index outright (the
 *  Chennai pattern): the default names India-WRIS levels and OpenStreetMap
 *  geometry, and Nagpur uses neither (NWDP telemetry; MRSAC's survey with
 *  OpenStreetMap names only). limitations and river-status-footnote replace
 *  defaults written for Chennai (Krishna water, OpenCity groundwater, CPCB
 *  annual readings). Source URLs follow scripts/source-registry/
 *  nagpur*.json; every figure is one a shipped artifact or registry note
 *  carries. */

const ESR_2023_24 = "https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf";

export default function NagpurAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const { t } = useLanguage();
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return <NagpurPageDescriptions cityId={config.cityId} cityName={cityName} />;
    case "reading-1":
      return (
        <SubSection title={`Why ${cityName}'s dashboard has no days-of-water figure`}>
          <p className="text-slate-600 dark:text-slate-400">
            The scenarios above apply to a city that stores its own water. {cityName}&apos;s
            two reservoirs are a hydro-electric dam shared with Madhya Pradesh and an
            irrigation dam, in which NMC holds a yearly reservation, and its Kanhan plant
            draws from the river itself. A countdown would treat the whole of that
            water as the city&apos;s, so the dashboard leads with the supply chain and the
            reservoir cards instead, and the allocation ledger sets the city&apos;s share
            beside what it is recorded as drawing.
          </p>
        </SubSection>
      );
    case "data-sources-1":
      return (
        <>
          <DataSourceGroupHeader title="Supply, reservoirs and the Pench share" />
          <DataSource
            name="NMC Environment Status Reports 2023-24 and 2022-23 (prepared by CSIR-NEERI)"
            url={ESR_2023_24}
            description="The corporation's latest published account of its water: five treatment plants and their capacities, water supplied and billed, the loss from source to consumer, the 73 command areas and the dark zones within them, and tap-water sampling (2023-24, section 6.2.1, printed pp.132-134). The 2022-23 edition gives the year before."
            frequency="yearly (2023-24 published Aug 2025)"
          />
          <DataSource
            name="NMC budgets 2026-27 and 2025-26, Commissioner's speech"
            url="https://nmcnagpur.gov.in/financial-statement"
            description="Water connections, water tanks, distribution mains and the tanker count (2026-27, pp.B-3 to B-4), and the money for the lake and river projects. The 2026-27 budget is a scanned Marathi document, read on its page images."
            frequency="yearly (2026-27 published May 2026)"
          />
          <DataSource
            name="NMC draft Environment Status Report 2017-18 (copy hosted outside NMC's website)"
            url="https://caknnagpur871784109.wordpress.com/wp-content/uploads/2019/12/environmental-status-report-nagpur-2017-18.pdf"
            description="The only report we have found with the city's draw source by source (Tables 4.3 and 4.4, p.23), and the history of the Kanhan intake and barrage. No NMC-hosted copy has been found, so the allocation ledger says where each 2017-18 figure comes from."
            frequency="one-time (2018)"
          />
          <DataSource
            name="Maharashtra Water Resources Regulatory Authority, Order 13/2018 (Case 8 of 2017)"
            url="https://mwrra.maharashtra.gov.in/wp-content/uploads/2022/08/Case-No-8-of-2017-Final-Order.pdf"
            description="The regulator's order of 12 September 2018 on NMC's Pench water: the history of the 112 and 78 million cubic metre reservations, NMC's water budget, and directions to cut distribution losses. A scan, read on its page images."
            frequency="one-time (Sept 2018)"
          />
          <DataSource
            name="Water Resources Department resolutions on the Pench (2019, 2020, 2023)"
            url="https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/Marathi/202003191442414827.pdf"
            description="The re-planning of 19 March 2020 that sets NMC's share at 190 million cubic metres a year, and 341 in a second phase; the Lohghogari tunnel approval of 18 September 2019; the Kolar-Kanhan barrage study of 18 April 2023, read from the orgpedia archive copy because the official address did not open on 15 October 2026. In Marathi."
            frequency="as issued"
          />
          <DataSource
            name="Maharashtra Water Resources Department, Pravah daily dam bulletin"
            url="https://mwrdpravah.in/damsafety/control/main"
            description="The state's all-Maharashtra bulletin, every morning. The cards read Totladoh and Kamthi Khairy (Navegaon Khairi) inside the bulletin's Nagpur district block, by whole name, as live storage against designed live capacity. The bulletin's same-date-last-year column extends the history backwards, and the department keeps dated Marathi copies from the end of February 2024."
            frequency="daily"
          />
          <DataSource
            name="Central Water Commission, weekly Reservoir Storage Bulletin"
            url="https://cwc.gov.in/reservoirs-storage-bulletin"
            description="Totladoh's full reservoir level, 490.00 m, shown in feet in the water-sources list above."
            frequency="weekly"
          />
          <DataSource
            name="Central Water Commission, National Register of Large Dams (2019)"
            url="https://cwc.gov.in/sites/default/files/nrld06042019.pdf"
            description="Year of completion, storage, purpose and position of Totladoh (hydro-electric), Kamthikhairy (irrigation), Gorewada and Ambazari."
            frequency="periodic register"
          />

          <DataSourceGroupHeader title="Rainfall" />
          <DataSource
            name="IMD gridded rainfall (via imdlib)"
            url="https://imdlib.readthedocs.io/en/latest/"
            description="Grid cell 21.0 N, 79.0 E, 1970 to 2025, the cell nearest IMD's Nagpur observatory. Checked against the observatory's normal of 1,151.2 mm (1991-2020): the cell gives 1,148.8 mm over the same years."
            frequency="monthly archive"
          />
          <DataSource
            name="Open-Meteo archive"
            url="https://open-meteo.com/"
            description="Provisional daily rainfall at the same point for the months after IMD's last published month (CC BY 4.0), marked provisional and replaced when IMD catches up."
            frequency="daily"
          />
          <DataSource
            name="IMD Climatological Tables 1991-2020: Nagpur observatory"
            url="https://www.imdpune.gov.in/library/public/Climatological%20Tables%201991-2020.pdf"
            description="The observatory's normals and records: 1,151.2 mm a year, 347.7 mm of it in July; 315.0 mm on 12 June 1911 and 304.0 mm on 12 July 1994."
            frequency="per normal period"
          />
          <DataSource
            name="Maharain, Agriculture Department: circle-wise daily rainfall"
            url="https://maharain.maharashtra.gov.in/"
            description="Daily rainfall at the Nagpur City circle from 1997, and at Sitabardi and Pardi from 2013, with each month's normal: the rainfall behind each flood event on the flood page."
            frequency="daily"
          />

          <DataSourceGroupHeader title="Groundwater" />
          <DataSource
            name="IN-GRES groundwater assessment (Nagpur district, by taluka)"
            url="https://ingres.iith.ac.in/"
            description="The national Dynamic Ground Water Resource Assessment for the district's 14 talukas, six editions from 2019-2020 to 2025-2026, drawn on IN-GRES's own unit polygons. The district's 2024-2025 figures are checked against CGWB's printed national compilation."
            frequency="annual (state editions)"
          />
          <DataSource
            name="National Water Data Portal: groundwater level telemetry (Maharashtra)"
            url="https://nwdp.nwic.gov.in/"
            description="Six-hourly readings from 101 wells in the district, 91 run by the state's Groundwater Surveys and Development Agency and 10 by CGWB, shown as monthly means after quality checks. Wells are placed by their coordinates."
            frequency="6-hourly telemetry, refreshed by hand"
          />
          <DataSource
            name="CGWB National Compilation on Dynamic Ground Water Resources of India 2025"
            url="https://cgwb.gov.in/GWRA/GWRA_2025.pdf"
            description="The printed district figures (Nagpur 45.68%, Safe, 2024-2025) the IN-GRES build is checked against."
            frequency="per assessment"
          />

          <DataSourceGroupHeader title="Water bodies and restoration" />
          <DataSource
            name="MRSAC water bodies at 1:10,000 (2017-18)"
            url="https://gsc.mrsac.org.in/webadpgis1/rest/services/gatishakti/Water_Resources/MapServer/14"
            description="Every water body on the map, 1,767 in the frame around the city, with its type, from the Maharashtra Remote Sensing Applications Centre's PM Gati Shakti server. Its area field holds square kilometres and is converted. The service states no licence; it is cited as a state publication."
            frequency="one survey (2017-18)"
          />
          <DataSource
            name="OpenStreetMap"
            url="https://www.openstreetmap.org/copyright"
            description="Names for water bodies the survey leaves unnamed, joined where the two outlines overlap, and the locality names in the ward search (ODbL 1.0)."
            frequency="as edited"
          />
          <DataSource
            name="Court and tribunal orders on the city's lakes (Indian Kanoon)"
            url="https://indiankanoon.org/doc/85333771/"
            description="The Supreme Court's 2025 judgment on Futala, the Bombay High Court (Nagpur Bench) orders on Ambazari and the city's lakes, and the National Green Tribunal's orders: the court docket on the lake page, and dated status changes on the commitments page."
            frequency="per hearing"
          />
          <DataSource
            name="Government of Maharashtra resolutions (lakes, sewerage, the Nag project, the 2023 flood works)"
            url="https://gr.maharashtra.gov.in/1145/Government-Resolutions"
            description="Sanctions and releases behind the lake and commitments pages. Five did not open at the official address on 15 October 2026; their text was read from the orgpedia archive copy, linked beside the official address on each row."
            frequency="as issued"
          />
          <DataSource
            name="AMRUT 2.0 portal, Nagpur project list"
            url="https://amrut.mohua.gov.in/"
            description="Milestones for the AMRUT 2.0 water and lake projects. Where the portal and NMC's documents give different figures for the same work, both are shown."
            frequency="irregular"
          />
          <DataSource
            name="Imperial Gazetteer of India, vol. XVIII (1908), and the Maharashtra State Gazetteers, Nagpur (1966) and Bhandara (1979)"
            url="https://archive.org/details/imperialgazettee18greauoft"
            description="The history of the Bhonsle tanks, the 1873 waterworks, Gorewada and the Kanhan on the lake and origins pages. The 1908 volume is public domain, read through the Internet Archive."
            frequency="closed (1908, 1966, 1979)"
          />
          <DataSource
            name="FitzClarence, Journal of a Route Across India (1819)"
            url="https://archive.org/details/journalofrouteac00munsrich"
            description="The 1819 plan of the city and its tanks on the origins page. Public domain, read through the Internet Archive."
            frequency="closed (1819)"
          />

          <DataSourceGroupHeader title="Rivers and pollution" />
          <DataSource
            name="MPCB monthly readings on polluted river stretches (Kanhan, Kolar, Wainganga)"
            url="https://mpcb.gov.in/en/river-polluted-streches/water_quality_of_polluted_river_stretches"
            description="Monthly pH, dissolved oxygen, BOD and bacteria at five national-programme stations, January 2017 to December 2024, with dry and stagnant months as MPCB records them. For 2021 to 2024 they reproduce CPCB's yearly lowest and highest values."
            frequency="yearly files of monthly readings"
          />
          <DataSource
            name="NMC Environment Status Report 2023-24: river sampling and sewage plants"
            url={ESR_2023_24}
            description="23 sampling points on the Nag, the Pili and the Pora in the monsoon of 2023 (Tables 6.13 to 6.16, printed pp.161-166), and the 13 sewage treatment plants with their capacity and status (Table 6.3, p.137)."
            frequency="yearly"
          />
          <DataSource
            name="MPCB Water Quality Status reports"
            url="https://mpcb.gov.in/focus-area/reports-documents/water"
            description="The water quality index at the state's stations on the Nag and the Pili, 2022-23 and 2023-24."
            frequency="annual"
          />
          <DataSource
            name="CPCB National Water Quality Monitoring Programme: station list and yearly river tables"
            url="https://cpcb.gov.in/water-quality-data/"
            description="Station positions and the yearly lowest and highest values used to check MPCB's monthly figures. One station's position (Ambhora, 1910) is withheld because both official lists place it far from the village."
            frequency="annual"
          />
          <DataSource
            name="CPCB Polluted River Stretches (2018, 2022, 2025)"
            url="https://cpcb.gov.in/reports-3/"
            description="The priority class of the Kanhan, the Kolar and the Wainganga in each edition. CPCB's website policy requires its approval for any use beyond download and print, so the report is cited here, not copied."
            frequency="every 2 to 4 years"
          />

          <DataSourceGroupHeader title="Flood and civic infrastructure" />
          <DataSource
            name="Water Resources Department, Flood Line Maps"
            url="https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps"
            description="The state's register of red and blue flood-line maps: 13 register entries for five rivers and a nalla around the city (the Nag, the Pora, the Kanhan, the Kolar, the Vena and the Bagdor nalla), including four for the Nag (3.55 km at Pardi, Punapur and Bharatwada) and one for the Pora. The register also lists Nagpur-district entries for the Wainganga, the Jam and the Nand, not listed here. Scanned maps, linked rather than drawn."
            frequency="as sheets are added"
          />
          <DataSource
            name="Nagpur District Disaster Management Plan 2024"
            url="https://nagpur.gov.in/disaster-management/"
            description="Rainfall at each city circle on 23 September 2023, the rescue count and a flood history from 1991, in Marathi, read on the page images."
            frequency="yearly"
          />
          <DataSource
            name="NMC City Disaster Management Plan 2025-26"
            url="https://nmcnagpur.gov.in/assets/300/2025/07/mediafiles/Apatti_Vyavsthapan_2025-26.pdf"
            description="66 places at risk in heavy rain and, fire station by fire station, 77 places where water collects and 59 basements, named without coordinates; and the control-room numbers on My Ward. In Marathi."
            frequency="yearly"
          />
          <DataSource
            name="Bombay High Court (Nagpur Bench), PIL 56/2023, order of 11 July 2024"
            url="https://indiankanoon.org/doc/62849948/"
            description="The Collector's affidavit on the four deaths of 23 September 2023, and the Water Works Department's 2020 record of the Ambazari spillway and the road bridge below it."
            frequency="per hearing"
          />
          <DataSource
            name="City Development Plan for Nagpur 2041 (March 2015)"
            url="https://www.metrorailnagpur.com/assets/Final-CDP-Nagpur-Mar-15-of-NMC-D52xs05u.pdf"
            description="About 917 km of storm drains, as surveyed in 2008, covering about 40% of the city's area: the only figure for the drain network we have found."
            frequency="one-time (2015)"
          />
          <DataSource
            name="FABDEM terrain (University of Bristol / Fathom)"
            url="https://www.fathom.global/product/fabdem/"
            description="Seven height bands across the city, from 265 m to over 345 m, in the water-bodies map legend (CC BY-NC-SA 4.0)."
            frequency="static"
          />

          <DataSourceGroupHeader title="Wards and boundaries" />
          <DataSource
            name="NMC GIS: city outline and zones"
            url="https://geocivicnmcgis.nmcptax.com/server/rest/services/NMC/NMCAdminBoundaries/MapServer"
            description="NMC's own outline of the city and its ten zones. A ward is shown with a zone only where one zone holds at least 90% of it (20 of the 38 wards); the others cross zone lines and show none. A searched place shows the zone at its own point."
            frequency="as edited"
          />
          <DataSource
            name="MRSAC ward map (PM Gati Shakti)"
            url="https://gsc.mrsac.org.in/webadpgis1/rest/services/gatishakti/Gatishakti_DMA/MapServer/2"
            description="The outlines of the 38 wards from MRSAC's map, whose population figures follow the August 2025 draft; the edges between wards 6 and 7, 7 and 9, 8 and 19, and 23 and 26 may differ from the final notification."
            frequency="per delimitation"
          />
          <DataSource
            name="Final ward notification, Nagpur Municipal Corporation (4 October 2025)"
            url="https://mahasecelec.in/Forms/Admin/DownloadGazetteMC.aspx"
            description="The 38 wards, their councillors and the population printed for each ward (English schedule, pp.35-68), with the State Election Commission's approval."
            frequency="per delimitation"
          />
          <DataSource
            name="MRSAC drainage lines"
            url="https://gsc.mrsac.org.in/webadpgis1/rest/services/gatishakti/Water_Resources/MapServer/12"
            description="The six rivers on the maps: the Nag, the Pili, the Pora, the Kanhan, the Kolar and the Wainganga."
            frequency="as published"
          />
        </>
      );
    case "river-status-consequence":
      return (
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          For {cityName}, the readings behind the badges are MPCB&apos;s monthly figures for
          the Kanhan, the Kolar and the Wainganga, and NMC&apos;s 2023 sampling for the Nag,
          the Pili and the Pora, not CPCB&apos;s annual reports. The three city rivers have no
          CPCB readings: MPCB lists five national-programme stations on the Nag and the Pili
          (codes 5979 to 5983), but CPCB&apos;s river tables up to 2024 carry none of them, and
          neither list has a station on the Pora. Their badges come from NMC&apos;s points, where dissolved oxygen fell below 1 mg/L on all three. The
          Kanhan, the Kolar and the Wainganga are Priority IV in CPCB&apos;s 2025 list, but
          their badges follow MPCB&apos;s latest readings.
        </p>
      );
    case "river-status-footnote":
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
          Status thresholds follow CPCB&apos;s published Designated Best-Use criteria; the
          readings are MPCB&apos;s monthly figures and NMC&apos;s 2023 sampling, as above.
        </p>
      );
    case "intelligence":
      // Replaces the frame's default, which describes a days-of-water briefing
      // that Nagpur does not have.
      return (
        <p className="text-slate-600 dark:text-slate-400">
          {cityName}&apos;s pages show the published figures directly, each with its
          source and date; there is no automated written summary for the city.
        </p>
      );
    case "limitations":
      return (
        <SubSection title={t("about.limitations")}>
          <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
            <li>
              Only the storage in the two Pench dams is read every day. Everything else comes
              from documents published once a year or less, so a figure on these pages can be
              more than a year old; each one carries its date.
            </li>
            <li>
              The state&apos;s dam bulletin is published every morning but can be late or
              skipped, for example on holidays.
            </li>
            <li>
              The groundwater assessment describes whole talukas, with the city as one unit; it
              does not measure individual wards or streets. The well readings are monthly means
              of six-hourly telemetry after quality checks.
            </li>
            <li>
              Inside the city the river readings are one sampling round by NMC in the 2023
              monsoon, with no BOD column; below the city, MPCB&apos;s monthly readings run to
              December 2024. Neither is a live reading.
            </li>
            <li>
              Rainfall after December 2025 is provisional: reanalysis estimates (Open-Meteo) for
              one grid point, replaced when IMD publishes its gridded figures.
            </li>
            <li>The flood page is a record of past events, not a forecast and not a hazard map.</li>
          </ul>
        </SubSection>
      );
    case "data-quality-2":
      return (
        <SubSection title={`Where ${cityName}'s figures need care`}>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <li>
              Eight documents were read from copies or scans: the 2017-18 draft
              Environment Status Report (a copy hosted outside NMC&apos;s website), five
              Government Resolutions (the orgpedia archive copy), NMC&apos;s 2026-27 budget
              and the regulator&apos;s 2018 order (scans, read on their page images).
              Each row that rests on one says so.
            </li>
            <li>
              Reservoir percentages are of designed live storage, the state bulletin&apos;s
              basis, and describe the whole dam, not the city&apos;s share.
            </li>
            <li>
              The 2025-2026 groundwater figure for Nagpur (Urban) enters 206 ha of the unit
              as canal command area (16,081 ha the year before), so its stage is in effect
              that of the non-command part alone; its category, Safe in all three editions,
              is the steadier comparison.
            </li>
            <li>
              Four ward edges (between wards 6 and 7, 7 and 9, 8 and 19, and 23 and 26) may
              follow an earlier line than the final one.
            </li>
            <li>
              The water-body survey and the ward populations are dated: the survey is of
              2017-18, and the ward notification does not name its census year.
            </li>
          </ul>
        </SubSection>
      );
    default:
      return <>{fallback}</>;
  }
}
