"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { AhmedabadPageDescriptions } from "./ahmedabad-pages";

/** Ahmedabad's About-page content: the slots of the shared About frame that
 *  are specific to Ahmedabad. A slot not listed renders the frame's default.
 *  Source URLs follow scripts/source-registry/ahmedabad.json. */

export default function AhmedabadAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return <AhmedabadPageDescriptions cityId={config.cityId} cityName={cityName} />;
    case "data-sources-2":
      return (
        <>
          <DataSource
            name="AMC budget documents (2023-24 English, 2026-27 Gujarati)"
            url="https://ahmedabadcity.gov.in/SP/Budget"
            description="The corporation's only current statement of its water sources, treatment plants, sewage plants and lake programme. The dashboard's source table is from the 2026-27 budget, printed pp.63-64; the 2023-24 budget is where AMC says supply runs two hours a day through unmetered connections. AMC's Water Project web page has carried the same older table since early 2022 and is not used."
            frequency="yearly (February)"
          />
          <DataSource
            name="AMC City Map ward layer"
            url="https://inhouse-amcmodules.ahmedabadcity.gov.in:8023/"
            description="AMC's own 48-ward, 7-zone map, linked from 'Know Your Ward' on the corporation's site. The boundaries are read from the map app itself, since no ward download service exists. Two of its area attributes are wrong, so areas are recomputed from the shapes."
            frequency="per delimitation"
          />
          <DataSource
            name="State Election Commission, Gujarat: AMC ward delimitation order (3 Oct 2020)"
            url="https://sec.gujarat.gov.in/images/pdf/Ahmedabad-MNP-2020.pdf"
            description="The final order that drew the 48 wards and 192 seats, used again for the 2026 polls. Its schedule gives each ward's Census 2011 population, 5,664,062 in all."
            frequency="per delimitation"
          />
          <DataSource
            name="Gujarat water department daily dam report"
            url="https://wrd-dam.gujarat.gov.in/index.php"
            description="The Narmada, Water Resources, Water Supply and Kalpsar Department's daily report: level, storage, inflow and releases for Sardar Sarovar, Kadana and Dharoi, and the Narmada Main Canal's flow at its head regulator. One PDF a day, kept as issued from 7 June 2019. Each row is accepted only if its own storage arithmetic holds. CWC's weekly bulletin uses different capacities for the same dams and is never mixed with it."
            frequency="daily"
          />
          <DataSource
            name="IN-GRES groundwater assessment (Ahmedabad district, by taluka)"
            url="https://ingres.iith.ac.in/"
            description="The national Dynamic Ground Water Resource Assessment for the district's ten talukas, five editions from 2021-2022 to 2025-2026, drawn on IN-GRES's own unit boundaries. Volumes leave the saline tract out, as CGWB publishes them."
            frequency="annual (state editions)"
          />
          <DataSource
            name="National Water Data Portal: groundwater level telemetry (Gujarat)"
            url="https://nwdp.nwic.gov.in/"
            description="Six-hourly readings from 139 piezometers in the district, run by Gujarat's Surface Water and Ground Water Department and CGWB, shown as monthly means. Wells are placed by their coordinates because district tags follow old boundaries."
            frequency="6-hourly telemetry"
          />
          <DataSource
            name="CPCB National Water Quality Monitoring Programme (2018-2024)"
            url="https://cpcb.gov.in/water-quality-data/"
            description="Annual river tables: ten Sabarmati stations from Kheroj to Vautha and the Khari at Lali village, each year's lowest and highest value as CPCB prints it. One station's coordinate is withheld because CPCB's list places it inside the city."
            frequency="annual"
          />
          <DataSource
            name="CPCB Polluted River Stretches (2018, 2022, October 2025)"
            url="https://cpcb.gov.in/polluted-river-stretches/"
            description="The Sabarmati's and the Khari's Priority I class in all three editions. CPCB's website policy requires its approval for any use beyond download and print, so the report is cited here, not copied."
            frequency="every 2 to 3 years"
          />
          <DataSource
            name="Central Water Commission flood forecasting: Sabarmati at Subhash Bridge"
            url="https://ffs.india-water.gov.in/"
            description="Station 020-MAHGAND, read every hour against a warning level of 44.09 m and a danger level of 45.34 m. The only live public reading of the river inside the city we have found, and the flood-risk page's trigger."
            frequency="hourly"
          />
          <DataSource
            name="Gujarat Information Department press releases (Ahmedabad)"
            url="https://gujaratinformation.gujarat.gov.in/"
            description="Where AMC's storm figures are published: rainfall by zone, waterlogging spots flooded and cleared, pumps running. The July 2026 flood record is built from four of these releases, in Gujarati."
            frequency="during storms"
          />
          <DataSource
            name="Gujarat State Disaster Management Authority"
            url="https://www.gsdma.org/rainfalldata-2?Type=2"
            description="The state's daily 24-hour rainfall report by taluka, with a row for Ahmedabad City, and the city disaster management plan 2026 with its alert levels by river flow."
            frequency="daily in monsoon; plan yearly"
          />
          <DataSource
            name="Sabarmati River Front Development Corporation Ltd (SRFDCL)"
            url="https://sabarmatiriverfront.com/environmental-improvement.html"
            description="The riverfront company's own account: the Vasna barrage holds water for 15 km upstream, the Narmada canal replenishes it, and interceptor sewers on both banks take sewage from 38 discharge points. Undated pages."
            frequency="episodic"
          />
          <DataSource
            name="Gujarat High Court: Suo Motu PIL 98/2021 (Sabarmati) and lake orders"
            url="https://gujarathighcourt.nic.in/"
            description="The court's own case on Sabarmati pollution, taken up on 6 August 2021, with a Joint Task Force under CPCB from 14 September 2021; its orders carry AMC's sewage-plant dates. The court's case-status site sits behind a captcha, so orders are read as annexed to NGT filings and, for the Chandola Lake orders of 2002 and 2025, on Indian Kanoon."
            frequency="per hearing"
          />
          <DataSource
            name="National Green Tribunal filings (Gujarat)"
            url="https://www.greentribunal.gov.in/news-update?title=GUJARAT"
            description="The state's sewage compliance affidavits in OA 606/2018, which give Ahmedabad's sewage generation as 'Calculated as per 80% of Water Supply' and its reuse as 26%; AMC's reply in OA 91/2023 (WZ); and OA 79/2025 (WZ) on the city's vanished water bodies."
            frequency="every 5 to 8 months"
          />
          <DataSource
            name="MoHUA AMRUT 2.0 project status"
            url="https://amrut.mohua.gov.in/"
            description="As-on status lists for AMRUT 2.0 water projects: row 182 of the 2 March 2026 list is AMC's 400 MLD Kotarpur plant. The portal's AMC project list gives different figures from AMC's budget for several lakes; both are shown."
            frequency="irregular"
          />
          <DataSource
            name="Chief Minister's Office, Gujarat: press releases"
            url="https://cmogujarat.gov.in/en/latest-news"
            description="Dated status for two commitments: the Kharicut canal's phase 1 at 80% (11 March 2025) and the riverfront's three phases by the end of 2027 (6 June 2026)."
            frequency="as issued"
          />
          <DataSource
            name="Government of Gujarat, Policy for Reuse of Treated Waste Water (2018)"
            url="http://faolex.fao.org/docs/pdf/ind200786.pdf"
            description="The state's targets of reusing 70% of treated wastewater by 2025 and 100% by 2030. Read from the FAOLEX copy of the signed policy, since no copy was found on a gujarat.gov.in site."
            frequency="one-time (May 2018)"
          />
          <DataSource
            name="Gujarat water department circular on municipal water charges (2008)"
            url="https://guj-nwrws.gujarat.gov.in/downloads/circular_clarification_of_watercharges.pdf"
            description="How Gujarat sanctions raw water to cities each year, with a 25% band either side. The quantity sanctioned for Ahmedabad is not in it, or in any public document found."
            frequency="one-time (Sept 2008)"
          />
          <DataSource
            name="Ministry of Jal Shakti, first Census of Water Bodies (Gujarat tables)"
            url="https://mowr.nic.in/irrigationcensus/Reports/6MIC/WBS/"
            description="Ahmedabad district: 1,964 water bodies, 176 of them urban, 19 encroached (all urban). The 176 matches AMC's own lake count; neither source shows whether they are the same lakes."
            frequency="one-time (reference year 2017-18)"
          />
          <DataSource
            name="IMD gridded rainfall, with an Open-Meteo provisional fill"
            url="https://imdlib.readthedocs.io/en/latest/"
            description="Grid cell 23.0 N, 72.5 E, 1970 to 2025. Checked against IMD's own Ahmedabad observatory normal of 783.6 mm (1991-2020): this cell gives 800.4 mm over the same years, the cell to its east 868.3 mm. Months after IMD's last published month come from Open-Meteo's reanalysis (CC BY 4.0) and are marked provisional."
            frequency="monthly; daily provisional fill"
          />
          <DataSource
            name="OpenStreetMap water bodies and rivers"
            url="https://www.openstreetmap.org/copyright"
            description="Every lake, pond and river polygon on the map (232, 52 of them named) and the Sabarmati, Khari, Kharicut and Narmada Main Canal lines (ODbL 1.0), because AMC publishes no lake register or lake layer."
            frequency="as edited (ODbL)"
          />
          <DataSource
            name="Gazetteer of the Bombay Presidency, Vol. IV: Ahmedabad (1879)"
            url="https://archive.org/details/dli.ministry.08145"
            description="The 1868 rains and the 1875 flood on the flood-risk page, the old feeds of Kankaria and Chandola, and much of the origins page. Public domain, read through the Internet Archive."
            frequency="closed (1879)"
          />
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
