"use client";

/**
 * Nagpur-specific "What each page shows" subsections.
 *
 * English-only for now; Marathi follows in the i18n pass (the Pune posture).
 * Nagpur departs from the Chennai baseline in four ways this page explains:
 * its water is a reservation inside a state power and irrigation project
 * shared with Madhya Pradesh, so there is no days-left figure; its city
 * rivers are sampled by NMC once a year while the Kanhan is sampled by MPCB
 * every month; its groundwater reads Safe everywhere, on inputs that changed
 * in the latest edition; and its official maps (water bodies 2017-18, wards
 * 2025) are dated surveys, not live layers.
 *
 * Every figure is read from a shipped artifact, a registry note or a topic
 * builder's checked page reference (scripts/source-registry/nagpur-*.json);
 * none is typed from memory. A page link renders only while that route is on
 * for the city, so this text never points at a page that is off.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { getPlaceConfig } from "@/lib/cities";
import type { RouteKey } from "@/lib/cities/ids";
import { SubSection, Gap, type CityPagesProps } from "@/components/about/primitives";

const P = "text-slate-600 dark:text-slate-400";
const A = "text-blue-600 dark:text-blue-400 hover:underline";

function PageLink({ cityId, route, children }: { cityId: string; route: RouteKey; children: ReactNode }) {
  if (!getPlaceConfig(cityId).routes.includes(route)) return <>{children}</>;
  return (
    <Link href={route ? `/${cityId}/${route}` : `/${cityId}`} className={A}>
      {children}
    </Link>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={A}>
      {children}
    </a>
  );
}

export function NagpurPageDescriptions({ cityId, cityName }: CityPagesProps) {
  return (
    <>
      <SubSection id="freshness" title="What we track, and how often it changes">
        <p className={P}>
          Some of {cityName}&apos;s layers are read every day; most come from
          documents published once a year or less. Each page dates what it
          shows. In order of how often they change:
        </p>
        <ul className={`list-disc list-inside space-y-1 ${P}`}>
          <li>
            <strong>Every morning:</strong>{" "}storage in Totladoh and Navegaon
            Khairi, the two Pench dams, from the state Water Resources
            Department&apos;s dam bulletin. The record starts at the earliest
            dated bulletin this site holds, and each day&apos;s bulletin also
            gives the same date a year earlier. The department keeps dated
            copies of the bulletin from the end of February 2024.
          </li>
          <li>
            <strong>Every day, provisionally:</strong>{" "}rainfall for the months
            the India Meteorological Department (IMD) has not yet published in
            its gridded record, replaced by IMD&apos;s figures when they come
            out. IMD&apos;s record on this site runs to December 2025.
          </li>
          <li>
            <strong>Monthly averages, refreshed by hand:</strong> water levels
            in 101 groundwater telemetry wells on the National Water Data
            Portal. The latest month is September 2026 for most of the
            district and June 2026 for the three wells inside the city.
          </li>
          <li>
            <strong>Once a year:</strong>{" "}NMC&apos;s Environment Status Report
            (latest: 2023-24, published August 2025) and budget (2026-27,
            May 2026); the national groundwater assessment (2025-2026
            edition); MPCB&apos;s monthly river readings, released as yearly
            files (to December 2024).
          </li>
          <li>
            <strong>Dated snapshots:</strong>{" "}the State&apos;s water-body survey
            (2017-18), the 2025 ward map, NMC&apos;s river sampling (monsoon
            2023), the State&apos;s flood-line register and the commitments
            register (both read on 15 October 2026), and the order and
            resolution behind the city&apos;s Pench share (2018 and 2020).
          </li>
        </ul>
      </SubSection>

      <SubSection id="supply" title="Dashboard - Pench water from a shared reservoir, and the Kanhan">
        <p className={P}>
          <strong>Four of {cityName}&apos;s five treatment plants run on Pench water.</strong>{" "}
          NMC&apos;s{" "}
          <Ext href="https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf">
            Environment Status Report 2023-24
          </Ext>{" "}
          (prepared by CSIR-NEERI, section 6.2.1, printed pp.132-133) lists five
          plants with 786 MLD of capacity: Pench I to IV (136, 175, 120 and 115
          MLD, 546 in all) and Kanhan (240 MLD). The Pench water is released
          from Totladoh, the Pench hydro-electric reservoir shared with Madhya
          Pradesh, into the Navegaon Khairi pick-up dam, and goes to the
          Mahadula pumping station, at km 48.5 of the old canal route (ESR
          2017-18 draft). NMC told the state regulator that a closed pipeline
          replaced the canal in April 2015. The Kanhan plant lifts water from
          the river 14 km from the city.
        </p>
        <p className={P}>
          The{" "}
          <PageLink cityId={cityId} route="">
            dashboard
          </PageLink>{" "}
          opens on that supply chain. Its structure figures are NMC&apos;s most
          recent: its 2026-27 budget (published May 2026) counts 4.50 lakh water connections,
          106 water tanks, 4,650 km of distribution mains and 37 tankers for
          areas the network does not reach. The water balance below it is
          dated: for 2023-24, the report records 706 MLD supplied, 410 MLD
          billed and 41.91% lost between source and consumer, and counts
          &lsquo;certain areas&rsquo; in 36 of its 73 command areas as dark
          zones, where supply was found to be under two hours a day.
        </p>
        <Gap title="What NMC does not publish, that we have found">
          <p>
            <strong>Supply by source.</strong>{" "}NMC&apos;s reports give
            treatment capacity plant by plant and one citywide total of water
            supplied, so the source split on the dashboard is capacity, not
            supply. The latest figures by source are the raw-water bills in
            NMC&apos;s draft 2017-18 report, whose table gives no year.
          </p>
          <p>
            <strong>Hours of supply across the city.</strong> The reports count
            the command areas with dark zones but give no citywide hours.
          </p>
          <p>
            <strong>A current population.</strong>{" "}The last census count is
            from 2011, and the report&apos;s own estimate cites a commercial
            website, so the dashboard divides nothing by population.
          </p>
        </Gap>
        <Gap title="Figures shown exactly as NMC printed them">
          <p>
            The 2023-24 report prints a loss of 41.91%; 410 of 706 gives
            41.93%. The 2022-23 report states 47%, while its own table (250.679
            million cubic metres supplied, 377.454 MLD billed) gives 45.0% on
            our arithmetic, and that table&apos;s monthly rows add to 250.672
            million cubic metres against a printed total of 250.679. NMC dates
            its baseline of 346 tankers to 2016 in the environment reports and
            to 2018 in the budgets. The 2026-27 budget reports water revenue
            received &lsquo;to January 2027&rsquo; in a speech that prints no
            date (the budget was published in May 2026, and the latest date
            inside the speech is late February 2026), which we read as January
            2026. Each figure is shown as printed, not
            corrected to make the sums agree.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="reservoirs" title="Reservoirs - and why there is no days-of-water-left number">
        <p className={P}>
          The dashboard carries Totladoh and Navegaon Khairi (Kamthi Khairy in
          the state&apos;s bulletin). <strong>Neither is the city&apos;s own
          storage.</strong>{" "}The Central Water Commission&apos;s National
          Register of Large Dams (2019) lists Totladoh as a hydro-electric dam
          and Kamthikhairy as an irrigation dam; NMC holds a yearly reservation
          in the water they release. Each card shows the whole dam&apos;s live
          storage against its designed live capacity (1,016.93 and 141.98
          million cubic metres), as the bulletin reports it, never a city
          share. Dividing them by the city&apos;s demand would credit{" "}
          {cityName} with water planned for irrigation, power and Madhya
          Pradesh, so no days-left figure is computed.
        </p>
        <p className={P}>
          The Kanhan intake and Gorewada lake are listed without a reading. The
          intake draws from the running river, 300 m below the confluence of
          the Kolar and the Kanhan, so there is no stored volume to show.
          Gorewada was built in 1911 on the Pili as a source for the city and
          is not in the state&apos;s daily bulletin. Khindsi, Nand and Wadgaon,
          irrigation dams in the same district block of the bulletin, are read
          but not shown as city sources.
        </p>
        <Gap title="What the history chart does not use">
          <p>
            The National Water Data Portal also carries the Central Water
            Commission&apos;s daily level at Totladoh from June 2019, under a
            non-commercial licence, so it is not used here. Each day&apos;s
            bulletin prints the same date a year earlier only as a percentage;
            the chart turns it into a volume using the designed capacity. None
            of the sources used gives a full reservoir level for Kamthi Khairy,
            so none is shown.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="allocations" title="Allocations - a reservation inside a power and irrigation project">
        <p className={P}>
          <PageLink cityId={cityId} route="allocations">
            The allocation ledger
          </PageLink>{" "}
          sets NMC&apos;s Pench share beside what the city is recorded as
          drawing. The share grew in steps: 112 million cubic metres a year in
          the project plan (by NMC&apos;s account, a State letter of 29 March
          1965), 78 more sanctioned in 1998 as a temporary measure, made
          permanent in 2008 on conditions the regulator records as not yet
          met, and in 2010 continued as a temporary reservation until further
          orders; and set at 190 in the Water Resources Department&apos;s{" "}
          <Ext href="https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/Marathi/202003191442414827.pdf">
            resolution of 19 March 2020
          </Ext>{" "}
          (in Marathi, table on p.2), rising to 341 in a second phase
          that includes a planned 62 km tunnel bringing 10 TMC from the Kanhan
          in Madhya Pradesh. The state water regulator&apos;s order of 12
          September 2018 holds the 78 &lsquo;legal and intact as on
          today&rsquo;.
        </p>
        <p className={P}>
          The most recent published figures for what the city draws from each
          source are in NMC&apos;s draft 2017-18 report (its table is headed
          &lsquo;present&rsquo; and gives no year): 143.0 million cubic metres
          billed for the Pench, 43.8 for the Kanhan and 6.8 for Gorewada. The
          same report says the four Pench plants treated 456 MLD that year
          (about 166 million cubic metres) and the Kanhan plant 185 MLD (about
          67.5), more than either bill, and lists the Gorewada plant at 16 MLD
          of capacity and output, below its 20 MLD bill. Because the billed and
          treated figures disagree for all three, the ledger shows no delivery
          figure for any of them and gives both in each row&apos;s note. The
          regulator&apos;s order records that the 2017 monsoon was lean. Volumes stay in the unit of
          the orders; 1 million cubic metres a year is about 2.74 million
          litres a day.
        </p>
        <Gap title="Where the record is thin">
          <p>
            The 2017-18 draws come from NMC&apos;s draft Environment Status
            Report for that year, which we have read only in a copy hosted
            outside NMC&apos;s website. The Kanhan has four figures from four
            documents (55.00, 58 and 60 million cubic metres a year, and 65.71
            in a 2023 resolution that states no period) and
            no reservation order we have found. The 2020 re-planning is subject
            to a joint committee&apos;s decision on the project&apos;s yield,
            which we have not found published.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="groundwater" title="Groundwater - Safe across the district, read by category">
        <p className={P}>
          <PageLink cityId={cityId} route="groundwater">
            The groundwater map
          </PageLink>{" "}
          shows Nagpur district&apos;s 14 talukas across six editions of the
          national groundwater assessment (IN-GRES, 2019-2020 to 2025-2026),
          drawn on IN-GRES&apos;s own unit boundaries. The measure is the stage
          of extraction: how much of the groundwater that can be drawn each
          year (what refills, less what flows away naturally) is pumped out.
          The district reads Safe in all six editions, its stage falling from
          51.87% to 45.30%, and every taluka reads Safe on its total in
          2025-2026 (Hingna&apos;s canal command area reads Semi Critical);
          Saoner is highest at 67.53%, below the 70% line where
          CGWB&apos;s Semi Critical class begins.
        </p>
        <Gap title="The city's own unit: the category is the steadier comparison">
          <p>
            In IN-GRES&apos;s 2023-2024 area figures the city first appears as
            its own unit, <strong>Nagpur (Urban)</strong>, with 22,457 ha, and
            three units&apos; assessed areas fall by the same total: Nagpur
            (Rural) by 6,277 ha, Kamptee by 16,081 ha and Hingna by 99 ha. It
            is Safe in all three of its editions. The 2025-2026 row enters 206
            ha of the unit as canal command area (16,081 ha the year before);
            its other figures repeat the 2024-2025 values, so its stage of
            54.62% is in effect that of the non-command part alone, and the
            rise from 33.10% comes from that change. The taluka panel shows
            the unit&apos;s three editions as bars (31.30%, 33.10% and
            54.62%) with this caveat beside them. The older unit named
            NAGPUR is carried on as Nagpur (Rural), whose assessed area fell by
            those 6,277 ha.
          </p>
        </Gap>
        <p className={P}>
          The dots are <strong>101 telemetry wells</strong>, 91 run by the
          state&apos;s Groundwater Surveys and Development Agency and 10 by
          the Central Ground Water Board, read every six hours on the National
          Water Data Portal and shown as monthly means. Three stand inside the
          city, all of them the board&apos;s piezometers; their readings stop
          in June 2026, while 59 wells elsewhere in the district report into
          September 2026.
        </p>
        <Gap title="Why there is no ward-by-ward depth map">
          <p>
            The three wells in the city read a deeper, semi-confined aquifer
            than the shallow dug wells with long records, so a depth surface
            drawn across the wards would average two aquifers into one number.
            The page shows the wells themselves instead. The state agency&apos;s
            manual dug-well record is not on the map.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="rivers" title="Rivers - NMC samples the city's three, MPCB the river they drain to">
        <p className={P}>
          <PageLink cityId={cityId} route="rivers">
            The rivers page
          </PageLink>{" "}
          carries six rivers. The Nag, the Pili and the Pora run through the
          city: NMC sampled them in the monsoon of 2023 at 23 points (10 on the
          Nag, 8 on the Pili, 5 on the Pora), and the readings are its
          Environment Status Report&apos;s. On the Nag, dissolved oxygen falls
          from 3.67 mg/L where it leaves Ambazari lake to 0.48 mg/L at its last
          point in the city, and MPCB&apos;s water quality index for 2023-24
          puts it at 75 near Ambazari lake and 36 at Bhandewadi bridge. The
          three city rivers have no CPCB readings: MPCB lists five
          national-programme stations on the Nag and the Pili (codes 5979 to
          5983), but CPCB&apos;s river tables up to 2024 carry none of them,
          and neither list has a station on the Pora.
        </p>
        <p className={P}>
          Around the city, MPCB samples the Kanhan, the Kolar and the Wainganga
          every month at five national-programme stations: 480 monthly readings
          from January 2017 to December 2024, with the 17 months it recorded as
          dry and the 3 as stagnant water kept as such. The highest BOD at
          Agargaon, downstream of the city, was 9.8 mg/L in 2023 and 7.4 in
          2024, against 3.5 upstream at Sinora; the river there was dry every
          June from 2019 to 2024. For 2021 to 2024 MPCB&apos;s monthly figures
          reproduce CPCB&apos;s yearly lowest and highest values. CPCB&apos;s
          2025 polluted-stretch report puts all three rivers in Priority IV.
        </p>
        <Gap title="Shown with care">
          <p>
            NMC counts faecal bacteria in CFU per 100 ml, not the MPN unit of
            MPCB&apos;s readings; the panel labels each NMC reading in CFU. The
            station at Ambhora on the Wainganga is shown without a marker,
            because CPCB&apos;s list places it about 145 km south of the
            village and MPCB&apos;s about 53 km north-west.
          </p>
        </Gap>
        <Gap title="What is not measured in public, or not shown">
          <p>
            We have not found a live water-quality station on any of the six
            rivers, so the page shows months and years, not days. The
            treatment-plant panel other cities carry is off: NMC&apos;s report
            lists 13 sewage plants, 12 of them working with 403.5 MLD of
            capacity against an estimated 520 MLD of sewage (73% of supply),
            but we have not found
            monthly outlet readings for each plant.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="flood" title="Flood risk - rain on three city rivers">
        <p className={P}>
          <PageLink cityId={cityId} route="flood-risk">
            {cityName}&apos;s flood record
          </PageLink>{" "}
          is rain on the Nag, the Pili and the Pora, the rivers that carry the
          city&apos;s storm water. In the 24 hours to the morning of 23
          September 2023 the state&apos;s rain gauges recorded 166 mm at the
          Nagpur City circle (the Sitabardi circle carries the same daily
          figure); the district plan says the heavy rain fell between midnight
          and dawn. The Bombay High Court&apos;s order of 11 July 2024
          records the Collector&apos;s affidavit that four people died, and the
          district disaster plan records 349 people rescued. In November 2020
          Nagpur&apos;s Water Works Department had recorded that Ambazari&apos;s
          spillway was designed to pass 400 cubic metres a second but the road
          bridge below it 60. The heaviest day on IMD&apos;s record for its
          Nagpur observatory is 315.0 mm, on 12 June 1911.
        </p>
        <p className={P}>
          The page is a dated record, not a hazard map. The state&apos;s red
          and blue flood-line sheets exist for the Nag only over 3.55 km at
          the city&apos;s eastern edge, and for 5.3 km of the Pora, as scanned
          sheets; they are linked, not drawn. NMC&apos;s 2025-26 disaster plan
          names 77 places where water collects in heavy rain, but without
          locations.
        </p>
        <Gap title="What is not public yet, that we have found">
          <p>
            Flood lines for the Pili and for the Nag through the city centre; a
            map of the storm drains (the City Development Plan of 2015 records
            about 917 km, surveyed in 2008); the rainfall the drains are built
            for; a water-level gauge on the city&apos;s rivers; and IMD&apos;s
            own reading for 23 September 2023.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="water-bodies" title="Water bodies - from the State's 2017-18 survey">
        <p className={P}>
          <PageLink cityId={cityId} route="water-bodies">
            The water-bodies map
          </PageLink>{" "}
          draws 1,767 water bodies from the Maharashtra Remote Sensing
          Applications Centre&apos;s (MRSAC) survey at 1:10,000, mapped in
          2017-18: farm ponds, tanks, lakes, quarries, aquaculture ponds and
          reservoirs, out to the Pench reservoirs north of the city. 29 of them
          lie inside the city&apos;s wards. 56 are named in the survey; 9 more
          take their name from OpenStreetMap where an OpenStreetMap lake
          overlaps them. The survey&apos;s area field holds square kilometres
          under a hectare label, so areas are converted.
        </p>
        <Gap title="Dated, and official first">
          <p>
            The survey describes 2017-18: ponds dug since are not in it, and
            ponds filled since are shown as they were then. 111 OpenStreetMap water polygons in
            the same area match nothing in the survey; they are left off rather than mixed in. NMC
            counts 11 lakes but publishes no register of their areas that we
            have found.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="lake-restoration" title="Lake restoration - sanctions, reports and a court docket">
        <p className={P}>
          <PageLink cityId={cityId} route="lake-restoration">
            The lake-restoration page
          </PageLink>{" "}
          sets eight of the city&apos;s lakes (Futala, Ambazari, Gorewada,
          Gandhisagar, Sonegaon, Sakkardara, Naik and Lendi) beside the work on
          them and 10 court and tribunal orders. History comes from the
          Imperial Gazetteer (1908), the 1966 District Gazetteer and the
          Supreme Court&apos;s 2025 judgment on Futala, which records it as
          also known as Telangkhedi tank; dam figures from the Central Water
          Commission&apos;s register; current work from NMC&apos;s reports and
          budgets, the State&apos;s resolutions and the AMRUT 2.0 portal.
        </p>
        <p className={P}>
          Where two documents disagree on the same lake, both are shown: Naik
          lake was sanctioned at Rs 12.95 crore in 2022 and is listed at
          Rs 15.95 crore on the portal.
        </p>
        <Gap title="No register of lost lakes">
          <p>
            We have not found a public register of the lakes {cityName} has
            lost, so the page carries the lakes that exist and the work on
            them, not a count of those that are gone.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="my-ward" title="My Ward - 38 wards on the 2025 map">
        <p className={P}>
          <PageLink cityId={cityId} route="my-ward">
            My Ward
          </PageLink>{" "}
          covers the 38 wards of the final ward notification of 4 October 2025
          (37 with four councillors, one with three, 151 in all). The outlines
          are MRSAC&apos;s ward map; the populations are the ones the
          notification prints, 2,447,494 across the city, and it does not name
          the census year they come from. A ward is shown with an NMC zone
          only where one zone holds at least 90% of its area (20 of the 38
          wards); the other 18 cross zone lines and show none.
        </p>
        <Gap title="Four ward edges to confirm">
          <p>
            MRSAC&apos;s ward populations follow the August 2025 draft, with
            some typing slips and a different 23/26 split. The final
            notification moved part of the lines between wards 6 and 7, 7 and
            9, and 8 and 19, and MRSAC&apos;s line between wards 23 and 26
            differs from both the draft and the final, so those edges may not
            follow the final line. The legal map is kept at the NMC office.
          </p>
        </Gap>
        <p className={P}>
          Each ward shows what can honestly be placed in it: its groundwater
          unit (37 wards sit in Nagpur (Urban), one in Nagpur (Rural)), the
          nearest telemetry well within 5 km (15 wards have one), the nearest
          river sampling point (for every ward, one of NMC&apos;s 2023 points),
          and the water bodies inside it (29 across the city).
        </p>
        <Gap title="Five sections read 'not available', each for a stated reason">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Lost lakes:</strong>{" "}no public register of the city&apos;s
              lost lakes has been found.
            </li>
            <li>
              <strong>Flooding:</strong>{" "}NMC&apos;s disaster plan names the
              places where water collects, without locations.
            </li>
            <li>
              <strong>Drainage:</strong> we have not found the storm-drain
              network published as a map.
            </li>
            <li>
              <strong>Sewerage:</strong> NMC locates its sewage plants, but we
              have not found a map of the sewer network.
            </li>
            <li>
              <strong>Industry:</strong>{" "}MPCB&apos;s river plans name the power
              stations and industries along the Kanhan and the Kolar, without
              locations.
            </li>
          </ul>
        </Gap>
      </SubSection>

      <SubSection id="commitments" title="Commitments - each promise on its own document">
        <p className={P}>
          <PageLink cityId={cityId} route="commitments">
            The commitments page
          </PageLink>{" "}
          tracks 22 promises about {cityName}&apos;s water, each on a dated
          Government Resolution, a court or tribunal order, an NMC budget or
          report, the AMRUT 2.0 portal or a funder&apos;s document. 4 are
          delivered and 1 is on track. One has a date moved by NMC that has
          not yet come; three are past their date with no delivery on record,
          one of them after NMC moved it. 1 is recorded as stalled. For 12
          the promise can be cited but not yet its current status. A status changes only against a dated document, and each row
          not yet delivered carries the date it is next checked.
        </p>
        <p className={P}>
          Five of the resolutions did not open at the State&apos;s resolutions
          portal on 15 October 2026. Their text was read from the orgpedia
          archive copy, and each of those rows links the copy beside the
          official address.
        </p>
      </SubSection>

      <SubSection id="facts" title="Facts and rainfall">
        <p className={P}>
          <PageLink cityId={cityId} route="facts">
            The facts page
          </PageLink>{" "}
          is a set of 22 cards, each read from the data behind the page it
          summarises rather than typed in a second time. One is a gap: the
          supply from each source, which we have not found published after
          NMC&apos;s draft 2017-18 report.
        </p>
        <p className={P}>
          Rainfall comes from IMD&apos;s 0.25-degree gridded record, 1970 to
          2025, at the grid cell at 21.0 N, 79.0 E, the one nearest IMD&apos;s
          Nagpur observatory. We checked the choice: the observatory&apos;s
          normal is 1,151.2 mm a year (1991-2020), and this cell gives 1,148.8
          mm over the same years. Its 1970-2020 average is 1,126.4 mm. Months
          after IMD&apos;s last published month are filled from
          Open-Meteo&apos;s reanalysis and marked provisional until IMD catches
          up.
        </p>
      </SubSection>

      <SubSection id="origins" title="Origins - a small stream, and a river from Madhya Pradesh">
        <p className={P}>
          <PageLink cityId={cityId} route="origins">
            The origins page
          </PageLink>{" "}
          tells the city&apos;s water history in six chapters: the small stream
          called the Nag; the Bhonsle tanks, from a British officer&apos;s plan
          of 1819; the gravity waterworks of 1873 and the drains that followed;
          Gorewada in 1911 and then the Kanhan; the Pench, shared with Madhya
          Pradesh, from 1982; and what the old tanks became. Its sources are the
          Imperial Gazetteer (1908), the District Gazetteers of 1966 and 1979,
          the Central Water Commission&apos;s dam register, NMC&apos;s reports
          and the state water regulator&apos;s order. Where those sources give
          different dates for the same event, the page says so.
        </p>
      </SubSection>

      <SubSection id="not-here" title="What is not here, and why">
        <p className={P}>
          Each absence below is a decision, and each has a stated reason.
        </p>
        <Gap title="No tanker page">
          <p>
            NMC publishes how many tankers it runs (37 in its 2026-27 budget,
            published May 2026),
            but we have not found a delivery register, booking ledger or price
            survey, which a tanker page would need.
          </p>
        </Gap>
        <Gap title="No shoreline or climate-risk page">
          <p>
            {cityName} is near the centre of the country and has no coastline.
            A climate-risk page is possible and planned: the global basin data
            it rests on covers the Kanhan and the Wainganga.
          </p>
        </Gap>
        <Gap title="English only, for now">
          <p>The pages are in English; Marathi is planned.</p>
        </Gap>
      </SubSection>
    </>
  );
}
