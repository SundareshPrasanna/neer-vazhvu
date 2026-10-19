"use client";

import { useLanguage } from "@/lib/i18n/context";
import { getPlaceConfig } from "@/lib/cities";
import { SubSection, DataSourceGroupHeader, DataSource, Gap } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { VisakhapatnamPageDescriptions } from "./about-pages";

/** Visakhapatnam's About-page content: the slots of the shared About frame
 *  that are specific to Visakhapatnam. A slot not listed renders the frame's
 *  default. Every source named here is registered in
 *  scripts/source-registry/visakhapatnam.json or platform.json, and its URL
 *  and cadence are the registry's. English only until the Telugu pass. */

const P = "text-sm text-slate-600 dark:text-slate-400";

// Licence postures, as the registry entries state them.
const APWRIMS_LICENCE =
  "We have not found a licence or terms of use on the portal, only a disclaimer and a footer reading 'All Rights Reserved', so it is carried as restricted and cited with attribution.";
const APPCB_LICENCE = "APPCB publication; its site footer reads 'All Rights Reserved'. Cited with attribution.";
const GOI = "Government of India publication, cited with attribution.";

export default function VisakhapatnamAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const { t } = useLanguage();
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "water-sources": {
      const fed = config.waterSources.filter((s) => s.hasPublicFeed !== false).length;
      return (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
            Reservoirs the city draws on: {fed} with a daily state reading, {config.waterSources.length - fed} without
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {config.waterSources.map((s) => (
              <div key={s.sourceCode} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                <div className="font-medium text-slate-900 dark:text-slate-100">{s.displayName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {s.type}
                  {s.fullCapacityMcft !== null && <> - {s.fullCapacityMcft.toLocaleString()} Mcft live capacity</>}
                  {s.fullTankLevelFt !== null && <> - FRL {s.fullTankLevelFt} ft</>}
                  {s.hasPublicFeed === false ? " - no daily reading" : " - daily on APWRIMS"}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            All six supply the city&apos;s drinking water. Five are shared with irrigation, industry or other
            users; only GVMC&apos;s own Mudasarlova serves the city alone. Capacities are live storage, the water
            above each dam&apos;s lowest outlet. Mudasarlova&apos;s is left blank because GVMC&apos;s own figures
            for it disagree (see Data quality).
          </p>
        </div>
      );
    }
    case "reading-days":
      return (
        <SubSection title="Why there is no days-of-water-left number">
          <p className={P}>
            The dashboard does not count down the days the stored water would last, and that is deliberate.
            Five of the six reservoirs behind the city are shared: Yeleru also feeds irrigation and the steel
            plant, Raiwada and Thatipudi are irrigation dams with a city share carved out of them, and
            Meghadrigedda and Gambheeram are dams the Water Resources Department operates and maintains, with
            other users beside the city. Only Mudasarlova serves the city alone, and it gives about 4.5 of
            some 380 MLD (CGWB 2025).
          </p>
          <p className={P}>
            Two lifts also top the system up from the Godavari: VIWSCO&apos;s Kateru pump house sends water
            through a 56 km pipeline into the Yeleru canal (since December 2004), and the Purushottapatnam lift
            pumps it through the Polavaram Left Main Canal into Yeleru reservoir (since July 2018). Storage
            divided by the city&apos;s demand would count water that belongs to farms and industry and leave out
            water that arrives by pump, so a runway worked out that way would overstate what is the city&apos;s
            to drink. We have also not found a measured figure for how much the city uses each day: the 490 MLD
            &lsquo;demand&rsquo; in CGWB&apos;s reports is a 2020 row carried forward unchanged.
          </p>
        </SubSection>
      );
    case "reading-1":
      return (
        <SubSection title="Reading the dashboard, card by card">
          <p className={P}>The dashboard follows the water from its sources to the tap.</p>
          <ul className={`list-disc list-inside space-y-2 ${P}`}>
            <li>
              <span className="font-semibold">The supply headline.</span>{" "}
              It leads with the distance: the Godavari and Yeleru system, the largest source, which CGWB lists at 190 km from the city. That is
              CGWB&apos;s distance to the source, not the length of the journey. The water comes by the Kateru
              pipeline and the Yeleru canal, which the draft Green City Action Plan puts at about 150 km
              (GVMC&apos;s 2021 supply sheet prints 156 km against Yeleru reservoir). The tiles beside it are
              GVMC&apos;s water treatment capacity (11 water treatment plants, 489 MLD, from the draft plan), that
              distance, and the people served: GVMC&apos;s own estimate of about 23 lakh in its NGT filings, as
              there has been no census since 2011.
            </li>
            <li>
              <span className="font-semibold">The supply overview.</span>{" "}
              The chain from the Godavari lifts to the tap, and supply by source: about 380 MLD available from nine sources, 182 MLD of it from the Godavari
              and Yeleru (CGWB gives 182 to 204; 182 is the figure that makes its 380 total add up). These are
              GVMC&apos;s figures; CGWB&apos;s tables carry the same quantities unchanged since its June 2022
              report, which said GVMC was able to draw 345.5 MLD of the 380. The newest present-supply figure we
              have found is 334.03 MLD, in the Chief Secretary&apos;s report to the NGT Principal Bench in OA
              606/2018 (10.07.2024, Annexure-VI, p33). None of these is a daily measurement.
            </li>
            <li>
              <span className="font-semibold">Reservoir cards and history.</span>{" "}
              Daily storage for Yeleru, Raiwada, Thatipudi and Meghadrigedda from APWRIMS, as live storage. Yeleru&apos;s figure includes the
              Godavari water the Purushottapatnam lift pumps into it; the Kateru water goes into the canal, not the
              reservoir, so no card holds it. Yeleru can read zero in dry spells, when its water is below the
              lowest outlet. Mudasarlova and Gambheeram are not in the feed and carry no reading. The history
              chart opens on three years; the archive runs from 2012 for Yeleru.
            </li>
            <li>
              <span className="font-semibold">Rainfall.</span>{" "}
              IMD&apos;s gridded record for the cell over the city, 1970 to 2025, with the months after IMD&apos;s last published month filled from Open-Meteo and
              marked provisional.
            </li>
          </ul>
        </SubSection>
      );
    case "pages-1":
      return <VisakhapatnamPageDescriptions cityId={config.cityId} cityName={cityName} />;
    case "intelligence":
      return (
        <>
          <p className="text-slate-600 dark:text-slate-400">
            {cityName} has no AI layer yet. Its pages carry no daily briefing, no AI-written narrative and no
            ward profiles. What you read on them is fixed text written against the cited documents, and numbers
            read from the data files listed under Data sources.
          </p>
          <ul className={`list-disc list-inside space-y-2 ${P}`}>
            <li>
              <span className="font-semibold">No daily briefing.</span>{" "}The briefing summarises current storage,
              its 7-day change and the days of water left, and {cityName} has no days-left figure.
            </li>
            <li>
              <span className="font-semibold">No AI narrative.</span>{" "}The longer weekly narrative is not switched
              on for {cityName}.
            </li>
            <li>
              <span className="font-semibold">No ward profiles.</span>{" "}
              There are no ward pages to attach them to; see &lsquo;What is not shown, and why&rsquo; above.
            </li>
          </ul>
        </>
      );
    case "data-sources-1":
      return (
        <div className="space-y-3">
          <DataSourceGroupHeader title="Reservoirs and supply" />
          <DataSource
            name="APWRIMS reservoir feed (Water Resources Department, Government of Andhra Pradesh)"
            url="https://apwrims.ap.gov.in/api/reservoir/timeseries"
            description={`Daily level, storage, inflow and outflow for Yeleru, Raiwada, Thatipudi and Meghadrigedda through a public interface with no login: the dashboard's reservoir cards and history, and the facts page's reservoir card. The archive runs from 2012 for Yeleru, from October 2014 for Thatipudi and Raiwada (which also has most of 2012) and from November 2015 for Meghadrigedda. Each dam's design values are checked against the portal's own attributes on every run. GVMC's Mudasarlova and the Water Resources Department's Gambhiramgedda reservoir are not in it. ${APWRIMS_LICENCE}`}
            frequency="daily"
          />
          <DataSource
            name="CGWB aquifer management plan for the Visakhapatnam and Anakapalli urban agglomerations (2025), with its 2022 and 2023 district reports"
            url="https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1750331736769645187file.pdf"
            description={`The dashboard's supply-by-source table, which CGWB gives 'as per the data provided by GVMC': about 380 MLD available from nine sources, 182 to 204 MLD of it from the Godavari and Yeleru, which it lists at 190 km from the city. The same nine quantities and the 380 total are in CGWB's June 2022 report (AAP 2020-21), which said GVMC was able to draw 345.5 MLD of the 380, and in its November 2023 report, so they are shown as GVMC's figures, not a current measurement. Also read for each source's year and distance and the groundwater share of supply. ${GOI}`}
            frequency="irregular"
          />
          <DataSource
            name="National Green Tribunal filings (GVMC, APPCB, CPCB and the Government of Andhra Pradesh)"
            url="https://www.greentribunal.gov.in/news-update"
            description="GVMC's daily supply sheet of 11 March 2021, annexed to its action-taken report in NGT OA 14/2021 (SZ), is the only source-by-source sheet from GVMC itself that we have found: each source's allocation, and the split of the Yeleru canal's water between the city, the steel plant, other industry and rural water supply. The Chief Secretary's report to the NGT Principal Bench in OA 606/2018 (10.07.2024, Annexure-VI, p33) gives GVMC's present supply as 334.03 MLD, and the state's affidavit in the same case (February 2026) gives the sewage and recycled-water figures. Also read: APPCB's reports in OA 14/2021 (SZ) and OA 141/2023 (SZ), GVMC's affidavit in OA 40/2024 (SZ), and the filings behind the commitments register, among them the state's monthly progress report for February 2024 in NGT Principal Bench OA 673/2018. The origins page also cites a joint committee's April 2021 report in NGT Principal Bench OA 175/2018 on the Purushottapatnam lift. Government of India tribunal record, cited with attribution."
            frequency="irregular (per filing)"
          />
          <DataSource
            name="GVMC publications (Greater Visakhapatnam Municipal Corporation, What's New listing)"
            url="https://www.gvmc.gov.in/wss/WhatsNewAll.htm"
            description="Carries the draft Visakhapatnam Green City Action Plan (prepared by IFC for GVMC, dated September 2024), which GVMC posted for public comment on 19 October 2024. Read for water treatment capacity (11 water treatment plants, 489 MLD), the 105 to 110 litres a person a day estimate, and the targets it proposes; those are proposals in a draft, not GVMC commitments, and some lines on its supply page do not agree with each other, so they are not repeated. Its 2026 notice of 120 wards is read for the ward gap. GVMC's documents for the Asian Development Bank, its disaster plan and its ward records are listed under their own groups below. GVMC publication, cited with attribution."
            frequency="irregular"
          />
          <DataSource
            name="Polavaram Project Authority (Ministry of Jal Shakti)"
            url="https://ppa.gov.in/WPSCore/Common/WebPages/Home/AboutProject.aspx"
            description={`The project page's 23.44 TMC a year for 'in and around Visakhapatnam city including Vizag Steel Plant and drinking water facilities', shown on the allocations page beside the two other official figures: 24 TMC, from a 2004 order cited in GVMC's 2019 assessment for the Asian Development Bank, which we have not found, and 12 TMC (CGWB 2025). ${GOI}`}
            frequency="irregular"
          />
          <DataSource
            name="SEIAA Andhra Pradesh environmental clearances (via PARIVESH, MoEFCC)"
            url="https://parivesh.nic.in/"
            description={`Each clearance states the project's water quantity and source. Read for two of the allocations page's claims still to come and the facts card on data centres: three data-centre campuses cleared in April and June 2026 (239, 207 and 246 kilolitres a day of fresh water, 0.69 MLD together) and APIIC's data-centre park at Madhurawada (December 2024). Only the project, date, quantity and source are used; the clearances also name the proponent's contact person, which is not. ${GOI}`}
            frequency="per clearance"
          />
          <DataSource
            name="VIWSCO project pages (Visakhapatnam Industrial Water Supply Company, a GVMC and APIIC company)"
            url="https://viwsco.in/about/"
            description="The company's About and Project Infrastructure pages: the 56 km pipeline from the Kateru pump house to the Yeleru canal, completed in December 2004, an allocated share of 7 TMC from Yeleru, and the GVMC and APIIC shareholding. Read for the supply chain on the dashboard, the allocations page and the rivers page, as the company's own description. We have not found a licence or terms of use on the site, which reads 'Copyright © 2026 VIWSCO'; cited with attribution."
            frequency="irregular"
          />
          <DataSource
            name="APIIC project note on VIWSCO (Andhra Pradesh Industrial Infrastructure Corporation, 2009)"
            url="https://apiic.in/wp-content/themes/custom-theme/assets/uploads/ppp/VIWSCO.pdf"
            description="A one-page note of August 2009: VIWSCO's drawals of 5 TMC from the Godavari and 5 TMC from Yeleru, its commissioning in December 2004, and its restructuring with GVMC and APIIC as promoters. Read for VIWSCO on the allocations page. APIIC publication, cited with attribution."
            frequency="closed (2009 project note)"
          />
          <DataSource
            name="CWC National Register of Large Dams, 2019 (Central Water Commission)"
            url="https://cwc.gov.in/sites/default/files/nrld-2019.pdf"
            description="The register's Andhra Pradesh rows for the dams behind the city: Meghadrigedda (as 'Mehadrigedda', completed 1977, operated and maintained by the Water Resources Department), Gambhiramgedda (completed 1957, and the point used for its card), and Yeleru, Raiwada and Thatipudi, whose capacities agree with APWRIMS. Read for dam years and operators on the allocations page, the supply overview and the water-body cards, and on the origins page. Government of India publication, cited with attribution."
            frequency="closed (2019 edition)"
          />
          <DataSource
            name="AP Water Resources Department project pages for Yeleru, Raiwada and Thatipudi (archived copies on the Internet Archive)"
            url="https://web.archive.org/web/20230930055240/https://irrigationap.cgg.gov.in/wrd/static/approjects/yeleru.html"
            description="The department's old project pages, read from archived copies because the live site no longer resolves. The Yeleru page lists 5.00 TMC for industry 'for G.V.M.C or VIWSCo', the figure on GVMC's 2021 sheet, for the allocations page; the three pages give the dam years and the city's shares for the origins page. Andhra Pradesh government publication, cited with attribution."
            frequency="closed (archived pages, c. 2015-16)"
          />
          <DataSource
            name="CAG Report No. 4 of 2025, Polavaram Irrigation Project (Comptroller and Auditor General of India)"
            url="https://cag.gov.in/ag/andhra-pradesh/en/audit-report"
            description="The audit of the Polavaram project: the Purushottapatnam lift, which sends Godavari water into Yeleru reservoir and was completed by July 2018, and the Left Main Canal works' physical progress of 76.05 per cent in March 2023, the latest official figure we have found. It is also one of three documents giving 23.44 TMC for the city. Read for the dashboard's supply chain, the allocations page and the facts card on the Polavaram share. Government of India publication, cited with attribution."
            frequency="closed (Report No. 4 of 2025)"
          />
          <DataSource
            name="Ministry of Jal Shakti note on the Polavaram Irrigation Project (Department of Water Resources, May 2024)"
            url="https://jalshakti-dowr.gov.in/static/uploads/2024/05/POLAVARAM-IRRIGATION-PROJECT-ANDHRA-PRADESH.pdf"
            description="The ministry's project note, which gives 23.44 TMC of drinking water supply 'to a population of 28.50 lakh in enroute 611 villages'. One of the three documents behind the 23.44 TMC on the allocations page and the facts card; it describes who the water serves differently from the Polavaram Project Authority and CAG, and both readings are shown. Government of India publication, cited with attribution."
            frequency="closed (May 2024 note)"
          />

          <DataSourceGroupHeader title="Orders, clearances and courts" />
          <DataSource
            name="Environmental clearance for the AM/NS India steel plant at Anakapalli (MoEFCC, via PARIVESH)"
            url="https://parivesh.nic.in/"
            description="The central clearance of 20 March 2026: of the plant's water need, 1,03,968 cubic metres a day of fresh water (about 104 MLD) 'will be obtained from the Polavaram Left Main Canal', and the company 'shall obtain necessary permission from the Competent Authority'. Read for a claim still to come on the allocations page; we have not found a Water Resources Department allocation for it. Only the project, date, quantity and source are used. Government of India publication, cited with attribution."
            frequency="closed (clearance of 20 Mar 2026)"
          />
          <DataSource
            name="G.O.Ms.No.76 of 26 November 2024 (Industries and Commerce Department, Government of Andhra Pradesh)"
            url="https://goir.ap.gov.in/dgo.ashx?gid=502354&fileType=E"
            description="The state's order on the AM/NS plant: industrial water at Rs 50 a kilolitre for 10 years, against the company's request for 6,600 cubic metres an hour from Polavaram. It sets a price, not a quantity, and the allocations page shows it that way. The state's government orders register allows reproduction free of charge, with the source acknowledged."
            frequency="closed (order of 26 Nov 2024)"
          />
          <DataSource
            name="G.O.Ms.No.100 of 14 October 2016 (Water Resources Department, Government of Andhra Pradesh)"
            url="https://goir.ap.gov.in/dgo.ashx?gid=375571&fileType=E"
            description="The Rs 1,638 crore sanction for the Purushottapatnam lift, which lifts 3,500 cusecs from the Godavari into the Polavaram Left Main Canal and names 23.44 TMC for Visakhapatnam city. Read with CAG's report for the lift on the allocations page. The state's government orders register allows reproduction free of charge, with the source acknowledged."
            frequency="closed (order of 14 Oct 2016)"
          />
          <DataSource
            name="G.O.Ms.No.202 of 6 December 2014, Industrial Water Allotment Policy (Industries and Commerce Department, Government of Andhra Pradesh)"
            url="https://goir.ap.gov.in/dgo.ashx?gid=330362&fileType=E"
            description="In a drought, water released to industry from a reservoir is cut pro rata to what the reservoir holds. The policy does not set priority between the city and industry on the Yeleru canal, and the allocations page lists that order among those we have not found. The state's government orders register allows reproduction free of charge, with the source acknowledged."
            frequency="closed (order of 6 Dec 2014)"
          />
          <DataSource
            name="G.O.Ms.No.24 of 25 February 2015 (Irrigation and CAD Department, Government of Andhra Pradesh)"
            url="https://goir.ap.gov.in/dgo.ashx?gid=335816&fileType=E"
            description="A special water rate of Rs 11.80 a kilolitre for 2012-13, rising 5% a year, for RINL, NTPC and GVMC under VIWSCO's concession agreement, which we have not found. On the allocations page's timeline. The state's government orders register allows reproduction free of charge, with the source acknowledged."
            frequency="closed (order of 25 Feb 2015)"
          />
          <DataSource
            name="G.O.Rt.No.203 of 17 April 2026 (Water Resources Department, Government of Andhra Pradesh)"
            url="https://goir.ap.gov.in/dgo.ashx?gid=573535&fileType=E"
            description="0.518 TMC from Yeleru reservoir to the Pampa reservoir project between 16 January and 15 May 2026, for a rabi crop. On the allocations page's timeline, as a draw on Yeleru beside the city's. The state's government orders register allows reproduction free of charge, with the source acknowledged."
            frequency="closed (order of 17 Apr 2026)"
          />
          <DataSource
            name="High Court of Andhra Pradesh, WP(PIL) 248/2020"
            url="https://aphc.gov.in/"
            description="Two orders in the commitments register, each read from a filing to the National Green Tribunal in OA 240/2025 (SZ): 12 November 2025, recording the Advocate General's timeline for a second sewage treatment plant at Appughar, and 11 March 2026, recording a Rs 272 crore contract and a last date fixed for March 2027. The court's joint committee's 2023 list of discharges into the Meghadrigedda surplus course is among the rivers page's events. Andhra Pradesh High Court judicial record, cited with attribution."
            frequency="per hearing"
          />

          <DataSourceGroupHeader title="Weather and rainfall" />
          <DataSource
            name="IMD 0.25-degree gridded rainfall (India Meteorological Department, via imdlib)"
            url="https://imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html"
            description="Monthly rainfall at the grid cell 17.75 N, 83.25 E, inside GVMC on the Gopalapatnam and Simhachalam side, 1970 to 2025: the dashboard's rainfall chart and the facts page's normal, about 1,043 mm a year over 1970-2020. It is the grid point nearest the city centre, about 8 km away, and a land cell with a value in every year. The coastal cells 17.5 N 83.0 E, 17.5 N 83.25 E and 17.75 N 83.5 E are sea, with no value in any IMD year from 1991 to 2025, so a seaward pick would write zeros. Checked against IMD's observatories: over 1991-2020 this cell gives 1,053.4 mm, against a normal of 1,054.5 mm at Visakhapatnam airport (station 43149) and 1,113.1 mm at the Visakhapatnam observatory (station 43150); the AP planning department's district normal is 1,117.7 mm. IMD's months also take over from the provisional fill below as they are published. IMD data policy; cited with attribution."
            frequency="yearly"
          />
          <DataSource
            name="IMD Climatological Tables 1991-2020, stations 43149 and 43150 (India Meteorological Department)"
            url="https://city.imd.gov.in/citywx/extreme/climate.php?id=43149"
            description="The 1991-2020 normal rainfall at IMD's two Visakhapatnam observatories: 1,054.5 mm a year at the airport (station 43149) and 1,113.1 mm at the other (station 43150). The grid cell above is checked against them, and the facts page's rainfall card quotes both. We have not found a licence or terms of use on the table pages; Government of India publication, cited with attribution."
            frequency="closed (1991-2020 normals)"
          />
          <DataSource
            name="Open-Meteo archive API (provisional rainfall)"
            url="https://open-meteo.com/"
            description="Daily rainfall from Open-Meteo's ERA5-family reanalysis fills the months after IMD's last published month. Those months are marked provisional and replaced by IMD's values as its refresh catches up. For Visakhapatnam it is used for rainfall only, not for temperature or other weather. CC BY 4.0: weather data by Open-Meteo.com."
            frequency="continuous (daily fill)"
          />

          <DataSourceGroupHeader title="Groundwater" />
          <DataSource
            name="IN-GRES groundwater assessment, Andhra Pradesh (CGWB and the AP Ground Water and Water Audit Department, IIT Hyderabad)"
            url="https://ingres.iith.ac.in/"
            description="The national groundwater assessment by mandal, for the groundwater map and facts: three editions on today's eleven units, 2023-2024 to 2025-2026, drawn on IN-GRES's own unit outlines. The measure is the stage of extraction: how much of the groundwater that can be drawn each year is drawn. The 2024-2025 edition matches CGWB's Dynamic Ground Water Resources of Andhra Pradesh 2025 (December 2025) for these mandals; the map colours the 2025-2026 edition, newer than CGWB's December 2025 report. The district was split in April 2022 and the single GVMC unit was split into seven urban mandals in 2023-24, so no trend is drawn across either redraw. We have not found terms of use, a disclaimer or a licence statement on the portal; a Government of India assessment, cited with attribution."
            frequency="yearly"
          />
          <DataSource
            name="APWRIMS groundwater recorders (Water Resources Department, Government of Andhra Pradesh)"
            url="https://apwrims2.0.vassarlabs.com/iot/api/groundwater/lastknown/aggregated"
            description={`Automatic recorders read every day, shown on the groundwater map as monthly means of at least five good days: an older piezometer network, mostly from September 2022, and a network installed from December 2025 to January 2026. The archive carries some values forward and fills gaps with straight lines, and both are removed before averaging. Each well is named by the mandal its coordinates fall in on the portal's own mandal layer. ${APWRIMS_LICENCE}`}
            frequency="daily"
          />
          <DataSource
            name="National Water Data Portal (National Water Informatics Centre, Ministry of Jal Shakti)"
            url="https://nwdp.nwic.gov.in/"
            description="The AP Ground Water Department's hand-read monthly well record from May 2002, the long record behind the APWRIMS recorders; its telemetry is read only to check which recorder is which. Where a recorder and a hand-read well stand at the same site they are kept as separate series, not joined. District tags follow the pre-2022 lines, so wells are placed by their coordinates. Its copyright policy allows reproduction free of charge without specific permission, reproduced accurately and with the source acknowledged."
            frequency="continuous"
          />

          <DataSourceGroupHeader title="Water bodies and restoration" />
          <DataSource
            name="OpenStreetMap water bodies and channels (OpenStreetMap contributors, via the Overpass API)"
            url="https://overpass-api.de/api/interpreter"
            description="Every pond, tank, lake and reservoir polygon on the water-bodies map, in a box covering GVMC and about 5 km around it (1,088 polygons, 212 of them named, retrieved 14 October 2026), and the three channels on the rivers and flood pages: the Meghadri Gedda, the Gosthani and the Yeleru Left Main Canal. OpenStreetMap is a map, not a register; we have not found a gazetted lake register for the city, and small or seasonal tanks may be missing. Drains and wastewater polygons are left out. Open Database License (ODbL) 1.0."
            frequency="continuous"
          />
          <DataSource
            name="APWRIMS minor-irrigation tank layer (Water Resources Department, Government of Andhra Pradesh)"
            url="https://apwrims.ap.gov.in/geoserver-vassar/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=APWRIMS:apmitanks_withmapping_31021nos_11122023&resultType=hits"
            description={`The state's layer of 38,443 tank polygons, read only to confirm a water body's identity, name and location: Kondakarla Ava is tank MI012625, and the tank MI012862 near Gambheeram is a smaller tank 4 km east of the dam, not the reservoir. Its capacity field carries no unit and its fill field no date, so neither is used. ${APWRIMS_LICENCE}`}
            frequency="irregular"
          />
          <DataSource
            name="MoHUA AMRUT 2.0 project status, Andhra Pradesh (Ministry of Housing and Urban Affairs)"
            url="https://amrut.mohua.gov.in/assets/Status-of-Approved-Projects-under-AMRUT-2-in-Andhra-Pradesh-as-on-05-03-2026_.pdf"
            description={`The status list as on 5 March 2026: 44 GVMC rows worth Rs 825.55 crore, among them the 11 water-body projects on the lake-restoration page (Rs 23.31 crore, 10 completed) and the water and sewerage projects in the commitments register. MoHUA's live list, checked on 14 October 2026, has no Thungalam row and lists instead a Rs 1.27 crore 'Thimmaraju Tank' project, which appears to be the same project under a new name; MoHUA's live list has no project IDs and does not say so. A new edition is a new file name. ${GOI}`}
            frequency="irregular"
          />
          <DataSource
            name="GVMC's floating-solar environmental examination for Meghadrigedda (for the Asian Development Bank, October 2018)"
            url="https://www.gvmc.gov.in/wss/image_uploads/Developing%203MWp%20Solar%20Energy%20Park%20at%20Meghadrigedda%20(UCCRT04)%20-%20IEE%20-%20Oct%202018.pdf"
            description="The initial environmental examination for a 3 MWp floating solar plant on the reservoir: constructed 1977, commissioned 1979, and a reservoir surface it describes as owned by GVMC, set beside CWC's register, which lists the Water Resources Department as operator. Read for the Meghadrigedda card, the allocations page, the supply overview and the origins page. GVMC publication, cited with attribution."
            frequency="closed (October 2018)"
          />
          <DataSource
            name="GVMC's Mudasarlova environmental examination and resettlement due-diligence report (for the Asian Development Bank, 2018)"
            url="https://www.gvmc.gov.in/wss/image_uploads/Developing%20and%20Rejuvenation%20of%20Mudasarlova%20Catchment%20area%20(UCCRTF05)%20-%20IEE%20-%20Oct%202018.pdf"
            description="The two documents for the Mudasarlova lake development project, of September and October 2018. The examination gives 1.5 million cubic metres as the original capacity and 0.75 million at full tank level after siltation, with no survey or date behind either, so its capacity is left blank. Read for the Mudasarlova card. GVMC publication, cited with attribution."
            frequency="closed (September and October 2018)"
          />
          <DataSource
            name="GVMC's environmental examination for 24x7 water supply in the North-West sector (for the Asian Development Bank, January 2019)"
            url="https://www.gvmc.gov.in/wss/image_uploads/24x7%20Water%20Supply%20in%20North-West%20sector%20(GVMC02)%20-%20IEE%20-%20Jan%202019.pdf"
            description="Its Table 4 holds the reservoir drawal figures APPCB repeated to the NGT in 2021, which is why the rivers page does not date them to 2021, and it quotes a 2004 order for 24 TMC of Polavaram water, which we have not found. Read for the rivers page's events, the allocations page and the water-body cards; the origins page also cites its March 2016 draft. GVMC publication, cited with attribution."
            frequency="closed (January 2019; draft March 2016)"
          />
          <DataSource
            name="Wetlands of India portal (Ministry of Environment, Forest and Climate Change)"
            url="https://indianwetlands.in/wetlands-overview/indias-wetlands-of-international-importance/"
            description="The portal's lists of Ramsar sites and wetlands of international significance, checked on 14 October 2026 for the Kondakarla Ava card: the lake is on neither list. Its copyright policy allows reproduction free of charge, with the source acknowledged."
            frequency="irregular (new Ramsar designations)"
          />

          <DataSourceGroupHeader title="Rivers and pollution" />
          <DataSource
            name="CPCB National Water Quality Monitoring Programme, 2019-2024 tables (Central Pollution Control Board)"
            url="https://cpcb.gov.in/nwmp-data-2024/"
            description="The readings on the rivers page and the water-body cards. CPCB's 2019-2024 tables list no river-type station on any Visakhapatnam or Anakapalli river. On the city's three channels it samples the Meghadrigedda reservoir and a tidal creek by the Naval Dockyard (Meghadri Gedda), Thatipudi reservoir (Gosthani) and the Yeleru canal near Pharma City at Parawada; its other stations here are one lake (Kondakarla Ava), the sea and groundwater wells. CPCB's 'Gostani' stations and polluted stretch are in West Godavari district and are not used. Also read: CPCB's polluted river stretch lists of 2018, 2022 and 2025, none of whose Andhra Pradesh stretches is in Visakhapatnam. CPCB's website policy allows download and printing without prior permission and makes any other use subject to CPCB's approval."
            frequency="yearly"
          />
          <DataSource
            name="APPCB coastal and water-quality monitoring (Andhra Pradesh Pollution Control Board, COMAPS and NWMP tables)"
            url="https://pcb.ap.gov.in/PCBLive/PCB/QualityMonitoring"
            description={`Monthly samples where sewage channels and geddas meet the sea, with annual averages from 2010-11 to 2024-25, quoted in the rivers page's notes and on the facts page: for example 0.7 mg/L of dissolved oxygen on average in 2024-25 where the 'lavender canal' sewage meets the sea at the harbour. We have not found published coordinates for these stations, so they are quoted, never mapped. ${APPCB_LICENCE}`}
            frequency="monthly"
          />
          <DataSource
            name="APPCB consent orders, committee minutes and directions (Andhra Pradesh Pollution Control Board)"
            url="https://pcb.ap.gov.in/"
            description={`APPCB's own regulatory documents for the two common effluent treatment plants: the Visakha Pharmacity plant's consent order of 7 April 2025, Directions Order 692 of 14 December 2023 for the Atchutapuram plant, and committee minutes from 2025. Read for the pharma city plant's marker on the rivers page and the two plants' compliance record. ${APPCB_LICENCE}`}
            frequency="irregular"
          />
          <DataSource
            name="Operators' statutory environmental filings (RINL Visakhapatnam Steel Plant, HPCL Visakh Refinery, Visakhapatnam Port Authority, Visakha Pharmacity)"
            url="https://www.vizagsteel.com/"
            description="Form-V statements and six-monthly compliance reports: the steel plant's marine outfall marker and effluent figures on the rivers page, and the claims of the steel plant, HPCL and Gangavaram Port on the allocations page. Also NTPC Simhadri's 2021 compliance report for its Yeleru draw on the rivers page, and RINL's 2018 filings with MoEFCC for the Kanithi balancing reservoir on the water-body cards and the origins page. Cover letters say 'within norms' while the attached tables show exceedances; both are carried. Statutory filings the operators post publicly, cited with attribution."
            frequency="half-yearly"
          />
          <DataSource
            name="AP High-Power Committee report on the styrene release at LG Polymers (Government of Andhra Pradesh, July 2020)"
            url="https://safteng.net/wp-content/uploads/2020/07/HPCR_on_Styrene_vapour_release_accident_at_LG_Polymers.pdf"
            description="Read for the rivers page's events on the Meghadri Gedda and the origins page: GVMC stopping releases from the Meghadrigedda reservoir on 8 May 2020, and two sets of reservoir samples, one detecting styrene and one not, both shown. Read from a copy on a third-party site (safteng.net). Government of Andhra Pradesh committee report, cited with attribution."
            frequency="closed (July 2020)"
          />

          <DataSourceGroupHeader title="Flood and civic infrastructure" />
          <DataSource
            name="IMD RSMC New Delhi cyclone reports (India Meteorological Department)"
            url="https://rsmcnewdelhi.imd.gov.in/"
            description="After-event reports for the flood-risk page's storms (Hudhud 2014, the deep depression of October 2020, Gulab 2021, Michaung 2023 and Montha 2025): date, track, the 24-hour rainfall at IMD's Visakhapatnam stations, and storm surge. The 2024 heavy-rain row is not IMD's: it is the state government's district figure from its flood memorandum, and the page credits it so. IMD's reports may not be reproduced in part or full without permission, so only event figures are cited and no report is reproduced."
            frequency="per event"
          />
          <DataSource
            name="Government of Andhra Pradesh memorandum on the floods of August and September 2024 (via APSDMA)"
            url="https://apsdma.ap.gov.in/files/06104de92b01f273eead196a654d65dc.pdf"
            description="The source of the flood page's 2024 row: 129 mm across Visakhapatnam district over the six days from 29 August, a district average rather than a station reading, and the district's damage figures. We have not found a licence or terms of use on the APSDMA site, whose footer reads 'All rights reserved'; cited with attribution."
            frequency="closed (September 2024)"
          />
          <DataSource
            name="Andhra Pradesh State Disaster Management Authority (APSDMA)"
            url="https://apsdma.ap.gov.in/"
            description="Listed on the flood page for the state's alerts and post-event memoranda. Its disaster history page gives Hudhud's death toll as 61, which the flood page sets beside the 46 in the state's table in IMD's report, and it hosts the 2018 district disaster plan and the state GIS layer of drains described below. We have not found a licence or terms of use on the site, whose footer reads 'All rights reserved'; cited with attribution."
            frequency="during and after events"
          />
          <DataSource
            name="VMRDA draft Master Plan 2041 (Visakhapatnam Metropolitan Region Development Authority, June 2021)"
            url="http://vmrda.gov.in/masterplan-2041/DMPreports.pdf"
            description="The only modelled flood maps we have found that cover the city: the state planning society's storm-surge and river-flood maps, reproduced at region scale (PDF pp47-48), with the 11 villages in the Meghadrigedda reservoir's floodable zone and GVMC's 2,714.5 km of storm-water drains. Also read for the Kondakarla Ava card. A draft, so its proposals are not shown as commitments. Andhra Pradesh government plan document, cited with attribution."
            frequency="closed (draft, June 2021)"
          />
          <DataSource
            name="INCOIS storm surge and ocean state (Indian National Centre for Ocean Information Services, Ministry of Earth Sciences)"
            url="https://incois.gov.in/"
            description="Listed on the flood page for ocean-state and storm-surge forecasts during a cyclone. No figure on any page comes from it. Its disclaimer does not permit reproducing its material for commercial purposes without permission, so nothing is reproduced."
            frequency="during events"
          />
          <DataSource
            name="GVMC draft City Disaster Management Plan, Volumes I and II (2015)"
            url="https://www.gvmc.gov.in/wss/image_uploads/cdmp1.pdf"
            description="The link opens Volume I, whose Table 5-2 lists inundation-prone areas in 14 of GVMC's earlier 72 wards. Volume II, a separate file on GVMC's site (cdmp2.pdf), maps storm-water drainage in 14 zones at city scale, as a picture. The flood page names both and maps neither, because the ward numbers are no longer in use. GVMC publication, cited with attribution."
            frequency="closed (draft, 2015)"
          />
          <DataSource
            name="GVMC City Development Plan (prepared with ASCI, data to September 2006; published by the World Bank and Cities Alliance)"
            url="https://documents1.worldbank.org/curated/en/195691468042841007/pdf/732240WP0P09510reater0Visakhapatnam.pdf"
            description="Its list of flood-prone areas, in an older division numbering, its count of 22 major geddas and about 1,400 km of storm-water drains, and its proposal of a drainage master plan, which we have not found published. Also read for source distances measured from the town service reservoir and for supply figures of about 2006 on the origins page. GVMC plan, cited with attribution."
            frequency="closed (data to September 2006)"
          />
          <DataSource
            name="NRSC Flood Hazard Atlas for Andhra Pradesh (National Remote Sensing Centre, ISRO, July 2021, via APSDMA)"
            url="https://apsdma.ap.gov.in/files/6fcd75484b7b24ca5f4e92551a671aca.pdf"
            description="River flooding seen from satellite, 2000 to 2020. The flood page cites it only to say that it states local and flash floods may not be captured. Government of India publication, cited with attribution."
            frequency="closed (Version 1, July 2021)"
          />
          <DataSource
            name="World Bank, Andhra Pradesh Disaster Recovery Project (appraisal of June 2015 and completion report of October 2022)"
            url="https://documents1.worldbank.org/curated/en/664981467999114241/pdf/PAD1408-PAD-P154847-IDA-2015-0157-1-Box391456B-OUO-9.pdf"
            description="The appraisal gives Hudhud's death toll as 61, shown on the flood page beside the state's 46, and describes the US$370 million recovery project on the origins page; the completion report counts the consumer accounts on the underground power network. World Bank project documents, cited with attribution."
            frequency="closed (2015 and 2022)"
          />
          <p className={P}>
            We have not found a GVMC flood map, a current list of waterlogging spots, GVMC drain network data or a
            gedda register, so this group has no civic layer. A state GIS layer maps the drains of 2019 without
            names or capacities, with no licence statement we have found, so the flood page mentions it and does
            not draw it.
          </p>

          <DataSourceGroupHeader title="Satellite and remote sensing" />
          <DataSource
            name="Landsat 5, 7 and 8 (USGS and NASA, via Google Earth Engine)"
            url="https://www.usgs.gov/landsat-missions"
            description="With Sentinel-2, the images behind our own shoreline measurement: a water index traced on December-to-May median images in ten epochs from 1990 to 2026, measured every 100 m along transects from Appikonda to Pedda Nagamayyapalem, just north of Bheemunipatnam, with a weighted trend for each transect. USGS public domain, with courtesy attribution."
            frequency="continuous"
          />
          <DataSource
            name="Copernicus Sentinel-2 L2A (ESA, via Google Earth Engine)"
            url="https://dataspace.copernicus.eu/"
            description="The recent epochs of the same shoreline measurement. No tidal correction is applied; the spring tide range here is 1.43 m. Copernicus free and open data, attribution required."
            frequency="continuous"
          />
          <DataSource
            name="NCCR National Assessment of Shoreline Changes (National Centre for Coastal Research, Ministry of Earth Sciences)"
            url="https://www.nccr.gov.in/sites/default/files/schangenew.pdf"
            description="The official record the shoreline page sets our measurement beside: the 1990-2016 national assessment (Kankara, Ramana Murthy and Rajeevan, 2018), and the stretch classes in the Ministry of Earth Sciences' Lok Sabha reply of 11 December 2024, which draws on it. That reply classes four stretches here as Low Erosion: Yarada, RK Beach, 'Mangamari Peta to Bheemili' and 'Bheemunipatnam to Pedanagamayyapalem'. The other stretches are not on its erosion-prone list. Government of India (MoES and NCCR) publication, cited with attribution."
            frequency="irregular"
          />
          <DataSource
            name="CWC Guidelines for Protection and Control of Coastal Erosion in India (Central Water Commission, prepared by CSIR-NIO, December 2020)"
            url="https://irrigation.kerala.gov.in/sites/default/files/2021-06/CWC_Guidelines_Coastal.pdf"
            description="The design tide levels behind the shoreline page's 1.43 m spring tide range (from the Survey of India's 2017 tide tables), and the guidelines' account of the port moving sand onto RK Beach. Read from the Kerala Irrigation Department's copy. Government of India publication, cited with attribution."
            frequency="closed (December 2020)"
          />
          <DataSource
            name="Visakhapatnam Port Authority Administration Report 2022-23"
            url="https://shipmin.gov.in/sites/default/files/AR%2C_AA_and_%20Audit_Report%20English_2022-23.pdf"
            description="A Rs 20 crore sand-trap dredging for beach nourishment, inaugurated on 12 February 2023, which is why the shoreline page treats RK Beach as a managed beach. Government of India publication, cited with attribution."
            frequency="closed (2022-23)"
          />
          <DataSource
            name="FABDEM bare-earth elevation (Fathom and the University of Bristol, via Google Earth Engine)"
            url="https://www.fathom.global/product/fabdem/"
            description="The ground-height bands on the water-bodies map: 30 m elevation with buildings and trees removed, grouped into seven bands from 0-2 m to 100 m and above. FABDEM stores the sea here as exactly 0 m, so those pixels are removed; we have not found published GVMC boundary geometry, so there is no city-boundary clip and the bands also cover land just outside GVMC. Bands, not spot heights. CC BY-NC-SA 4.0, non-commercial and share-alike; derived from Copernicus GLO-30, so its attribution to DLR and Airbus passes down."
            frequency="versioned releases"
          />

          <DataSourceGroupHeader title="History and research" />
          <DataSource
            name="Madras District Gazetteer, Vizagapatam (1907), and the Imperial Gazetteer of India (1908), via the Internet Archive"
            url="https://archive.org/details/vizagapatam01madr"
            description="The official record of the town's first water works, handed over in May 1903 with 25 million cubic feet of storage, in the reservoir known today as Mudasarlova. Read for the water-body cards and the origins page, with the Imperial Gazetteer for the 1891 and 1901 population. Public domain (published 1907 and 1908); read from the Internet Archive's scans and cited with attribution."
            frequency="closed (1907 and 1908)"
          />
          <DataSource
            name="Census of India district handbooks, 1951 to 2011"
            url="https://censusindia.gov.in/nada/index.php/catalog/28416"
            description="Populations and town amenities for the origins page, from the handbooks of 1951, 1971, 1981, 2001 and 2011. Population figures on the page are census figures only. Government of India publication, cited with attribution."
            frequency="closed (1951 to 2011)"
          />
          <DataSource
            name="Lok Sabha and Rajya Sabha records (via the Internet Archive's copy of the Parliament Digital Library)"
            url="https://archive.org/details/eparlib.nic.in.47958"
            description="Answers to questions from 1986 to 1995 and committee reports from 1965 to 2010: the 1989 city scheme to draw from the Yeleru and Raiwada canals and the Yeleru water reaching the steel plant in 1991, on the allocations page, and the port, steel plant and Yeleru history on the origins page. Parliament of India record, cited with attribution."
            frequency="closed (1965 to 2010)"
          />
          <DataSource
            name="Madras and Andhra Pradesh Legislative Assembly records (1953 and 1964, via the Internet Archive)"
            url="https://archive.org/details/TNLA-DB-01-1953-4-9-10-QH17_1953-07-24"
            description="A 1953 answer on the military's water works at the Gosthani and the Meghadri Gedda, and the 1964 budget speech on reservoirs for the steel plant, both quoted on the origins page. Assembly records, cited with attribution."
            frequency="closed (1953 and 1964)"
          />
          <DataSource
            name="Institutions' own history pages and releases (Visakhapatnam Port Authority, GVMC, RINL, HPCL, Coromandel International, Google, Adani)"
            url="https://vizagport.com/Template/navigateTemplate/gnt/T3VyIEhpc3Rvcnk="
            description="Dates from each institution's own pages: the inner harbour built at the mouth of the Meghadri Gedda in 1927-33, on the rivers and origins pages; GVMC's formation in 2005; the refinery, fertiliser plant and steel plant years; and the data-centre groundbreaking of 28 April 2026, whose releases state no cooling-water source. The same operators' statutory filings are listed under Rivers and pollution. Cited with attribution."
            frequency="irregular"
          />
          <DataSource
            name="Press Information Bureau release of 14 October 2025 (Government of India)"
            url="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2179035"
            description="The announcement of Google's AI hub at Visakhapatnam, which the origins page notes gives no water figure. Government of India press release, cited with attribution."
            frequency="closed (14 Oct 2025)"
          />
          <DataSource
            name="NDMA report on lessons from Cyclone Hudhud (National Disaster Management Authority, August 2015)"
            url="https://ndma.gov.in/sites/default/files/PDF/Reports/Hudhud-lessons.pdf"
            description="How water supply was kept going after Hudhud, with generators at the head water works and power back within two to seven days in urban areas, and the death toll of 61, for the origins page. Government of India publication, cited with attribution."
            frequency="closed (August 2015)"
          />
          <DataSource
            name="Peer-reviewed research (npj Emerging Contaminants 2026, Environmental Challenges 2026, Journal of Water and Health 2023, Journal of Environmental Science and Engineering 2010)"
            url="https://www.nature.com/articles/s44454-026-00046-0"
            description="Research, never presented as official monitoring: the PFAS study behind the facts page's research card, a Chennai shoreline study whose error figures weight our transects, and two groundwater studies on the origins page, read from their abstracts. Academic publications, cited with attribution."
            frequency="closed (2010 to 2026)"
          />

          <DataSourceGroupHeader title="Base geometry" />
          <DataSource
            name="OpenStreetMap coastline, breakwaters and river mouths (OpenStreetMap contributors, Overpass API)"
            url="https://overpass-api.de/"
            description="The coastline the shoreline transects are laid along, and the breakwaters, piers and river mouths that mark a transect low confidence. The two port basins are bridged across rather than measured. The mandal outlines on the groundwater map are IN-GRES's own, listed above; we have not found ward geometry that can be published. Open Database License (ODbL) 1.0."
            frequency="continuous"
          />
          <DataSource
            name="GVMC ward records: the 98-ward map (2021) and the ward list (2023)"
            url="https://www.gvmc.gov.in/wss/image_uploads/gvmcnewward98.pdf"
            description="GVMC's 98-ward map is a CAD plot with no coordinates, and its ward list is what the zone field of the Esri India tracing in circulation disagrees with for 94 of 98 wards. With the 2026 notice of 120 wards, they are why no ward page is shown. GVMC publication; its site terms are a disclaimer, not a licence. Cited with attribution, and the map is not redrawn."
            frequency="irregular (a ward delimitation)"
          />
          <DataSource
            name="G.O.Ms.No.18 of 10 January 2020 (Municipal Administration and Urban Development Department, Government of Andhra Pradesh)"
            url="https://goir.ap.gov.in/dgo.ashx?gid=448205&fileType=E"
            description="The order that set GVMC's 98 wards, on which the council elected in March 2021 sits; read for the ward count. The state's government orders register allows reproduction free of charge, with the source acknowledged."
            frequency="closed (order of 10 Jan 2020)"
          />
        </div>
      );
    case "data-quality-1":
      return (
        <>
          {" "}
          For {cityName}, CPCB&apos;s 2019-2024 tables list no river-type station, so the badges are read from
          the stations CPCB does sample on the city&apos;s channels: two reservoirs, a creek and a canal.
        </>
      );
    case "river-status-consequence":
      return (
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          For {cityName},{" "}
          CPCB&apos;s tables give no river stretch to set a badge against. Its 2019-2024 tables list no
          river-type station in the city, and none of the stretches on its polluted river lists of 2018, 2022 and
          2025 is here (the &lsquo;Gostani&rsquo; on those lists is in West Godavari district). The rivers page
          still colours each channel, using the thresholds above on the latest year at the stations along it. The
          Meghadri Gedda reads severely degraded because of the tidal creek by the Naval Dockyard (lowest
          dissolved oxygen 2.4 mg/L in 2024); the Meghadrigedda reservoir on the same channel would read stressed
          on its own. The Gosthani, read at Thatipudi reservoir upstream in Vizianagaram district, and the Yeleru
          canal, read near Pharma City at Parawada, read stressed. Each channel&apos;s CPCB class tile says
          &lsquo;Not assessed (no river station in CPCB&apos;s 2019-2024 tables)&rsquo;. Read the badges as the
          state of the water at those stations, not of a river.
        </p>
      );
    case "river-status-footnote":
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
          Status thresholds follow CPCB&apos;s published Designated Best-Use criteria; readings are from CPCB&apos;s
          NWMP annual tables for reservoirs, canals and coastal water, 2019-2024.
        </p>
      );
    case "data-quality-2":
      return (
        <SubSection title={`Data quality for ${cityName}`}>
          <p className={P}>
            What to keep in mind about the figures behind the {cityName} pages, source by source.
          </p>
          <Gap title="GVMC's only supply sheet covers one day, and two of its figures are fixed ratios">
            <p>
              GVMC&apos;s source-by-source sheet of 11 March 2021, annexed to its report in NGT OA 14/2021 (SZ), is
              the only one from GVMC itself that we have found. Its net supply is the total less a flat 15%, and
              its per-person figure divides the household share by an assumed 2.30 million people; neither is a
              measurement, and neither is used. The canal split prints no unit and is read as million gallons a
              day, like the sheet&apos;s other columns. Its bore rows give the same figure for normal and present
              supply, so they read as set figures, not readings.
            </p>
          </Gap>
          <Gap title="The 380 MLD supply table has not changed since June 2022">
            <p>
              CGWB&apos;s 2025 plan reports GVMC&apos;s supply by source as GVMC gave it: nine sources, about 380
              MLD. The same quantities and total are in CGWB&apos;s June 2022 and November 2023 reports, so the
              dashboard shows them as GVMC&apos;s figures carried forward, not a current measurement. The rows add
              to 380 to 402 MLD depending on which end of the Godavari and Yeleru range (182 to 204 MLD) is taken;
              the printed 380 matches the low end. The &lsquo;490 MLD demand against 391 MLD supply&rsquo;
              row is the 2022 report&apos;s figure for 2020.
            </p>
          </Gap>
          <Gap title="APWRIMS groundwater readings carry values forward">
            <p>
              The APWRIMS archive carried one value forward for 195 days at Visalakshinagar and fills gaps of up
              to 30 days with straight lines, and one station can carry different names in different lists.
              Repeated values, straight-line fills, spikes, readings more than 20 m from a well&apos;s usual level
              and stuck sensors are removed before monthly means are taken. Recorders whose identity we could not
              settle are flagged or left out.
            </p>
          </Gap>
          <Gap title="Two redraws break the groundwater series">
            <p>
              Andhra Pradesh divided Visakhapatnam district in April 2022, and IN-GRES kept one district id across
              the change: its district rows cover 8,547.7 km2 in 2016-2017 and 11,050.6 km2 in 2019-2020, then
              1,001.7 km2 from 2021-2022. The single 513.8 km2 GVMC assessment unit became seven urban mandals in
              2023-24. So the map starts at 2023-2024 and no trend is drawn across either redraw. In the 2025-2026
              edition every mandal&apos;s rainfall repeats its 2024-2025 figure, and revised recharge and
              industrial inputs move four urban mandals by more than 15 points; each moved unit says so on the map.
            </p>
            <p>
              IN-GRES&apos;s urban units also do not follow the state&apos;s mandal lines. Its Mulagada lies mostly
              in the mandal the state&apos;s own boundary map calls Pedagantyada, and its Peddagantyada is a strip
              around Gollalapalem and Gopalapatnam, so the two names look transposed. Figures are shown under
              IN-GRES&apos;s names, and each well names the state mandal its coordinates fall in. The unit outlines
              place the figures but are approximate: together they cover 973.8 km2 against the 1,001.7 km2
              assessed.
            </p>
          </Gap>
          <Gap title="Shoreline rates are our own measurement">
            <p>
              We have not found a published rate for each point on this coast, so the rates are our satellite
              measurement, with no tidal correction (the spring tide range here is 1.43 m) and weighted with error
              figures borrowed from a published study of another coast, not re-estimated here. 55 transects are
              drawn as low confidence and left out of the counts: 48 that sit on the Gangavaram port&apos;s built
              shore, cross the Rushikonda breakwater, sit at the Dolphin&apos;s Nose headland or beside river and
              stream mouths, or show large jumps in their measured waterline, each with its reason; and 7 that the
              pipeline&apos;s own test marks low because their recent positions scatter or jump.
            </p>
          </Gap>
          <Gap title="Ground height: the sea is zero and there is no city outline">
            <p>
              FABDEM stores the sea here as exactly 0 m, so those pixels are removed rather than drawn as the lowest
              band. We have not found published GVMC boundary geometry, so the bands cover the box around the city,
              land just outside GVMC included. They are bands, not spot heights.
            </p>
          </Gap>
          <Gap title="Thatipudi and Raiwada: one of two level records kept, late 2021 to March 2024">
            <p>
              From late 2021 to 7 March 2024 the APWRIMS archive carries two level records for Thatipudi and
              Raiwada, and the published reading moves between them from day to day. Thatipudi&apos;s two sit
              about 4.4 m apart on most days; Raiwada&apos;s mostly agree but part by up to 3.5 m on some days in
              2023. Since 8 March 2024 the feed has carried only one of them, and we keep that one from its first
              reading: 7 September 2021 for Thatipudi and 13 December 2021 for Raiwada. Days that carry only the
              other record are left out, so from those dates to 7 March 2024 Thatipudi has a reading on 169 of 913
              days and Raiwada on 304 of 816, and the history chart has gaps there. Earlier readings are mostly
              from the other record. At Thatipudi that shows as a step: its live storage goes from 0.77 TMC
              on 6 September 2021 to 1.65 TMC the next day, where the record changes, so its years before then are
              not directly comparable with the years after. We have not found which record the department treats
              as correct; the one we keep is the one it publishes today. Yeleru&apos;s and Meghadrigedda&apos;s two
              records agree to within half a metre, and their readings are shown as published.
            </p>
          </Gap>
        </SubSection>
      );
    case "limitations":
      return (
        <SubSection title={t("about.limitations")}>
          <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
            <li>
              There is no days-of-water-left figure: five of the six reservoirs are shared with irrigation, industry
              or other users, two lifts add Godavari water, and we have not found a measured figure for the
              city&apos;s daily use.
            </li>
            <li>
              Supply figures come from documents, not meters: the 380 MLD table is GVMC&apos;s, carried unchanged in
              CGWB&apos;s reports since June 2022, and the canal split is one day, 11 March 2021. We have not found a
              measured non-revenue water figure for GVMC, so no losses figure is shown.
            </li>
            <li>
              Reservoir readings are daily and published by the state for four of the six reservoirs; Mudasarlova
              and Gambheeram are not in the feed.
            </li>
            <li>
              Groundwater is assessed by mandal, not by ward, and no trend crosses the 2022 district split or the
              2023-24 unit split.
            </li>
            <li>
              CPCB&apos;s 2019-2024 tables list no river-type station in the city, so river badges describe two
              reservoirs, a creek and a canal.
            </li>
            <li>
              The flood record is a list of cyclones, depressions and one spell of heavy rain, each from its own
              source. We have not found a GVMC flood map, a current list of waterlogging spots or a drainage master
              plan.
            </li>
            <li>We have not found ward geometry that can be published, so nothing is shown by ward.</li>
            <li>
              Shoreline rates are our satellite measurement without tidal correction; the official record is
              NCCR&apos;s stretch classes.
            </li>
            <li>
              Ground-height bands come from FABDEM with the sea removed and no city-boundary clip. FABDEM&apos;s
              licence is non-commercial and share-alike.
            </li>
            <li>
              Utility-published feeds can be stale (weekends, holidays, portal outages). Each surface shows a
              freshness indicator.
            </li>
            <li>The pages are in English. Telugu is planned and has not been translated yet.</li>
          </ul>
        </SubSection>
      );
    case "data-quality-3":
      return (
        <SubSection title="Where official figures disagree, all of them are shown">
          <p className={P}>
            Official documents give different figures for the same thing. The pages show each figure as published,
            with its source, rather than choosing one or correcting it to make the sums agree.
          </p>
          <ul className={`list-disc list-inside space-y-2 ${P}`}>
            <li>
              <span className="font-semibold">Distance to the sources.</span>{" "}
              Raiwada is 60 km in CGWB&apos;s 2025
              plan, 56 km in its 2022 and 2023 reports and 76 km on GVMC&apos;s 2021 sheet; Thatipudi is 56 km (CGWB
              2025 and GVMC 2021) or 60 km (CGWB 2022 and 2023); Meghadrigedda is 5 km (CGWB 2025) or 20 km (GVMC
              2021).
            </li>
            <li>
              <span className="font-semibold">The Godavari and Yeleru route.</span>{" "}
              190 km is CGWB&apos;s distance to
              the source. The canal is about 150 km in the draft Green City Action Plan; GVMC&apos;s 2021 sheet
              prints 156 km against Yeleru reservoir and 56 km against the Kateru pump house, which is the length
              of VIWSCO&apos;s pipeline from Kateru to the canal.
            </li>
            <li>
              <span className="font-semibold">Total supply.</span>{" "}
              About 380 MLD available (CGWB 2025, Table 9.1),
              391 MLD in another table of the same report, and about 395.5 MLD in the draft Green City Action Plan;
              345.5 MLD that GVMC was able to draw (CGWB 2022); 334.03 MLD present supply (Chief Secretary&apos;s
              report, NGT Principal Bench OA 606/2018, 10.07.2024, Annexure-VI, p33).
            </li>
            <li>
              <span className="font-semibold">The city&apos;s Polavaram share.</span>{" "}
              23.44 TMC a year (Polavaram
              Project Authority), 24 TMC (a 2004 order cited in GVMC&apos;s 2019 assessment for the Asian
              Development Bank; we have not found the order) and 12 TMC (CGWB 2025).
            </li>
            <li>
              <span className="font-semibold">Meghadrigedda&apos;s dam.</span>{" "}
              CWC&apos;s National Register of Large
              Dams (2019, as &lsquo;Mehadrigedda&rsquo;, AP01MH0042) gives completion in 1977 and lists it as
              operated and maintained by the Water Resources Department. GVMC&apos;s 2018 assessment says
              constructed 1977, commissioned 1979, and describes the reservoir surface as owned by GVMC. CGWB lists
              the source from 1976.
            </li>
            <li>
              <span className="font-semibold">Sewage generated.</span>{" "}
              248 MLD in the state&apos;s February 2026
              affidavit to the NGT Principal Bench; 215.05 MLD in GVMC&apos;s own March 2024 affidavit in NGT OA
              40/2024 (SZ), estimated as 85% of supply. The later state figure is used.
            </li>
            <li>
              <span className="font-semibold">Water losses.</span>{" "}
              The draft Green City Action Plan gives nearly 30
              percent on one page and 35 percent on another, without saying how either was measured, so no losses
              figure is shown.
            </li>
            <li>
              <span className="font-semibold">Groundwater in the supply.</span>{" "}
              2.75 million gallons a day from bores
              on GVMC&apos;s 2021 sheet, 30 percent of the city&apos;s needs in the draft plan, and 17.37 percent of
              supply in CGWB&apos;s 2025 plan. We have not found a measured figure.
            </li>
            <li>
              <span className="font-semibold">Mudasarlova&apos;s capacity.</span>{" "}
              GVMC&apos;s 2018 assessment gives
              1.5 million cubic metres, which it calls the original capacity, and 0.75 million cubic metres at full
              tank level after siltation, with no survey or date behind it, so the capacity is left blank.
            </li>
          </ul>
        </SubSection>
      );
    default:
      return <>{fallback}</>;
  }
}
