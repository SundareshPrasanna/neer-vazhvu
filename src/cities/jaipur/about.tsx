"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource, DataSourceGroupHeader } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { JaipurPageDescriptions } from "./about-pages";

/** Jaipur's About-page content: the slots of the shared About frame that are
 *  specific to Jaipur. A slot not listed renders the frame's default.
 *
 *  data-sources-1 replaces the frame's default source index outright, so each
 *  source Jaipur uses is listed once, in the city's own groups. URLs and
 *  licence wording follow scripts/source-registry/jaipur.json and the shared
 *  ids its artifacts cite (cpcb-nwmp-annual, cpcb-prs-report, osm-overpass,
 *  mohua-amrut-status, mojs-water-bodies-census-2023, open-meteo-archive);
 *  every figure is one a shipped artifact or registry note carries. Other
 *  cities are never named: the surface sweep reads them as leaks. */

const ATTRIBUTED = "Government of Rajasthan publication, cited with attribution.";
const REPRODUCE =
  "The site's copyright policy allows reproduction free of charge with the source prominently acknowledged.";
const GOI = "Government of India publication, cited with attribution.";
const CPCB =
  "CPCB's website policy requires its approval for any use beyond download and print, so its reports are cited here, not copied.";

export default function JaipurAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return <JaipurPageDescriptions cityId={config.cityId} cityName={cityName} />;
    case "data-sources-1":
      return (
        <>
          <DataSourceGroupHeader title="Supply and reservoirs" />
          <DataSource
            name="PHED Rajasthan Annual Progress Reports 2024-25 and 2025-26, and the Jaipur zone supply schedule"
            url="https://phedwater.rajasthan.gov.in/"
            description={`The Public Health Engineering Department's own account of the city's supply: 766.73 MLD on 31 December 2025, 590 from Bisalpur and 176 from 3,633 tube wells (2025-26, printed p.85), the year before (2024-25, p.84), connections, the summer tankers (Appendix 7, pp.41-42) and the round-the-clock trial areas; and, per project, sanction, spend, percent done and target date, the basis of most of the commitments page. The zone schedule (status 15 April 2024) gives the hours of supply. Printed in Hindi in an old typeface, so figures are read from the page images. ${REPRODUCE}`}
            frequency="yearly (January)"
          />
          <DataSource
            name="Rajasthan Water Resources Department: dam storage report and rainfall bulletins"
            url="https://water.rajasthan.gov.in/wr/#/"
            description="The 'Water Storage Data' report for all 693 of the state's dams: designed level and capacity, that morning's level and gross storage, its percentage of designed capacity, and last year's storage. Behind the dashboard's Bisalpur and Ramgarh cards, the storage history and the lake-restoration storage figures. Each report is a PDF, read row by row, and a row is kept only if its printed percentage checks out. Storage reports run from May 2025, and the monsoon rainfall bulletins carry the same table back to 16 June 2023. The department publishes no live storage and states no reuse licence; its terms say the content should not be taken as a statement of law. Cited with attribution."
            frequency="daily mid-June to mid-October; 1st and 16th otherwise, often late"
          />
          <DataSource
            name="Central Water Commission weekly reservoir storage bulletin (Bisalpur history only)"
            url="https://cwc.gov.in/reservoirs-storage-bulletin"
            description="Bisalpur's weekly live storage, used only for the history before the state's daily record begins. CWC counts live storage against 1.076 billion cubic metres, a different base from the state's gross storage, so its rows keep their volume and leave the percentage blank. The listing stops at the bulletin of 8 May 2025. CWC asks for permission before reproduction; cited, not republished."
            frequency="weekly (listing ends May 2025)"
          />
          <DataSource
            name="CWC National Register of Large Dams, 2019"
            url="https://cwc.gov.in/sites/default/files/nrld-2019.pdf"
            description="The design record of the dams behind the city: Bisalpur (completed 1999) and its position, Ramgarh (1901, 75 million cubic metres, a reservoir area of 1,035 hectares), Kanota on the Dhund (2001), and Kukas, whose two capacities in the register disagree and are not published. Read for the dashboard's source positions, the rivers page and the lake-restoration cards. Cited, not republished."
            frequency="closed (2019 edition)"
          />
          <DataSource
            name="JICA ex-post evaluation of the Bisalpur-Jaipur Water Supply Project (2016), with ADB's validation report (2013)"
            url="https://www2.jica.go.jp/en/evaluation/pdf/2015_ID-P157_4_f.pdf"
            description="The distance from Bisalpur to the city (about 120 km), the city's dependence on groundwater before and after the transfer (97% at appraisal in 2003, 18.8% in 2015), and the last published loss figure, 37% in 2015, which the evaluation itself calls likely unreliable. Read for the dashboard, the facts page and the origins page. Public project documents, cited with attribution."
            frequency="closed (2016)"
          />
          <DataSource
            name="Water Resources Department, Rajasthan: revised environmental and social assessment for the Dam Rehabilitation and Improvement Project 2 (February 2020)"
            url="https://documents1.worldbank.org/curated/en/432001582439812232/pdf/Revised-Environmental-and-Social-Impact-Assessment-Dam-Rehabilitation-and-Improvement-Project-2-P170873.pdf"
            description="Its description of Bisalpur (p.7): 11.1 TMC a year for Jaipur and the villages on its pipeline, 5.1 TMC for Ajmer and about 8 TMC for irrigation. A description, not an allocation order, and shown as such. Published by the World Bank; cited with attribution."
            frequency="closed (February 2020)"
          />

          <DataSourceGroupHeader title="Budgets, programmes and courts" />
          <DataSource
            name="Rajasthan budget speeches, 2023-24 to 2026-27 (Finance Department)"
            url="https://finance.rajasthan.gov.in/"
            description={`The State's announcements on the commitments page, each with its paragraph and page: Stage II Phase II of the Bisalpur-Jaipur project (Rs 1,986.68 crore, 2025-26), the Brahmani-Bisalpur link (an estimated Rs 6,100 crore, 2025-26), the 2026-27 drainage works and the Dravyavati items, with the reply-to-debate announcement lists. ${REPRODUCE}`}
            frequency="yearly (February)"
          />
          <DataSource
            name="MoHUA AMRUT 2.0 progress report (Ministry of Housing and Urban Affairs)"
            url="https://amrut.mohua.gov.in/"
            description={`Four Jaipur projects on the commitments page: the walled city's sewer rebuild, the former Heritage area's water distribution, and the former Greater area's water supply and sewers. The report still names the two former corporations, and the rows keep those names. ${GOI}`}
            frequency="weekly; re-checked monthly"
          />
          <DataSource
            name="National Water Development Agency note on the Modified Parbati-Kalisindh-Chambal-ERCP link (Ram Jal Setu)"
            url="https://nwda.gov.in/"
            description={`The memorandum of 5 December 2024, and about 1,744 million cubic metres of drinking water for 21 districts, 'Jaipur Urban' and 'Jaipur Rural' among them. Jaipur's own share is not stated anywhere found. ${GOI}`}
            frequency="irregular"
          />
          <DataSource
            name="Jaipur Development Authority: Dravyavati River Project"
            url="https://jda.rajasthan.gov.in/"
            description={`JDA's 2017 environmental report (the river's course, its 47.50 km corridor and its hundred-year flood aim) and its April 2018 project sheet (a target of 15 August 2018, five sewage plants of 170 MLD). Read for the rivers, flood-risk and commitments pages. ${ATTRIBUTED}`}
            frequency="irregular"
          />
          <DataSource
            name="Rajasthan High Court, Supreme Court of India and National Green Tribunal orders"
            url="https://hcraj.nic.in/"
            description="The legal record behind the lake-restoration, commitments and rivers pages: the High Court's suo motu case on Ramgarh's catchment (D.B. Civil Writ Petition 11153/2011, orders of 30 July and 13 August 2026); the Supreme Court's judgment of 9 November 2017 on the same catchment; the Mansagar lease (Supreme Court, 25 April 2014) and the Court's order of 28 February 2025; the Tribunal's Central Zone order of 3 November 2023 on the night market beside Jal Mahal; and the Dravyavati orders of 19 December 2024 and 23 July 2026. Court-signed copies are read where LiveLaw and Verdictum publish them, because the courts' case search sits behind a search form; each is cited by court, case number and date. Judicial record, cited with attribution."
            frequency="per order"
          />

          <DataSourceGroupHeader title="Weather and rainfall" />
          <DataSource
            name="IMD 0.25-degree gridded rainfall (India Meteorological Department, via imdlib)"
            url="https://imdlib.readthedocs.io/en/latest/"
            description="Grid cell 26.75 N, 75.75 E, 1970 to 2025. The cell contains IMD's Jaipur (Sanganer) observatory, station 42348: it gives 591.9 mm over 1991-2020 against the observatory's normal of 600.3 mm (1.4% lower), and the cell to the north 612.7 mm (2.1% higher). IMD data policy; cited with attribution."
            frequency="monthly archive; refreshed quarterly"
          />
          <DataSource
            name="Open-Meteo archive API (provisional rainfall)"
            url="https://open-meteo.com/"
            description="Reanalysis daily rainfall at the same cell, filling the months after IMD's last published month and marked provisional until IMD's own figures replace it. From 1 June to 8 October 2026 it read about 27% below IMD's airport gauge (383.4 mm against 527.9 mm). CC BY 4.0."
            frequency="daily"
          />
          <DataSource
            name="IMD Climatological Tables 1991-2020: Jaipur, station 42348"
            url="https://www.imdpune.gov.in/library/public/Climatological%20Tables%201991-2020.pdf"
            description={`The observatory's normal (600.3 mm a year on 34.3 rainy days, printed p.166), its monthly normals, and the heaviest day on record, 326.0 mm on 19 July 1981. Used for the check on the grid cell and on the facts and flood-risk pages. ${GOI}`}
            frequency="closed (1991-2020 normals)"
          />
          <DataSource
            name="IMD Meteorological Centre Jaipur: Rajasthan monsoon reports and the Jaipur record pages"
            url="https://mausam.imd.gov.in/jaipur/"
            description={`Each monsoon's rain by district against its normal (Jaipur district 986.6 mm in 2024 and 918.5 mm in 2025, against 524.3 mm), the month-by-month record days behind the 1981, 2012 and 2020 entries on the flood-risk page, and the 'Climate of Jaipur' booklet. ${GOI}`}
            frequency="yearly, after the monsoon"
          />

          <DataSourceGroupHeader title="Groundwater" />
          <DataSource
            name="IN-GRES groundwater assessment, Jaipur district (Central Ground Water Board and the state groundwater department)"
            url="https://ingres.iith.ac.in/"
            description="The national Dynamic Ground Water Resource Assessment for the district's 16 units, five editions from 2021-2022 to 2025-2026, drawn on IN-GRES's own 2021 unit boundaries: Jaipur Urban at 349.88% in 2025-2026, every unit over-exploited. The 2024-2025 district figures equal Rajasthan's printed 2025 report (p.168). IN-GRES states no terms of use or licence; cited with attribution."
            frequency="yearly (new edition)"
          />
          <DataSource
            name="National Water Data Portal: groundwater-level telemetry, Rajasthan (National Water Informatics Centre)"
            url="https://nwdp.nwic.gov.in/"
            description="Six-hourly readings from 148 piezometers in the district, 108 run by the Rajasthan Ground Water Department and 40 by the Central Ground Water Board, shown as monthly means from January 2021. Wells are placed by their coordinates, because the portal's district tag follows the lines before 2023, and placeholders (999.0), zeros and sign flips are screened out. The portal allows reproduction free of charge with the source acknowledged."
            frequency="6-hourly telemetry"
          />
          <DataSource
            name="Central Ground Water Board reports on Jaipur district (2013 and 2023)"
            url="https://cgwb.gov.in/cgwbpnm/public/uploads/documents/16856874981667278916file.pdf"
            description={`The Board's 2023 aquifer-mapping inception report, which says the city's earlier surface source, Ramgarh lake, 'has been dried up' and that water now comes by pipeline from Bisalpur, about 120 km away; and its 2013 district brochure, for the Banganga's course. Read for the rivers and origins pages. ${GOI}`}
            frequency="irregular"
          />

          <DataSourceGroupHeader title="Water bodies and restoration" />
          <DataSource
            name="OpenStreetMap water bodies and rivers (OpenStreetMap contributors, via the Overpass API)"
            url="https://www.openstreetmap.org/copyright"
            description="The 36 lake, pond and reservoir shapes on the water-bodies map and the four rivers on the rivers page, because no city lake register or lake layer is published. Three of the 36 are not lakes (the Amanishah Nala polygon, a building-material pit and a fountain), and the Dravyavati is mapped as its channel's outline. ODbL 1.0."
            frequency="as edited (ODbL)"
          />
          <DataSource
            name="Ministry of Jal Shakti, Census of Water Bodies (first census, Rajasthan tables; second census, state volume)"
            url="https://mowr.nic.in/irrigationcensus/Reports/6MIC/WBS/"
            description={`The first census (reference year 2017-18) counts 82 water bodies in Jaipur district, all rural, none recorded as encroached; its unit rows on the Open Government Data Platform describe Maota and Kukas. The second (2023-24) counts 14,400 in Rajasthan, 1,081 of them urban, with no district tables yet. ${GOI}`}
            frequency="closed (second census pending)"
          />
          <DataSource
            name="Rajya Sabha answer on the renovation of traditional water bodies, Rajasthan (via the Open Government Data Platform)"
            url="https://api.data.gov.in/resource/8b61906b-c0e9-45ef-9377-3a0ce9c68e80"
            description={`405 renovations in Jaipur district between 22 March 2025 and 12 March 2026. It names no scheme and lists no water bodies, and it counts works, not distinct lakes. ${GOI}`}
            frequency="one-time (March 2026)"
          />

          <DataSourceGroupHeader title="Rivers and pollution" />
          <DataSource
            name="CPCB National Water Quality Monitoring Programme, 2018-2024 tables (Central Pollution Control Board)"
            url="https://cpcb.gov.in/nwmp-data/"
            description={`Annual river tables: Bisalpur dam (2951) and the river near Newta dam (2952) for 2018-2024, and Kanota dam (4781) for 2021, each year's lowest and highest value as CPCB prints it, with page numbers; and CPCB's station list of October 2020, whose coordinate for 2952 sits at Kanota and is withheld. CPCB's 2025 river file covers the Yamuna only. ${CPCB}`}
            frequency="yearly"
          />
          <DataSource
            name="CPCB Polluted River Stretches (2018, November 2022 and 2025 editions)"
            url="https://cpcb.gov.in/polluted-river-stretches/"
            description={`The three classes given to the stretch at Newta dam, each under a different name: Priority III (2018), I (2022) and II (2025). The 2022 list is read from a Lok Sabha answer of 5 December 2024, and the 2025 report from a copy hosted by the Puducherry Pollution Control Committee. ${CPCB}`}
            frequency="every few years"
          />
          <DataSource
            name="RSPCB River Rejuvenation Committee action plan (December 2018)"
            url="https://environment.rajasthan.gov.in/content/dam/environment/RPCB/NGTORDERS/Final%20Report%20RRC673-2018.pdf"
            description={`The Rajasthan State Pollution Control Board's plan for the state's polluted stretches: Nevta dam 'is fed from Dravyavati River through a diversion channel' from Gular dam, and its map places the dam south-west of the city. Why the Newta readings are shown under the Dravyavati, and why their marker is withheld. ${ATTRIBUTED}`}
            frequency="closed (December 2018)"
          />
          <DataSource
            name="CPCB National Inventory of Sewage Treatment Plants (March 2021)"
            url="https://cpcb.nic.in/openpdffile.php?id=UmVwb3J0RmlsZXMvMTIyOF8xNjE1MTk2MzIyX21lZGlhcGhvdG85NTY0LnBkZg=="
            description={`Lists Jaipur's sewage plants one by one, several marked under construction or proposed, with a state figure but no city total, so the facts page's sewage card is a gap. ${CPCB}`}
            frequency="closed (data of June 2020)"
          />

          <DataSourceGroupHeader title="Flood and civic infrastructure" />
          <DataSource
            name="Disaster Management and Relief Department, Rajasthan: Jaipur District Disaster Management Plan 2025 and state plans"
            url="https://dmrelief.rajasthan.gov.in/content/dam/dmr/files/documents/ddmp2025/Jaipur.pdf"
            description={`The district plan's flood chapter (flooding 'of minor nature', waterlogging 'largely due to inadequate drainage', 1981 and 2012, pumps placed by the first week of June) and its control room; the State Disaster Management Plan of 2014 on the floods of 1981; the Flood Action Plan 2024; and the department's yearly reports, which give rain deaths for the state as a whole. ${ATTRIBUTED}`}
            frequency="yearly"
          />
          <DataSource
            name="Central Water Commission flood forecasting"
            url="https://ffs.india-water.gov.in/"
            description="Linked from the flood-risk page for context only: there is no station in Jaipur district. The nearest are the base station at Tonk (warning level 262.0 m, danger level 262.8 m) and an inflow forecast for Bisalpur, neither of which measures water in the city."
            frequency="hourly"
          />

          <DataSourceGroupHeader title="Wards and contacts" />
          <DataSource
            name="Local Self Government Department, Rajasthan: ward notification for Nagar Nigam Jaipur (16 September 2025)"
            url="https://lsg.rajasthan.gov.in/lsg/#/pages/sm/department-page/371474/2380"
            description={`The 150 wards and each ward's population (3,197,135 in all; the census basis is not stated), Rajasthan Gazette Extraordinary of 20 September 2025. Ward boundaries are described in words only, with no map file. ${ATTRIBUTED}`}
            frequency="per delimitation"
          />
          <DataSource
            name="Nagar Nigam Jaipur: list of wards, administrative directory and tender notices"
            url="https://jaipurmc.org/"
            description={`The zone and assembly seat of each ward (list of 6 October 2026), the zone office lines and emails (administrative directory, read from its page images), the Jaipur Samadhan portal and call centre, and the 2017 tender for Talkatora's desilting. Councillor names, parties and officers' mobile numbers are not used. ${REPRODUCE}`}
            frequency="irregular"
          />
          <DataSource
            name="Rajasthan Sampark and PHED's control-room list"
            url="https://sampark.rajasthan.gov.in/"
            description="The state's grievance portal and its 181 line, which PHED's own grievance link opens; and PHED's district control-room list (13 May 2026) and Contact Us page, for the Jaipur control room and the City Circle North and South offices. The 1077 flood line is the relief department's. Read for My Ward's helplines."
            frequency="irregular"
          />

          <DataSourceGroupHeader title="History" />
          <DataSource
            name="T. H. Hendley, A Medico-topographical Account of Jeypore (1895), and the Imperial Gazetteer of India (1908)"
            url="https://archive.org/details/b20407968"
            description="The walled city's 827 wells, the Amanishah dam of about 1840, the steam pumps of 1874 and the pipes of December 1875 (Hendley, pp.3-4), and the Gazetteer's account of the city, Tal Katora and Ramgarh. Read for the origins page. Public domain, through the Internet Archive; the origins page's photographs are from Wikimedia Commons, each with its licence."
            frequency="closed"
          />
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
