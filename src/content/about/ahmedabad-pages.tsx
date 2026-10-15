"use client";

/**
 * Ahmedabad-specific "What each page shows" subsections.
 *
 * English-only for now; Gujarati follows in the i18n pass (the Surat posture).
 * Ahmedabad departs from the Chennai baseline in three ways this page has to
 * explain: it drinks a canal from a dam it does not own, so there is no
 * days-left figure; the district groundwater figure hides an over-exploited
 * city unit; and the Sabarmati is clean where it enters and without oxygen
 * where it leaves.
 *
 * Every figure is read from a shipped artifact or a registry note
 * (scripts/source-registry/ahmedabad.json); none is typed from memory.
 */

import Link from "next/link";
import { SubSection, Gap, type CityPagesProps } from "@/components/about/primitives";

export function AhmedabadPageDescriptions({ cityId, cityName }: CityPagesProps) {
  const P = "text-slate-600 dark:text-slate-400";
  const A = "text-blue-600 dark:text-blue-400 hover:underline";
  return (
    <>
      <SubSection id="supply" title="Dashboard - a city that drinks a canal">
        <p className={P}>
          <strong>84% of {cityName}&apos;s water comes down one canal.</strong>{" "}
          AMC&apos;s own source table, in its{" "}
          <a
            href="https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,2583"
            target="_blank"
            rel="noopener noreferrer"
            className={A}
          >
            Budget 2026-27
          </a>{" "}
          (pp.63-64, in Gujarati), puts <strong>1,550 of the 1,850 MLD</strong>{" "}
          it draws a day on three offtakes of the Narmada Main Canal, which
          carries water from Sardar Sarovar dam: 330 and 800 MLD at the
          canal&apos;s two head regulators for the Kotarpur plant, and 420 MLD
          on the Dholka branch for Jaspur. Another 200 MLD is Mahi water from
          Kadana dam, diverted at the Wanakbori weir into the Mahi canal and its
          Shedhi branch, and treated at Raska. The last 100 MLD comes from
          AMC&apos;s 555 borewells.
        </p>
        <p className={P}>
          That is why the{" "}
          <Link href={`/${cityId}`} className={A}>
            dashboard
          </Link>{" "}
          opens on a supply chain carried from far away rather than a
          reservoir countdown. The Sabarmati, the river the city was founded
          on, is not in AMC&apos;s source table at all, and the full river you
          see through the riverfront is held by the Vasna barrage and topped up
          from the same Narmada canal. Three treatment plants carry the city:
          Kotarpur (1,150 MLD), Jaspur (400) and Raska (200), 1,750 MLD in all,
          treating 1,700 MLD a day.
        </p>
        <p className={P}>
          AMC&apos;s Water Project web page still shows an older table (2,100
          and 1,535 MLD) that has not changed since early 2022. The dashboard
          reads the budget instead, because it is the corporation&apos;s only
          current statement of where its water comes from.
        </p>
        <Gap title="What AMC does not publish: measured losses and an entitlement">
          <p>
            <strong>No measured loss figure.</strong>{" "}AMC&apos;s 2023-24 budget
            says connections are unmetered and the tap runs two hours a day,
            from 6 to 8 in the morning. Its 2024-25 and 2025-26 budgets promise
            a 5% cut in losses without stating what the losses are. So the
            dashboard carries no non-revenue water figure; we would rather show
            the gap than a guess.
          </p>
          <p>
            <strong>No entitlement.</strong> Gujarat sanctions raw water to
            cities each year with a 25% band either side, under a 2007
            resolution and its 2008 clarification. The quantity sanctioned for
            Ahmedabad is not in any public document we have found, which is
            also why this city has no allocation ledger.
          </p>
        </Gap>
        <Gap title="Figures shown exactly as AMC printed them">
          <p>
            The same budget gives the city&apos;s population as about 90 lakh
            on p.63 and 80 lakh on p.9, so the dashboard divides nothing by
            population. Its supply table gives 1,850 MLD drawn at the sources
            and 1,700 MLD treated, which are two different measures, and counts
            555 borewells whose own sub-totals add up to 560. Each figure is
            shown as AMC printed it, not corrected to make the sums agree.
          </p>
        </Gap>
        <Gap title="Why the sewage balance card is off">
          <p>
            Other cities&apos; dashboards compare sewage generated with sewage
            treated. For Ahmedabad both numbers are worked out rather than
            measured. AMC&apos;s budget and the state&apos;s affidavit to the
            National Green Tribunal give generation as 80% of the water
            supplied (in the state&apos;s words, &ldquo;Calculated as per 80% of
            Water Supply&rdquo;) and set the treated figure equal to it, so the
            gap between them is zero by method.
          </p>
          <p>
            Measured figures point elsewhere. A 2022 outfall survey that the
            Gujarat Pollution Control Board (GPCB) filed with the Tribunal
            measured <strong>284.18 MLD</strong> of sewage bypassing a single
            pumping station near the Vasana-Narol bridge. A card showing a zero
            gap would present an assumption as a measurement, so it stays off
            until a measured generation figure is published.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="reservoirs" title="Reservoirs - and why there is no days-of-water-left number">
        <p className={P}>
          The dashboard carries three dams: Sardar Sarovar on the Narmada,
          Kadana on the Mahi and Dharoi on the Sabarmati.{" "}
          <strong>None of them is the city&apos;s own storage.</strong>{" "}Sardar
          Sarovar is a four-state project and Kadana an irrigation dam, and
          AMC&apos;s share of either is not published. Dharoi is the
          Sabarmati&apos;s own dam, upstream of the city, but the city has not
          received its releases since 1999.
          Dividing any of these reservoirs by the city&apos;s demand would credit{" "}
          {cityName} with water that belongs to farmers and to other states, so
          no days-left figure is computed.
        </p>
        <p className={P}>
          What the dams do have is a good public record. The state&apos;s
          Narmada, Water Resources, Water Supply and Kalpsar Department
          publishes a dam report every day: level, storage, inflow and releases
          for each dam, and the Narmada Main Canal&apos;s flow at its head
          regulator. Each day&apos;s report is kept exactly as issued, back to{" "}
          <strong>7 June 2019</strong>, so the history can be read back from that
          archive rather than starting the day we began collecting.
        </p>
        <p className={P}>
          Each report is read with a built-in check. A row is accepted only if
          its own sums hold: gross storage must equal live plus dead storage,
          and the printed percentage must match. A misread column then
          fails loudly instead of writing a wrong number. The cards show live
          storage, the water above the lowest outlet; the department&apos;s own
          headline percentage is gross storage, and both are kept.
        </p>
        <Gap title="Two official capacities for the same dam">
          <p>
            The Central Water Commission&apos;s weekly reservoir bulletin uses
            different live capacities from the state&apos;s (Kadana is 1.472
            BCM in CWC&apos;s, 1,191.7 MCM in the state&apos;s). The two are
            never mixed: every number on the cards is the state
            department&apos;s.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="groundwater" title="Groundwater - the district hides the city">
        <p className={P}>
          <Link href={`/${cityId}/groundwater`} className={A}>
            The groundwater map
          </Link>{" "}
          shows Ahmedabad district&apos;s ten talukas across five editions of
          the national groundwater assessment (IN-GRES, 2021-2022 to
          2025-2026), drawn on IN-GRES&apos;s own unit boundaries. The measure
          is the stage of extraction: how much of the groundwater that refills
          each year is pumped out. We go below the district because the
          district figure says the opposite of the finding.
        </p>
        <p className={P}>
          Ahmedabad district reads <strong>79.14%, semi critical</strong>, in
          2025-2026. Inside it, the <strong>Ahmedabad Urban</strong>{" "}unit,
          which holds the city&apos;s wards, is{" "}
          <strong>over exploited at 128.85%</strong>: it draws more each year
          than the assessment counts as extractable. The ring around it,
          Ahmedabad City and Daskroi, is over exploited at 143.16%, and 82% of
          that ring&apos;s draw is irrigation. Six safe talukas to the west and
          south pull the district average down.
        </p>
        <Gap title="The Urban unit's jump is a relabelling, not a measurement">
          <p>
            IN-GRES carved the Urban unit out of City and Daskroi in 2021-2022,
            so no earlier edition can be joined to it. Its extractable resource
            is 1,919.4 hectare-metres in each of the last three editions, but
            its extraction was filed entirely as industrial in the first two, as
            irrigation plus industrial in 2023-2024 (70.80%, semi critical), and
            with 1,606 hectare-metres of domestic use added from 2024-2025
            (127.18%, then 128.85%). We quote the category in the latest
            edition and do not draw the series as a trend.
          </p>
        </Gap>
        <Gap title="Two talukas cannot be assessed on extraction at all">
          <p>
            Dholera and Dhandhuka are categorised &lsquo;salinity&rsquo; in all
            five editions. CGWB does not assess saline aquifers on extraction,
            so they carry no percentage and are drawn grey rather than left off
            the map. Across the district, 74% of the assessed area is
            poor-quality groundwater. Volumes on the page leave the saline tract
            out, as CGWB publishes them; the portal&apos;s own total includes it
            and would more than double the district&apos;s extraction.
          </p>
        </Gap>
        <p className={P}>
          The dots on the map are <strong>139 telemetry wells</strong>: 101 run
          by Gujarat&apos;s Surface Water and Ground Water Department and 38 by
          the Central Ground Water Board, read every six hours on the National
          Water Data Portal and shown as monthly means. 24 of them stand in the
          Ahmedabad Urban unit. Each well is placed by its coordinates, not by
          the district it is tagged to, because the tags follow old boundaries:
          some wells tagged Ahmedabad stand in Botad, and wells tagged
          Surendranagar and Sabarkantha stand inside Ahmedabad&apos;s talukas.
        </p>
        <Gap title="Why there is no ward-by-ward depth map">
          <p>
            Shallow and deep piezometers stand side by side in the same
            neighbourhoods, and the portal does not say which aquifer each one
            reads. A depth surface drawn across the wards would average
            different aquifers into one number, so the page shows the wells
            themselves. The readings also need care: depth is recorded as
            negative below ground, some stations flip sign partway through their
            record, and -1.0 is used as a placeholder. Months with no reading
            that passes the quality checks are left blank, never set to zero.
          </p>
          <p>
            AMC&apos;s own draw is 100 MLD from its 555 borewells. Private
            borewells appear in no AMC figure.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="rivers" title="Rivers - clean where the Sabarmati enters, without oxygen where it leaves">
        <p className={P}>
          <Link href={`/${cityId}/rivers`} className={A}>
            The rivers page
          </Link>{" "}
          carries the Central Pollution Control Board&apos;s annual readings,
          2018 to 2024, at ten Sabarmati stations from Kheroj, where the river
          enters Gujarat, down to Vautha, and on the Khari at Lali village. Each
          year&apos;s lowest and highest value is shown as CPCB printed it;
          nothing is averaged or filled in.
        </p>
        <p className={P}>
          The finding is the change across the city. At Hansol bridge, where
          the river enters Ahmedabad, the highest BOD (a measure of organic
          load) each year was between <strong>1.2 and 5 mg/L</strong>. At V.N.
          Bridge, below the city&apos;s outfalls, it was between{" "}
          <strong>82 and 358 mg/L</strong>; CPCB&apos;s bathing-water criterion
          is 3 or less. In <strong>every year from 2019 to 2024</strong>,
          dissolved oxygen at V.N. Bridge fell to 0.3 mg/L, the lowest value CPCB
          reports, while at Hansol it never went below 4.2 mg/L in the same
          years. The river does not arrive polluted.
        </p>
        <p className={P}>
          CPCB&apos;s polluted-stretch reports have put the Sabarmati below the
          city in <strong>Priority I</strong>, its worst class, in all three
          editions (2018, 2022 and October 2025), and the Khari at Lali as well.
          Each edition draws the stretch differently and uses different years of
          data, so the class is the constant, not the peak numbers.
        </p>
        <p className={P}>
          The Narmada Main Canal and the Kharicut canal are drawn beside the
          rivers. One is where the city&apos;s water comes from; the other runs
          through the industrial east and drains to the Khari.
        </p>
        <Gap title="One station shown without its location">
          <p>
            CPCB&apos;s station list places Miroli, a village downstream of the
            city, 18.9 km north-north-east of the Miroli outfall that GPCB
            located by drone survey, which would put it inside the city. That
            cannot be right for a downstream village station, so its readings
            are shown and its map marker is not. Two other stations are left out because they repeat
            ones already shown.
          </p>
        </Gap>
        <Gap title="What is not measured in public, or not mapped">
          <p>
            We have not found a live water-quality station on the Sabarmati.
            Every reading on this page comes from CPCB&apos;s annual tables, the
            latest for 2024, so the page shows years, not days.
          </p>
          <p>
            GPCB publishes monthly compliance results for the common effluent
            treatment plants (CETPs) that serve the industrial estates, but with
            no plant coordinates, so the plants cannot be placed on the map or
            matched to a stretch of river.
          </p>
          <p>
            The treatment-plant panel other cities carry is off. GPCB&apos;s
            public record for AMC&apos;s sewage plants is 2023-24 averages for
            ten plants, three of them without a BOD figure, which a monthly
            per-plant chart cannot show honestly. Sampling of the outfalls along
            the Kharicut sits in National Green Tribunal filings rather than in
            any public series.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="flood" title="Flood risk - rain on the streets, and a river on a gauge">
        <p className={P}>
          <Link href={`/${cityId}/flood-risk`} className={A}>
            {cityName}&apos;s most recent flood
          </Link>{" "}
          came from rain on its streets, not from the river. On 23 July 2026
          AMC reported a city average of 163.24 mm of rain, and{" "}
          <strong>82 of the 148 places it already lists as waterlogging spots</strong>{" "}
          went under water. Over the same days the Sabarmati at Subhash Bridge
          stayed more than 2.5 m below the Central Water Commission&apos;s
          warning level.
        </p>
        <p className={P}>
          That warning level is the page&apos;s trigger. CWC reads the river at
          Subhash Bridge every hour, against a warning level of 44.09 m and a
          danger level of 45.34 m; the highest reading on record is 47.45 m, on
          20 August 2006. We use CWC&apos;s gauge rather than the city disaster
          plan&apos;s ladder of river flows in cusecs, because the plan does not
          say where the flow is measured. The event record runs from the 1868
          rains and the 1875 flood, as the 1879 Bombay Gazetteer describes
          them, to July 2026, as the state&apos;s press releases quoting AMC
          report it. Damage figures appear only where an official document
          gives them.
        </p>
        <Gap title="What is not public yet">
          <p>
            AMC&apos;s list of the 148 waterlogging spots, a flood map of the
            city, a live page for its more than 40 rain gauges, the rainfall its
            storm drains are designed to carry, and a map of the drains
            themselves. AMC&apos;s 2026-27 budget counts 1,010 km of storm-water
            drains and 35 storm-water pumping stations; the state&apos;s July
            2026 releases count 42 pumping stations. Both are given with their
            dates. For the 1927, 1973 and 2006 river floods we have found the
            years, and for 2006 the river level, but no official count of homes
            or people affected.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="water-bodies" title="Water bodies - from OpenStreetMap, because no lake register is published">
        <p className={P}>
          <Link href={`/${cityId}/water-bodies`} className={A}>
            The water-bodies map
          </Link>{" "}
          draws 232 lakes, ponds, reservoirs and river polygons from
          OpenStreetMap, 52 of them named. The source is itself a finding: AMC
          counts <strong>176 lakes</strong> in its 2026-27 budget but publishes
          no lake register and no lake layer. Its City Map app serves lake
          points only through an encrypted interface, which we do not read.
        </p>
        <p className={P}>
          The search area is wider than the city limit, so lakes on the edge,
          Bopal, Ghuma and Ognaj among them, are not cut off at the boundary.
          Drains and wastewater channels are left out, because they carry water
          rather than hold it; the riverfront channel is kept, because it is the
          city&apos;s largest open water.
        </p>
        <Gap title="The national census also counts 176">
          <p>
            The Ministry of Jal Shakti&apos;s first Census of Water Bodies
            (reference year 2017-18) counts 1,964 water bodies in Ahmedabad
            district, 176 of them urban, and 19 encroached, all of them urban.
            Those 19 are most of Gujarat&apos;s 22. The census&apos;s 176
            matches AMC&apos;s count exactly, but neither source shows whether
            they are the same lakes.
          </p>
        </Gap>
        <p className={P}>
          There is no cascade view. The cascade layer reconstructs chained tank
          systems, where each tank&apos;s overflow was built to feed the next.
          The two lakes the historical record describes, Kankaria and Chandola,
          were filled by a stream turned at a dam near Kamod and, from 1881, by
          the Kharicut canal. AMC&apos;s current lake interlinking is storm-water
          storage, a different system from an inherited chain.
        </p>
      </SubSection>

      <SubSection id="lake-restoration" title="Lake restoration - a municipal programme with a court docket beside it">
        <p className={P}>
          <Link href={`/${cityId}/lake-restoration`} className={A}>
            The lake-restoration page
          </Link>{" "}
          sets AMC&apos;s lake programme, reported lake by lake in its budgets
          across the 176 lakes it counts, beside the court record. The legal
          frame is the Gujarat High Court&apos;s 2002 judgment in Shailesh R.
          Shah, which ordered water bodies to be notified in the Gazette, and
          its 2025 orders on Chandola Lake, where it held that &ldquo;Chandola
          Lake is a water body and on a water body, no construction can be
          permitted&rdquo;. The National Green Tribunal&apos;s Western Zone
          bench took up the city&apos;s vanished water bodies after a June 2025
          news report (OA 79/2025).
        </p>
        <p className={P}>
          Where AMC&apos;s budget and the AMRUT 2.0 portal give different
          figures for the same lakes, Bhadaj and Okaf among them, both are shown
          rather than one chosen. Each project carries the document it came
          from.
        </p>
        <Gap title="No register of lost lakes">
          <p>
            We have not found a public register of the lakes {cityName} has
            lost, so the page carries the lakes that exist and the work on them,
            not a count of those that are gone.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="my-ward" title="My Ward - on AMC's own ward map">
        <p className={P}>
          <Link href={`/${cityId}/my-ward`} className={A}>
            My Ward
          </Link>{" "}
          covers AMC&apos;s 48 wards in 7 zones, on the corporation&apos;s own
          boundaries. They come from its City Map app, the one linked from
          &lsquo;Know Your Ward&rsquo; on its website, which carries the ward
          layer inside the app; there is no download or map service for it. The
          boundaries match the State Election Commission&apos;s final
          delimitation of 3 October 2020, including Bopal, Ghuma and Kathwada,
          added to the city in June 2020.
        </p>
        <p className={P}>
          The ward file on OpenCity is not used, because it predates that 2020
          extension. Two of AMC&apos;s own attributes are also off (the hectare
          column holds square kilometres, and Navrangpura&apos;s area is copied
          from Jodhpur&apos;s), so areas are recomputed from the shapes. Each
          ward&apos;s population is its Census 2011 figure from the delimitation
          order: 5,664,062 across the city, between 1.05 and 1.30 lakh a ward.
          Ward 33 is Sarkhej in the order and Vejalpur in the national
          local-government directory.
        </p>
        <p className={P}>
          Each ward shows what can honestly be placed in it: its groundwater
          unit (all 48 sit in Ahmedabad Urban), the nearest telemetry well and
          its latest monthly depth, the nearest CPCB river station, and the
          OpenStreetMap water bodies inside it.
        </p>
        <Gap title="Five sections read 'not available', each for a stated reason">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Lost lakes:</strong>{" "}no public register of the city&apos;s
              lost lakes has been found.
            </li>
            <li>
              <strong>Flooding:</strong> AMC identifies 148 waterlogging spots
              but has not published the list or their locations.
            </li>
            <li>
              <strong>Drainage:</strong> AMC reports 1,010 km of storm-water
              drains but publishes no drain map.
            </li>
            <li>
              <strong>Sewerage:</strong> the sewage plants are named in the
              budget and in GPCB filings, but no plant or pumping-station
              locations are published.
            </li>
            <li>
              <strong>Industry:</strong> GPCB publishes no coordinates for the
              common effluent treatment plants or the units that discharge to
              the Sabarmati.
            </li>
          </ul>
        </Gap>
      </SubSection>

      <SubSection id="commitments" title="Commitments - ten dated promises">
        <p className={P}>
          <Link href={`/${cityId}/commitments`} className={A}>
            The commitments page
          </Link>{" "}
          tracks ten promises about {cityName}&apos;s water, from AMC&apos;s
          budgets, its affidavits to the Gujarat High Court, the state&apos;s
          2018 reuse policy and the Chief Minister&apos;s Office.{" "}
          <strong>Five have passed their dates</strong>{" "}with the work still
          described as under way: the Sola (30 MLD) and Jagatpur (15 MLD) sewage
          plants, due by September 2025; the Vinzol 75 MLD plant, due 15
          February 2026; the Kharicut canal rebuild, which AMC said in February
          2023 would take two years; the 2050 sewerage and storm-water master
          plan, due March 2023; and the state&apos;s target of reusing 70% of
          treated wastewater by 2025, against the 26% the state&apos;s own March
          2026 affidavit gives for Ahmedabad.
        </p>
        <p className={P}>
          The rest are still ahead or were never given a date. Where documents
          give different costs for the same work, all are shown: the 400 MLD
          Kotarpur plant has been Rs 118 crore (2023-24 budget), Rs 138 crore
          (MoHUA, March 2026) and Rs 230.42 crore (2026-27 budget). A status
          changes only against a dated document, and the register is re-checked
          each February against the new budget.
        </p>
      </SubSection>

      <SubSection id="facts" title="Facts and rainfall">
        <p className={P}>
          <Link href={`/${cityId}/facts`} className={A}>
            The facts page
          </Link>{" "}
          is a set of cards, each read from the data behind the page it
          summarises rather than typed in a second time. Two of the cards are
          gaps: how much water is lost in the pipes (not measured) and how much
          Narmada water the city is entitled to (not published).
        </p>
        <p className={P}>
          Rainfall comes from IMD&apos;s 0.25-degree gridded record, 1970 to
          2025, at the grid cell at 23.0 N, 72.5 E, inside the city. We checked
          the choice: IMD&apos;s own Ahmedabad observatory normal is 783.6 mm a
          year (1991-2020); this cell gives 800.4 mm over the same years, 2.1%
          higher, while the next cell east gives 868.3 mm, 10.8% higher. Its
          1970-2020 average is 805.1 mm, 68% of it in July and August. Months
          after IMD&apos;s last published month are filled from Open-Meteo&apos;s
          reanalysis and marked provisional until IMD catches up.
        </p>
      </SubSection>

      <SubSection id="origins" title="Origins - from a thin stream to a canal">
        <p className={P}>
          <Link href={`/${cityId}/origins`} className={A}>
            The origins page
          </Link>{" "}
          tells the city&apos;s water history from its founding beside the
          Sabarmati in early 1411: Kankaria&apos;s 34-sided tank, the stepwells,
          the rain cisterns (tankas) under the pol houses, the turn to
          groundwater (87% of AMC&apos;s supply in 1970-80, by AMC&apos;s own
          figures), Dharoi, Mahi water in 2000 and Narmada water from 2002, and
          the river now held between a barrage and a canal.
        </p>
        <p className={P}>
          It is as careful about what it leaves out. There is no founding day,
          because the three sources that date it disagree; no count of tankas,
          because published estimates run from about five thousand to ten
          thousand and nobody has counted them; and no single date for the first
          Narmada release, because August 2002 is AMC&apos;s date for its own
          works, not a date for the water.
        </p>
      </SubSection>

      <SubSection id="not-here" title="What is not here, and why">
        <p className={P}>
          Each absence below is a decision with a reason, recorded in the
          repository so that an omission is never mistaken for a bug.
        </p>
        <Gap title="No allocation ledger">
          <p>
            The ledger compares what a city is entitled to with what it
            receives, and no public order states AMC&apos;s base allocation from
            the Narmada or the Mahi. AMC&apos;s draw by source is on the
            dashboard instead.
          </p>
        </Gap>
        <Gap title="No tanker page">
          <p>
            AMC publishes no tanker delivery register, booking ledger or price
            survey. The tanker documents we found are AMC&apos;s own vehicle
            purchases, which say nothing about who receives water by tanker or
            at what price.
          </p>
        </Gap>
        <Gap title="No shoreline or climate-risk page">
          <p>
            {cityName} is about 100 km inland from the Gulf of Khambhat, so
            there is no coastline. The climate-risk surface is buildable, since
            the global basin data it rests on also covers the Sabarmati, but it
            has not been built yet.
          </p>
        </Gap>
      </SubSection>
    </>
  );
}
