"use client";

/**
 * Jaipur-specific "What each page shows" subsections.
 *
 * English-only for now; Hindi follows in the i18n pass. Jaipur departs from
 * the baseline in three ways this page has to explain: the state's PHED, not
 * the corporation, supplies the water, three quarters of it from a dam the
 * city shares, so there is no days-left figure; the city has its own
 * groundwater unit and it is the most over-drawn in the district; and the
 * city's own river has no published readings on its channel.
 *
 * Every figure is read from a shipped artifact (public/data/*jaipur*.json,
 * public/geojson/jaipur-*.geojson), from src/cities/jaipur/{config,rivers,
 * flood,my-ward}.ts, or from a registry note (scripts/source-registry/
 * jaipur.json and the shared ids its artifacts cite); none is typed from
 * memory. Other cities are never named here: the surface sweep reads them as
 * leaks.
 */

import Link from "next/link";
import { SubSection, Gap, type CityPagesProps } from "@/components/about/primitives";

const PHED_APR_2025_26 =
  "https://phedwater.rajasthan.gov.in/content/dam/doitassets/water/Public-Health-Engineering-Department/Pdf2026/PHED%20ALL%20page.pdf";
const WRD_STORAGE = "https://water.rajasthan.gov.in/wr/#/";

export function JaipurPageDescriptions({ cityId, cityName }: CityPagesProps) {
  const P = "text-slate-600 dark:text-slate-400";
  const A = "text-blue-600 dark:text-blue-400 hover:underline";
  return (
    <>
      <SubSection id="supply" title="Dashboard - a city that drinks a dam 120 km away">
        <p className={P}>
          <strong>77% of {cityName}&apos;s piped water comes from one dam.</strong>{" "}
          The state&apos;s Public Health Engineering Department (PHED), not the
          municipal corporation, supplies the city. Its{" "}
          <a href={PHED_APR_2025_26} target="_blank" rel="noopener noreferrer" className={A}>
            Annual Progress Report 2025-26
          </a>{" "}
          (status 31 December 2025, printed p.85, in Hindi) puts the city&apos;s
          production at <strong>766.73 MLD</strong>: 590 MLD from Bisalpur dam on
          the Banas, about 120 km away, and 176 MLD from 3,633 PHED tube wells. A
          year earlier Bisalpur gave 492.08 MLD and the tube wells about the same
          176, so the whole rise of about 98 MLD came from the dam.
        </p>
        <p className={P}>
          That is why the{" "}
          <Link href={`/${cityId}`} className={A}>
            dashboard
          </Link>{" "}
          opens on the supply chain rather than a reservoir countdown: from the
          dam, through the Surajpura treatment plant and the Balawala pumping
          station at the city&apos;s edge, to PHED&apos;s 590,385 water
          connections. PHED&apos;s zone schedule of 15 April 2024 gives most
          colonies about an hour of water a day. At the 2025 summer peak, on 24
          June, PHED ran 230 tankers a day making 1,283 trips in the city; the
          dashboard carries that peak.
        </p>
        <Gap title="What is not published: the city's share, its losses and its plant capacity">
          <p>
            <strong>No allocation order.</strong> Bisalpur also supplies Ajmer,
            Tonk and the villages along both pipelines, and irrigates the land
            below it. A Water Resources Department study of February 2020,
            published by the World Bank, describes 11.1 TMC (thousand million
            cubic feet) a year for Jaipur and the villages on its pipeline, 5.1
            TMC for Ajmer and about 8 TMC for irrigation. That is a description,
            not an order, and no order fixing Jaipur&apos;s share has been found.
          </p>
          <p>
            <strong>No city-wide loss figure.</strong> The last published figure
            for water lost between source and tap is 37% in 2015, on PHED&apos;s
            figures in JICA&apos;s evaluation of the Bisalpur project, which
            warned it was likely unreliable because a 2014-15 study had found 45
            to 81% of consumer meters out of order in four zones. In January
            2025 PHED gave 44.2% in Bajaj Nagar and 27% in Chitrakoot, two of its
            round-the-clock trial areas, against a target of 20%; its January
            2026 report gives no current figure. So the dashboard carries no
            non-revenue water figure for the city.
          </p>
          <p>
            <strong>No treatment-capacity figure.</strong> PHED&apos;s project
            list names a 200 MLD plant at Surajpura, but that is one stage, and
            no primary source we have found gives the capacity of the whole
            works. So the dashboard shows what PHED produces, not what its plants
            can treat.
          </p>
        </Gap>
        <Gap title="Figures shown exactly as PHED printed them">
          <p>
            PHED&apos;s reports are printed in Hindi in an old typeface that does
            not copy as text, so every figure was read from the page images. The
            tube-well count and output are the same in the 2024-25 and 2025-26
            reports; they are shown as printed. Private borewells appear in no
            PHED figure.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="reservoirs" title="Reservoir cards - and why there is no days-of-water-left number">
        <p className={P}>
          The dashboard carries two dams: Bisalpur, the city&apos;s main source,
          and Ramgarh, its old one.{" "}
          <strong>Bisalpur is not the city&apos;s own storage.</strong> Its water
          is shared by Jaipur, Ajmer, Tonk and irrigation, and no order says how
          much of it is Jaipur&apos;s. Dividing the dam by the city&apos;s draw
          would credit {cityName} with water that belongs to other towns and to
          farmers, so no days-left figure is computed and Bisalpur&apos;s card is
          labelled shared.
        </p>
        <p className={P}>
          The readings come from the Rajasthan Water Resources Department&apos;s{" "}
          <a href={WRD_STORAGE} target="_blank" rel="noopener noreferrer" className={A}>
            dam storage report
          </a>
          , which covers all 693 of the state&apos;s dams. It is published daily
          from mid-June to mid-October and on the 1st and 16th of other months,
          often weeks late. A row is accepted only if its printed percentage
          equals its storage over the dam&apos;s designed capacity, so a misread
          column fails instead of writing a wrong number; a figure the
          department&apos;s neighbouring reports contradict is held back, not
          corrected. Storage reports go back to May 2025 and the
          department&apos;s monsoon rainfall bulletins carry the same table back
          to 16 June 2023, so the history runs from there. Earlier weekly points
          for Bisalpur come from the Central Water Commission&apos;s bulletin.
        </p>
        <p className={P}>
          On 8 October 2026, the latest report, Bisalpur stood at 313.90 m and
          held 781.41 million cubic metres, <strong>71.31%</strong> of what it
          was built to hold. On the same date a year earlier it was full.
        </p>
        <Gap title="Two percentages that are never joined">
          <p>
            The state&apos;s report gives gross storage, all the water behind the
            dam, as a share of its designed capacity; it publishes no usable
            (live) storage. The Central Water Commission&apos;s weekly bulletin
            gives live storage, which leaves out the water below the lowest
            outlet, against a different capacity (1.076 billion cubic metres for
            Bisalpur). The two measure different things: CWC put Bisalpur at
            59.39% on 8 May 2025, and the state&apos;s report at 57.87% on 16 May
            2025. The cards show only the state&apos;s percentage, and CWC&apos;s
            weekly rows keep their volume with the percentage left blank.
          </p>
        </Gap>
        <Gap title="Ramgarh, empty in two very different years">
          <p>
            The department reported Ramgarh at zero on 8 October 2026, and at
            zero on the same date in 2025, when the state&apos;s dams as a whole
            were 90.38% full (61.80% in 2026). It reported the dam empty on every
            date read, June 2023 to October 2026. Ramgarh was a source of the
            city&apos;s drinking water from 1978, as the Supreme Court recorded in
            2017; its card stays on the dashboard so the absence can be seen. The
            report&apos;s 19.82 m for Ramgarh is a gauge reading, not a full-tank
            level, so the card shows none.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="groundwater" title="Groundwater - the city has its own unit, and it is the most over-drawn">
        <p className={P}>
          <Link href={`/${cityId}/groundwater`} className={A}>
            The groundwater map
          </Link>{" "}
          shows Jaipur district&apos;s 16 assessment units in the national
          groundwater assessment (IN-GRES), five editions from 2021-2022 to
          2025-2026, drawn on IN-GRES&apos;s own unit boundaries. The measure is
          the stage of extraction: how much of the groundwater that refills each
          year is pumped out.
        </p>
        <p className={P}>
          In 2021-2022 IN-GRES carved a <strong>Jaipur Urban</strong> unit out of
          the Sanganer, Amber and Jhotwara blocks, and about 96% of the
          city&apos;s outline lies inside it. In 2025-2026 it stands at{" "}
          <strong>349.88%, over-exploited</strong>: the city draws about three
          and a half times what can be taken each year without depleting the
          aquifer, the highest of the district&apos;s units. All 16 units are
          over-exploited, and the district as IN-GRES assesses it reads 210.41%.
          About four fifths of the city unit&apos;s draw is domestic and none is
          irrigation; across the district about 72% is irrigation. Rajasthan&apos;s
          printed 2025 report carries the 2024-2025 edition, 328.41% for Jaipur
          Urban; the map leads with the newer edition.
        </p>
        <Gap title="Read the category, not a trend">
          <p>
            Several inputs are carried forward from one edition to the next, so
            the change between editions is not a measurement. Industrial use in
            Jaipur Urban is entered as 244.81 hectare-metres in four editions and
            826.39 in 2025-2026, which accounts for most of that edition&apos;s
            rise. Recharge is credited from rainfall only, and the unit&apos;s
            rainfall is copied from Jhotwara Rural&apos;s. The page quotes the
            category and the latest stage, and does not draw the series as a
            trend. IN-GRES also still draws the district as it was before 2023,
            so the district total includes Kotputli, Viratnagar, Paota and Dudu.
          </p>
        </Gap>
        <p className={P}>
          The dots on the map are <strong>148 telemetry wells</strong>: 108 run
          by the Rajasthan Ground Water Department and 40 by the Central Ground
          Water Board, read every six hours on the National Water Data Portal and
          shown as monthly means from January 2021. 16 of them stand in the
          Jaipur Urban unit. Each well is placed by its coordinates, not by the
          district it is tagged to, because the tags follow the district&apos;s
          lines before 2023. PHED&apos;s own draw is the 176 MLD from its 3,633
          tube wells; private borewells appear in no published figure.
        </p>
        <Gap title="Why there is no ward-by-ward depth map">
          <p>
            Shallow and deep piezometers stand side by side: the Board&apos;s
            Durgapura well reads about 8 m below ground and its Mansarovar well
            about 42 m. A depth surface drawn across the city would average
            different aquifers into one number, so the page shows the wells
            themselves. (That Durgapura well is not the 100 m Durgapura
            piezometer in the Board&apos;s yearbooks, a different well of the
            same name.)
          </p>
          <p>
            The readings need care. The state&apos;s series uses 999.0 as a
            placeholder, and zeros and sign flips occur; months with no reading
            that passes the checks are left blank, never set to zero. About 70
            state wells report only from 27 July to 3 September 2026. Jaisingpur
            Khor&apos;s record rises from about 56 m below ground in mid-2024 to
            under 15 m, a rise the portal does not explain, so read its latest
            depth with care.
          </p>
        </Gap>
        <p className={P}>
          <strong>The rules that apply here.</strong> Groundwater in Rajasthan
          is still regulated by the Central Ground Water Authority: the 2023
          amendment to its guidelines (S.O. 1509(E), 29 March 2023) lists
          Rajasthan among the states it regulates. Because every unit in the
          district is over-exploited, its guidelines (S.O. 3289(E), 24 September
          2020) give no permission to draw groundwater for a new industry other
          than a micro, small or medium enterprise, and none for a new packaged
          drinking-water plant; water tankers need a permission and pay Rs 35 a
          cubic metre. Under the Jaipur Development Authority&apos;s Building
          Regulations 2025 (regulation 8.3), every plot of 225 square metres or
          more must have a rainwater harvesting structure. Rajasthan&apos;s own
          Ground Water (Conservation and Management) Authority Act was passed
          in September 2025 and published in the Gazette on 8 October 2025; it
          takes effect only on a date the state notifies, and no such
          notification had been found by 20 October 2026.
        </p>
      </SubSection>

      <SubSection id="rivers" title="Rivers - clean at the source, no readings on the city's own river">
        <p className={P}>
          <Link href={`/${cityId}/rivers`} className={A}>
            The rivers page
          </Link>{" "}
          draws four rivers: the Dravyavati through the city, the Dhund it flows
          into, and the Banas and the Banganga at the city&apos;s two dams,
          Bisalpur and Ramgarh. The water quality is the Central Pollution
          Control Board&apos;s (CPCB) annual readings, 2018 to 2024, each
          year&apos;s lowest and highest value as CPCB printed it; nothing is
          averaged or filled in.
        </p>
        <p className={P}>
          The finding is a contrast. At Bisalpur (station 2951), where the
          city&apos;s water comes from, the highest BOD (a measure of organic
          load) was <strong>1.6 mg/L in 2024</strong>, and within CPCB&apos;s
          bathing criterion of 3 mg/L in five of the seven years. At Newta dam
          (station 2952), which takes water diverted from the Dravyavati through
          a channel from Gular dam, the highest BOD was above 3 mg/L in every
          year from 2018 to 2024, and <strong>36.5 mg/L in 2024</strong>. Kanota
          dam on the Dhund (station 4781) has one year of readings, 2021: BOD 2.0
          to 5.2 mg/L.
        </p>
        <p className={P}>
          The Dravyavati is the city&apos;s own river. The Jaipur Development
          Authority&apos;s (JDA) 2017 environmental report calls it &ldquo;the
          active river of Jaipur which, over the time turned into a Nallah
          (Amanisha Nallah)&rdquo;. JDA&apos;s contract of 18 March 2016 was to
          design and build a 47.50 km corridor for Rs 1,470.85 crore, with Rs
          206.08 crore for ten years of upkeep, as the Rajasthan High Court
          recorded in its order of 19 December 2024. OpenStreetMap maps the river
          as the outline of its channel, not a centre line, so the length of the
          drawn line would be a perimeter; the page uses JDA&apos;s 47.50 km.
        </p>
        <Gap title="No readings on the Dravyavati's channel">
          <p>
            No agency publishes water-quality readings on the channel itself. The
            Newta dam series is shown under the Dravyavati and named as indirect:
            the Rajasthan State Pollution Control Board&apos;s (RSPCB) 2018 action
            plan says the dam &ldquo;is fed from Dravyavati River through a
            diversion channel&rdquo;, so the readings show the water the river
            sends there, not the channel. The treatment-plant panel is off: RSPCB
            publishes monthly sample counts rather than results, and CPCB&apos;s
            2024 table of drains and sewage plants has no Rajasthan rows.
          </p>
        </Gap>
        <Gap title="One station shown without its location">
          <p>
            CPCB&apos;s station list (October 2020) places station 2952 at
            26.919491 N, 75.930328 E, which is Kanota dam on the Dhund, 0.37 km
            from station 4781, while RSPCB&apos;s 2018 plan maps Nevta dam
            south-west of the city. Where the samples are taken is not settled,
            so the readings are shown and the map marker is not. Jal Mahal
            (station 2944) is a lake, not on a river this page draws, and is left
            out.
          </p>
        </Gap>
        <Gap title="Three polluted-stretch editions, three different names">
          <p>
            CPCB has listed this stretch in each of its three polluted-stretch
            editions, under other names: the Banas &lsquo;along Bisalpur Dam,
            Swaroopganj, Newta Dam&rsquo;, Priority III (2018); the Banas
            &lsquo;Bassi to Bisalpur&rsquo;, Priority I (November 2022), on 35.7
            mg/L, the same figure as Newta dam&apos;s highest in 2019, when
            Bisalpur&apos;s highest was 1.7; and the &lsquo;Vishwamitri near Newta
            Dam&rsquo;, Priority II (2025). The 2025 report pairs Newta dam&apos;s
            16 mg/L with a reading at Khalipur village that the same report lists
            under Gujarat; Newta dam&apos;s own figure falls in CPCB&apos;s
            Priority III band. All three are shown with their dates. CPCB&apos;s
            website policy requires its approval for any use beyond download and
            print, so its reports are cited here, not copied.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="flood" title="Flood risk - rain on the city, not a river in spate">
        <p className={P}>
          <Link href={`/${cityId}/flood-risk`} className={A}>
            The flood-risk page
          </Link>{" "}
          is a written record, not a map. The district disaster management plan
          of 2025 says flooding in the district &ldquo;is of minor nature&rdquo;:
          low-lying parts of the city are waterlogged in the monsoon,
          &ldquo;largely due to inadequate drainage&rdquo;. It names 1981 and 2012
          as the years heavy rain flooded the city. The heaviest day on the India
          Meteorological Department&apos;s (IMD) record for Jaipur is{" "}
          <strong>326.0 mm on 19 July 1981</strong>, in a month of 956.9 mm,
          more than one and a half times a normal year (600.3 mm). Jaipur
          district&apos;s June to September rain was 986.6 mm in 2024 and 918.5
          mm in 2025, 88% and 75% above the normal of 524.3 mm.
        </p>
        <p className={P}>
          The page sets no trigger. The Central Water Commission has no gauge in
          the district (the nearest are at Tonk and the Bisalpur inflow, both on
          the Banas), the district plan sets no numeric threshold, and we have not
          found the rainfall the city&apos;s drains are designed for. IMD&apos;s
          &lsquo;very heavy&rsquo; band (115.6 to 204.4 mm in a day) is quoted
          only as context on the 2012 entry. The Dravyavati project&apos;s stated
          aim, in JDA&apos;s 2017 report, is to pass a hundred-year flood; the
          High Court&apos;s order of 19 December 2024 records that no channel was
          built in the submergence areas of three dams along it, at Sikar, Gular
          and Ramchandrapura. Damage figures appear only where an official
          document gives them, and none does for the city.
        </p>
        <Gap title="What is not public yet">
          <p>
            The list of waterlogging spots: the plan says the city&apos;s
            low-lying pockets &lsquo;have been identified&rsquo; and that pumps are
            placed there by the first week of June, but it does not list them. A
            flood map of the city, modelled or drawn from past events. The
            rainfall the drains are built for. A water-level gauge on the
            Dravyavati or the Dhund. And damage figures for the city: the relief
            department counts rain deaths for Rajasthan as a whole (133 in the
            2024 monsoon, 193 in 2025), not by district.
          </p>
          <p>
            IMD&apos;s two figures for 1981 as a whole disagree (1,403.9 mm in its
            1991-2020 tables, 1,180 mm in its &lsquo;Climate of Jaipur&rsquo;
            booklet), so the page uses only July 1981, on which both agree.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="water-bodies" title="Water bodies - from OpenStreetMap, because no city lake register is published">
        <p className={P}>
          <Link href={`/${cityId}/water-bodies`} className={A}>
            The water-bodies map
          </Link>{" "}
          draws <strong>36 lakes, ponds and reservoirs</strong> from
          OpenStreetMap, in a box wider than the corporation, because the
          city&apos;s main dams (Ramgarh, Kanota, Nevta and Chandlai) lie outside
          it. Rivers are drawn on the rivers page instead. We have not found a
          lake register or lake layer published by Nagar Nigam Jaipur or JDA, so
          the map rests on OpenStreetMap, whose shapes anyone can edit.
        </p>
        <Gap title="Three of the 36 are not lakes">
          <p>
            The download cannot tell them apart from lakes, so three shapes on the
            map are not water bodies in the usual sense: the &lsquo;Amanishah
            Nala&rsquo; polygon, a stretch of the Dravyavati&apos;s channel that
            is also drawn on the rivers page; a building-material pit; and a
            fountain. They are named here rather than removed by hand. Ramgarh is
            mapped at about 113 hectares, against the 1,035 hectares of reservoir
            area in the national dam register, so its shape shows where the dam
            is, not how far it spreads when full.
          </p>
        </Gap>
        <Gap title="The national census did not reach the city">
          <p>
            The Ministry of Jal Shakti&apos;s first Census of Water Bodies
            (reference year 2017-18) counts 82 water bodies in Jaipur district,
            all of them rural and almost all in Shahpura and Phulera tehsils; it
            recorded no urban water body in the district, and Amer is the only
            tehsil near the city it reached. The second census (reference year
            2023-24) counts 14,400 in Rajasthan, 1,081 of them urban, but its
            district tables were not on the Ministry&apos;s table page on 20
            October 2026.
          </p>
        </Gap>
        <p className={P}>
          The ward search, the ranking and the lost-lake list are off: there is
          no digital ward map to search by, and no official register to rank or
          to count losses from. The ground-height bands and the catchment and
          cascade view have not been built for {cityName} yet.
        </p>
      </SubSection>

      <SubSection id="lake-restoration" title="Lake restoration - mostly a court record">
        <p className={P}>
          <Link href={`/${cityId}/lake-restoration`} className={A}>
            The lake-restoration page
          </Link>{" "}
          carries eight water bodies: Mansagar (Jal Mahal), Ramgarh, Kanota,
          Nevta, Chandlai, Talkatora, Maota and Kukas. Each is graded V where it
          is checked against a primary document and N where it rests on a single
          source. Storage figures are the Water Resources Department&apos;s of 8
          October 2026: the 27 dams it gauges in the district held 16.3% of their
          designed capacity that day, against 61.80% for the state, and eleven
          held nothing.
        </p>
        <p className={P}>
          Seven programmes and seven court and tribunal orders sit beside them,
          from the High Court&apos;s 2004 directions on Ramgarh&apos;s catchment
          to its orders of July and August 2026. Mansagar was restored by JDA
          under the National Lake Conservation Plan (Rs 24.72 crore, approved in
          2002) and its shore leased for a tourism project, a lease the Supreme
          Court cut to 30 years in 2014. On 28 February 2025 the Court recorded a
          forest officer&apos;s report that the lake &ldquo;has been completely
          damaged&rdquo; and directed a study by NEERI. Ramgarh&apos;s catchment
          has been before the Rajasthan High Court since 2011; on 13 August 2026
          the Court ordered the District Collector&apos;s list of encroachers
          published in two newspapers. A Rajya Sabha answer counts 405 renovations of traditional
          water bodies in Jaipur district between 22 March 2025 and 12 March
          2026, without naming the scheme or the water bodies.
        </p>
        <p className={P}>
          Where a figure rests on a party&apos;s submission rather than a
          court&apos;s finding, the text says so. Orders are read from the
          court-signed copies that LiveLaw and Verdictum publish, and cited by
          court, case number and date, because the courts&apos; own case search
          sits behind a search form.
        </p>
        <Gap title="Which Chandlai?">
          <p>
            The department&apos;s report has two rows named Chandlai, one in
            Jaipur district (2.04 million cubic metres designed) and one in Tonk
            district (4.53). Which of them is the 122-hectare Chandlai lake
            OpenStreetMap maps south of the city is not settled. The Jaipur
            row&apos;s storage never leaves 1.99 to 2.04 million cubic metres in
            the reports read, so it reads full or nearly full in every season;
            the card shows it as printed.
          </p>
        </Gap>
        <Gap title="Held back, and why">
          <p>
            Sagar and Galta are not shown: no official record of their present
            state was found. For Kukas the national dam register gives 43.75
            million cubic metres gross but 4.375 million effective, which cannot
            both be right, so neither is published; the card uses the
            department&apos;s 1.926. We have not found a public register of the
            lakes {cityName} has lost, so the page carries the lakes that exist
            and the work on them, not a count of those that are gone.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="my-ward" title="My Ward - a ward table, because there is no digital ward map">
        <p className={P}>
          <Link href={`/${cityId}/my-ward`} className={A}>
            My Ward
          </Link>{" "}
          covers Nagar Nigam Jaipur&apos;s <strong>150 wards</strong>, set by the
          state&apos;s ward notification of 16 September 2025 (Rajasthan Gazette,
          20 September 2025) after the Greater and Heritage corporations were
          merged back into one. Each ward shows its zone (13 in all), its
          assembly seat (10) and its population as the notification gives it:
          3,197,135 across the city, between 13,499 and 32,272 a ward. The
          notification does not say which census the figures come from. Zone
          office lines and emails come from the corporation&apos;s
          administrative directory and are shown for the 8 zones that list them.
        </p>
        <p className={P}>
          For water, the page points to PHED: its Jaipur district control room,
          its City Circle North and South offices, and Rajasthan Sampark (181),
          the state&apos;s grievance line, because the corporation&apos;s Jaipur
          Samadhan portal has no water category. Jaipur Samadhan and the
          corporation&apos;s call centre are listed for civic complaints, and
          1077 for floods. No councillor names or parties are shown, and no
          officer&apos;s mobile number.
        </p>
        <Gap title="Why there is no map, and nothing placed ward by ward">
          <p>
            The official 2025 ward map is a picture without coordinates, and no
            digital boundary file has been published. The ward files in
            circulation are older: one covers only the former Greater
            corporation&apos;s wards, another is a 2019 proposal. Without
            boundaries, lakes, flooding, drains, wells and river stations cannot
            be placed in a ward, so My Ward links to the city-wide pages for them.
            No published map says which PHED circle serves which ward, so both
            circle offices are listed.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="commitments" title="Commitments - twenty-one dated promises">
        <p className={P}>
          <Link href={`/${cityId}/commitments`} className={A}>
            The commitments page
          </Link>{" "}
          tracks 21 promises about {cityName}&apos;s water supply, new sources,
          sewers and drains, the Dravyavati and Ramgarh, each on a dated
          document: PHED&apos;s annual progress reports, the State&apos;s budget
          speeches, the Ministry of Housing and Urban Affairs&apos; AMRUT 2.0
          progress report, a National Water Development Agency note, or a court
          order. <strong>Four are delivered</strong>: two later than the date
          PHED or JDA had set, one ahead of it, and one that never had a
          published date. <strong>Four are past their date</strong> with no
          completion on record: Stage II Phase I of the Bisalpur-Jaipur project
          (due 31 March 2025, then 31 March 2026), the second stage of the
          Prithviraj Nagar works (due 12 August 2025, then March 2026), the
          Jagatpura, Pratap Nagar and Mahal Road works (due March 2025), and
          round-the-clock supply in five trial areas. For the last, the date is
          our reading of &lsquo;in the next two months&rsquo; in PHED&apos;s
          January 2025 report, and the page says so.
        </p>
        <p className={P}>
          For the other thirteen the promise can be cited but its current status
          cannot yet be cited either way. Most are budget announcements with no
          date, among them Stage II Phase II of the Bisalpur-Jaipur project for
          Jaipur and Ajmer (Rs 1,986.68 crore), the Brahmani-Bisalpur link (an
          estimated Rs 6,100 crore) and the Ram Jal Setu link, in none of which is
          Jaipur&apos;s own share stated. The AMRUT 2.0 report still names the
          two former corporations, and its rows keep those names. A status
          changes only against a dated document; the register is re-checked each
          January against PHED&apos;s report, each February against the budget,
          monthly against the AMRUT 2.0 report, and after the High Court&apos;s
          hearings on Ramgarh and the Dravyavati.
        </p>
      </SubSection>

      <SubSection id="facts" title="Facts and rainfall">
        <p className={P}>
          <Link href={`/${cityId}/facts`} className={A}>
            The facts page
          </Link>{" "}
          is 16 cards, each read from the data behind the page it summarises or
          from the document it cites, and four of them lead the dashboard. One
          card is a gap: how much sewage the city makes, for which no city figure
          has been found. Another gives the last published figure for water lost
          in the pipes, from 2015.
        </p>
        <p className={P}>
          Rainfall comes from IMD&apos;s 0.25-degree gridded record, 1970 to
          2025, at the grid cell at 26.75 N, 75.75 E. We checked the choice. The
          cell contains IMD&apos;s Jaipur (Sanganer) observatory, station 42348,
          whose 1991-2020 normal is 600.3 mm a year; the cell gives 591.9 mm over
          the same years, 1.4% lower, while the cell to the north, which covers
          more of the city, gives 612.7 mm, 2.1% higher. Its 1970-2020 average
          is 611.2 mm, 68% of it in July and August. Months after IMD&apos;s last
          published month (December 2025) are filled from Open-Meteo&apos;s
          reanalysis and marked provisional until IMD catches up.
        </p>
        <Gap title="The provisional months read low this year">
          <p>
            From 1 June to 8 October 2026 Open-Meteo gave 383.4 mm at this cell,
            against 527.9 mm at IMD&apos;s airport gauge as the Water Resources
            Department&apos;s rainfall report prints it, about 27% less. The fill
            is kept because it is the method every city on the platform uses, and
            IMD&apos;s own figures replace it when they are published.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="origins" title="Origins - from wells inside the walls to a dam 120 km away">
        <p className={P}>
          <Link href={`/${cityId}/origins`} className={A}>
            The origins page
          </Link>{" "}
          tells the city&apos;s water history in eight chapters: Amer, the hill
          capital before the city, and its lakes; the planned city of the 1720s and its wells, of which,
          in 1880, only 49 of the 827 inside the walls held pure water, by T. H.
          Hendley&apos;s account of 1895; the steam pumps on the Amanishah from
          1874 and pipes from December 1875; Ramgarh, built for fields and later
          the city&apos;s reservoir; the lake that stopped filling; water from the
          Banas; Mansagar and the Dravyavati; and the dam far away and the
          aquifer below today.
        </p>
        <p className={P}>
          It is as careful about what it leaves out. There is no single founding
          year, because the Imperial Gazetteer gives 1728 and later accounts
          1727; no year for the Mansagar dam or Jal Mahal; no single completion
          year for Ramgarh (1901 in the national dam register, 1903 in the
          Supreme Court&apos;s judgment); and no date for Bisalpur water first
          reaching the city, because none was found. Every image carries its
          licence, checked at source.
        </p>
      </SubSection>

      <SubSection id="not-here" title="What is not here, and why">
        <p className={P}>
          Each absence below is a decision with a reason, recorded in the
          repository so that an omission is never mistaken for a bug.
        </p>
        <Gap title="No allocation ledger">
          <p>
            The ledger compares what a city is entitled to with what it receives,
            and no public order states Jaipur&apos;s share of Bisalpur dam. The
            Water Resources Department&apos;s 2020 study describes 11.1 TMC a year
            for Jaipur and the villages on its pipeline, but a description is not
            an allocation order. PHED&apos;s draw by source is on the dashboard
            instead.
          </p>
        </Gap>
        <Gap title="No tanker page">
          <p>
            PHED publishes summer tanker totals for the city (230 tankers making
            1,283 trips a day at the June 2025 peak) but no register by area,
            month or price. The totals are on the dashboard.
          </p>
        </Gap>
        <Gap title="No shoreline or climate-risk page">
          <p>
            {cityName} is landlocked, so there is no coastline. The climate-risk
            page is not built: the state&apos;s only climate plan (2014) gives
            state-wide projections, and the sub-basin risk surface the page needs
            has not been run for the Banas or the Banganga.
          </p>
        </Gap>
      </SubSection>
    </>
  );
}
