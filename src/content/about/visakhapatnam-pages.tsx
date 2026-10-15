"use client";

/**
 * Visakhapatnam-specific "What each page shows" subsections, one per route in
 * the city's config (the About route is this page), plus what is not shown.
 *
 * English-only for now; Telugu follows in the i18n pass. The city departs from
 * the Chennai baseline in ways this page has to explain: it has no large
 * perennial river of its own and draws its largest source, the Godavari and
 * Yeleru system, through a canal it shares with industry, so there is no
 * days-left figure; CPCB's tables list no river-type station in the city; and
 * we have not found ward geometry that can be published.
 *
 * Every figure is read from a shipped artifact (public/data, public/geojson)
 * or a registry note (scripts/source-registry/visakhapatnam.json). The "not
 * shown" reasons follow scripts/lib/exemptions.ts (visakhapatnam:*).
 */

import Link from "next/link";
import { SubSection, Gap, type CityPagesProps } from "@/components/about/primitives";

export function VisakhapatnamPageDescriptions({ cityId, cityName }: CityPagesProps) {
  const P = "text-slate-600 dark:text-slate-400";
  const A = "text-blue-600 dark:text-blue-400 hover:underline";
  const to = (route: string, label: string) => (
    <Link href={`/${cityId}${route ? `/${route}` : ""}`} className={A}>
      {label}
    </Link>
  );
  return (
    <>
      <SubSection id="page-dashboard" title="Dashboard - where the water comes from">
        <p className={P}>
          {cityName}{" "}
          has no large perennial river of its own. Its largest source is the Godavari and Yeleru
          system, which CGWB lists at 190 km from the city; that is CGWB&apos;s distance to the source, not the
          length of the water&apos;s journey. The water reaches the city through the Yeleru canal, a conveyance
          first built for the steel plant, about 150 km long in the draft Green City Action Plan. Two lifts bring
          Godavari water into the system: VIWSCO&apos;s Kateru pump house, through a 56 km pipeline to the Yeleru
          canal (since December 2004), and the Purushottapatnam lift, through the Polavaram Left Main Canal into
          Yeleru reservoir (since July 2018). That is why {to("", "the dashboard")} opens on the supply chain
          rather than on days of water left.
        </p>
        <p className={P}>
          About 380 MLD is available from nine sources, 182 to 204 MLD of it from the Godavari and Yeleru
          (GVMC&apos;s figures; CGWB&apos;s tables carry the same quantities unchanged since its June 2022 report).
          That report said GVMC was able to draw 345.5 MLD of the 380, because of shortages at Raiwada and the
          Gosthani. We have not found a figure that splits the system&apos;s share between the two rivers. The
          next largest source, Raiwada, gives 72.5 MLD. The newest present-supply figure we have found is 334.03
          MLD, in the Chief Secretary&apos;s report to the NGT Principal Bench in OA 606/2018 (10.07.2024,
          Annexure-VI, p33).
        </p>
        <Gap title="The canal is shared">
          <p>
            On 11 March 2021, the only day for which we have found GVMC&apos;s split, about 46 percent of the
            canal&apos;s tail-end water went to the city (41.641 million gallons) and 39 percent to the steel
            plant (35.640), with the rest to APIIC&apos;s industrial parks, NTPC, the port and rural water supply.
            The sheet prints no unit for the split; it is read as million gallons a day, like its other columns.
          </p>
        </Gap>
        <Gap title="What we have not found">
          <p>
            A measured non-revenue water figure for GVMC: the draft plan puts losses at nearly 30 percent on one
            page and 35 percent on another, without saying how either was measured, so no losses figure is shown.
            A measured figure for the groundwater the city draws: GVMC&apos;s 2021 sheet lists 2.75 million gallons
            a day from bores as a set figure, the draft plan says 30 percent of the city&apos;s needs, and
            CGWB&apos;s 2025 plan 17.37 percent of supply.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-reservoirs" title="Reservoirs - daily from the state, none of them the city's alone">
        <p className={P}>
          The reservoir cards carry the four dams in APWRIMS, the Water Resources Department&apos;s portal:
          Yeleru, Raiwada, Thatipudi and Meghadrigedda. APWRIMS publishes level and storage for each every
          morning through a public interface with no login, with a daily archive from 2012 for Yeleru, so the
          history can be read back rather than starting on the day we began collecting. Storage is shown as live
          storage: the published gross storage less the design dead storage below the lowest outlet. Up to 15
          September 2026 the portal&apos;s figures for Meghadrigedda were already live storage, reaching the design
          live capacity of about 1.04 TMC at full level, so they are used as published.
        </p>
        <p className={P}>
          None of them is the city&apos;s alone. Yeleru also feeds irrigation and the steel plant; Raiwada
          (completed 1981-82) and Thatipudi (1968) are irrigation dams with a city share; Meghadrigedda is a dam
          the Water Resources Department operates and maintains. GVMC&apos;s own Mudasarlova reservoir, the
          town&apos;s first water works (handed over in May 1903), and the Gambhiramgedda reservoir, which GVMC
          draws on from March to June, are not in the feed, so their cards carry no reading. Dividing the stored
          water by the city&apos;s demand would count water that belongs to farms and industry and leave out the
          water the lifts bring, so no days-left runway is computed.
        </p>
        <Gap title="Readings are checked on every run">
          <p>
            Each dam&apos;s design values (full reservoir level, gross and dead storage) are checked against the
            portal&apos;s own attributes on every run, and the reader stops if they change. Each reading is dated by
            its own timestamp, and days whose level or storage does not pass a basic check, including days whose
            storage does not fit their level, are left out. Yeleru reads zero
            in dry spells, when its water is below the lowest outlet.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-allocations" title="Allocations - one canal, many claimants">
        <p className={P}>
          {to("allocations", "The allocations page")}{" "}
          sets out each documented claim on the city&apos;s raw water
          that we have found, with the instrument that sets it and the one dated record of what was delivered:
          the city&apos;s share of the Polavaram Left Main Canal, GVMC&apos;s allocations from the Yeleru and from
          the Godavari at Kateru, its share of each reservoir, and the claims of the steel plant, NTPC,
          APIIC&apos;s industrial parks, Gangavaram Port and the HPCL refinery.
        </p>
        <p className={P}>
          Most delivered figures come from one day, 11 March 2021, the only day for which we have found
          GVMC&apos;s split. The recycled water delivered to HPCL&apos;s refinery, 25 MLD, is from the state&apos;s
          February 2026 affidavit in NGT Principal Bench OA 606/2018. Three official figures for the city&apos;s
          Polavaram share are shown side by side: 23.44 TMC a year (Polavaram Project Authority), 24 TMC (a 2004
          order cited in GVMC&apos;s 2019 assessment for the Asian Development Bank, which we have not found) and
          12 TMC (CGWB 2025). The page also lists four claims still to come. Polavaram Left Main Canal water for
          the city and industry, where CAG reported 76.05% physical progress on the canal works in March 2023, the
          latest official figure we have found. The AM/NS steel plant at Anakapalli, whose 2026 environmental
          clearance says about 104 MLD will be obtained from the same canal, subject to permission; we have not
          found a Water Resources Department allocation. APIIC&apos;s data-centre park at Madhurawada, whose 2024 clearance allows up to
          1.43 MLD of fresh water, to come from GVMC; we have not found an allotment order. And three data-centre
          campuses whose clearances list 0.69 MLD of fresh water.
        </p>
        <Gap title="Orders cited but not found">
          <p>
            The 2004 order for 24 TMC; the VIWSCO concession agreement and the steel plant&apos;s bulk water supply
            agreement; an order setting priority between the city and industry on the Yeleru canal in a dry year;
            an overall entitlement for APIIC&apos;s parks; and a plant-level entitlement for NTPC&apos;s Simhadri
            plant. Where a row has no entitlement we have found, its note says so.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-commitments" title="Commitments - mostly about sewage">
        <p className={P}>
          {to("commitments", "The commitments register")}{" "}
          tracks 18 dated promises about the city&apos;s water
          and sewage, from GVMC&apos;s and the state&apos;s own notes, affidavits and progress reports to the
          National Green Tribunal and the High Court&apos;s committee, two AP High Court orders (12 November 2025
          and 11 March 2026) and MoHUA&apos;s AMRUT 2.0 lists. Eleven of them are about sewers and sewage
          treatment: how much of the city is connected (60 percent of people, by the state&apos;s February 2026
          affidavit), how much is treated, and when the rest will be.
        </p>
        <p className={P}>
          Seven are past their latest stated date without a dated record of completion that we have found; four
          have had their dates moved by the institution itself; for seven we can cite the promise but not yet its
          current status. A status changes only against a dated document, and history is kept, never
          overwritten. APPCB&apos;s reports and the draft Green City Action Plan are cited only for dated status
          and context: a draft is not a promise. Press reports are not used.
        </p>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater - by mandal, with one mandal to watch">
        <p className={P}>
          {to("groundwater", "The groundwater map")}{" "}
          colours the eleven mandals of Visakhapatnam district by the
          national assessment (IN-GRES), in three editions from 2023-2024 to 2025-2026. The measure is the stage
          of extraction: how much of the groundwater that can be drawn each year is drawn. In 2024-2025, the
          edition CGWB printed in its December 2025 report, Visakhapatnam Rural mandal drew 95.06 percent and was
          the district&apos;s only critical unit, while the district as a whole stood at 43.85 percent, which
          IN-GRES classes safe.
        </p>
        <p className={P}>
          The map colours the 2025-2026 edition, newer than CGWB&apos;s December 2025 report. In it Gajuwaka reads
          89.39 percent (semi-critical) and Visakhapatnam Rural 47.87 percent (safe). Both moves come from revised
          inputs, not measured change: Visakhapatnam Rural gains a new recharge entry from surface irrigation
          that nearly doubles its extractable resource, and Gajuwaka&apos;s estimated industrial draw rises from
          5.4 to 97.0 hectare-metres. Every mandal&apos;s rainfall in that edition repeats its 2024-2025 figure.
          In the seven urban mandals, 94 percent of the groundwater drawn in 2024-2025 went to homes; in
          Anandapuram, Padmanabham and Pendurthi more than 95 percent is irrigation.
        </p>
        <Gap title="Why the series starts at 2023-2024">
          <p>
            Andhra Pradesh divided the district in April 2022 and IN-GRES kept one district id across the change.
            Until 2022-2023 the whole city was assessed as one 513.8 km2 GVMC unit, which became seven urban
            mandals in 2023-24. A series joined across those redraws would show jumps that are boundary changes,
            so no trend is drawn across either.
          </p>
        </Gap>
        <p className={P}>
          The dots are wells inside the eleven mandals: automatic recorders on the state&apos;s APWRIMS portal,
          read every day and shown as monthly means, and AP Ground Water Department wells read by hand once a
          month, the oldest from 2002, from the National Water Data Portal. Where a recorder and a hand-read well
          stand at the same site, they are kept as separate series. Each well is named by the state mandal its
          coordinates fall in, not by the district it is tagged to.
        </p>
        <Gap title="Why there is no ward-by-ward depth map">
          <p>
            The wells are too few across eleven mandals for a depth surface, and we have not found ward geometry
            that can be published. IN-GRES does not carry depth to water at all; its figures are a balance of
            recharge and draw.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers - a gedda, a river and a canal">
        <p className={P}>
          CPCB&apos;s 2019-2024 tables list no river-type station in {cityName}. {to("rivers", "The rivers page")}{" "}
          shows three channels as OpenStreetMap maps them, the Meghadri Gedda, the Gosthani and the Yeleru canal,
          with the readings CPCB takes at the reservoirs, the Naval Dockyard creek and the canal on them.
          OpenStreetMap names other geddas in the city that are not drawn.
        </p>
        <p className={P}>
          There are four stations: the Meghadrigedda reservoir and a tidal creek at the Sardar Vallabhai Patel
          bridge by the Naval Dockyard, close to where the Meghadri Gedda reaches the port&apos;s inner harbour;
          Thatipudi reservoir on the Gosthani, upstream in Vizianagaram district; and the Yeleru canal near Pharma
          City at Parawada. At the dockyard creek CPCB&apos;s 2024 samples recorded dissolved oxygen as low as 2.4
          mg/L, after 1.0 mg/L in 2023, below the 4.0 mg/L CPCB prints as its criterion for bathing-class coastal
          water. CPCB&apos;s stations named &lsquo;Gostani&rsquo; are on a different river, in West Godavari
          district, and are not used.
        </p>
        <p className={P}>
          Each channel also carries dated events from official records: GVMC stopping releases from the
          Meghadrigedda reservoir after the LG Polymers styrene release in May 2020, and the two sets of
          reservoir samples that followed; APPCB&apos;s 2021 reports to the NGT on the Meghadrigedda and Thatipudi
          reservoirs; a joint committee&apos;s 2023 list of industrial discharges into the Meghadrigedda surplus
          course; and APPCB&apos;s record of the Yeleru canal as the pharma city&apos;s water source. Two industrial
          points are mapped: the marine outfall point recommended for the steel plant, and the JN Pharma City
          common effluent treatment plant, whose treated effluent goes to the sea through a marine outfall, not
          into the canal.
        </p>
        <Gap title="Quoted but not mapped">
          <p>
            APPCB samples sewage channels and geddas where they meet the sea every month, but we have not found
            published coordinates for those stations, so their figures are quoted in the notes and never placed on
            the map. We have not found a published coordinate for the Atchutapuram effluent treatment plant either.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk - cyclones over a hilly city">
        <p className={P}>
          {cityName}{" "}
          floods from the sky and the sea, not from a large river. {to("flood-risk", "The flood-risk page")}{" "}
          carries a dated record of the cyclones, depressions and heavy rain that hit the city, each event
          credited to its own source: IMD&apos;s after-event reports for the storms (Hudhud in 2014, the deep
          depression of October 2020, Gulab in 2021, Michaung in 2023 and Montha in 2025), with the 24-hour
          rainfall at IMD&apos;s Visakhapatnam stations, and the Government of Andhra Pradesh&apos;s flood
          memorandum for the six days of rain from 29 August 2024 (129 mm across the district). The heaviest day
          in the list is Gulab&apos;s: 28 cm in the 24 hours to 8:30 am on 27 September 2021. When Hudhud crossed
          the coast over the city, the surge at the city&apos;s tide gauge was 1.4 m above the predicted tide.
        </p>
        <p className={P}>
          We have not found a published release threshold for the Meghadrigedda reservoir, inside the city, or a
          GVMC drainage design standard, so the page has no release threshold or rainfall trigger. It draws the
          three channels
          as a sketch of how the city drains, not an engineering map, and lists the official channels to follow
          during an event, among them the Meghadrigedda reservoir&apos;s daily level on APWRIMS.
        </p>
        <Gap title="What we have not found">
          <p>
            A GVMC flood map, return-period zones, a current list of waterlogging spots, a drainage master plan,
            GVMC drain network data or a gedda register, and city-only damage figures for Gulab, Michaung or
            Montha. A state GIS layer maps the drains of 2019 without names or capacities; the page mentions it and
            does not draw it. GVMC&apos;s older lists of
            inundation-prone areas use ward numbers no longer in use, so they are not used. The only modelled flood
            maps we have found that cover the city are regional, drawn at region scale, and do not show street
            waterlogging.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-shoreline" title="Shoreline - measured from satellite">
        <p className={P}>
          {to("shoreline", "The shoreline page")}{" "}
          measures change from Appikonda to Pedda Nagamayyapalem, just
          north of Bheemunipatnam, from Landsat and Sentinel-2 images in ten epochs from 1990 to 2026, every 100 m
          along the coast. The bar at the top counts reliable transects only: 147 of the 421 are retreating, 244
          are stable and 30 are advancing. Most of the city&apos;s coast is holding steady; the beaches from
          Mangamaripeta to Pedda Nagamayyapalem are eroding.
        </p>
        <p className={P}>
          Our rates are set beside the official record: NCCR&apos;s national shoreline assessment, and the
          Ministry of Earth Sciences&apos; 2024 reply to the Lok Sabha that draws on it, which classes four
          stretches here as Low Erosion (Yarada, RK Beach, &lsquo;Mangamari Peta to Bheemili&rsquo; and &lsquo;Bheemunipatnam
          to Pedanagamayyapalem&rsquo;). Its list does not name Lawson&apos;s Bay or Rushikonda. RK Beach is a managed beach: the port moves sand from south of its harbour onto it (sand
          bypassing, in the coastal erosion guidelines NIO prepared for CWC in 2020), and a sand-trap dredging
          for beach nourishment was inaugurated in February 2023. So a steady line or a gain there is partly the added sand, not only
          natural change; 30 of its 37 reliable transects read stable.
        </p>
        <Gap title="Low-confidence transects">
          <p>
            55 transects are drawn as low confidence and left out of the counts, each with its reason: they sit on
            the Gangavaram port&apos;s built shore, cross a breakwater, sit at the Dolphin&apos;s Nose headland or
            beside river and stream mouths, show large jumps in their measured waterline, or, for seven of them,
            have recent positions that scatter or jump. The two port basins are not measured. No tidal correction
            is applied; the spring tide range here is 1.43 m.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies - from OpenStreetMap, as we have not found a lake register">
        <p className={P}>
          {to("water-bodies", "The water-bodies map")}{" "}
          draws 1,088 ponds, tanks, lakes and reservoirs from
          OpenStreetMap, 212 of them named, in a box covering GVMC and about 5 km around it, as retrieved on 14
          October 2026. It is not an official register: we have not found a gazetted lake register for the city.
          Drains and wastewater polygons are left out.
        </p>
        <p className={P}>
          Five water bodies carry sourced histories: GVMC&apos;s Mudasarlova reservoir, the Meghadrigedda and
          Gambheeram reservoirs, the Kanithi balancing reservoir at the tail of the Yeleru canal, and Kondakarla
          Ava, a natural freshwater lake south-west of the city. Thatipudi and Raiwada are left out of that set:
          they are irrigation dams 56 to 60 km away that the dashboard tracks as supply sources, not city lakes.
        </p>
        <p className={P}>
          A ground-height layer shows FABDEM&apos;s bare-earth elevation in seven bands, from 0-2 m to 100 m and
          above. FABDEM stores the sea as 0 m, so the sea is removed rather than drawn as the lowest band, and as we
          have not found published GVMC boundary geometry, the bands cover land just outside the city too.
        </p>
        <Gap title="No list of lost tanks, and no catchment view yet">
          <p>
            No list of lost tanks is shown: we have not found a published official one. The lake catchment view
            has not been built for {cityName} yet.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-lake-restoration" title="Lake restoration - the AMRUT 2.0 tanks">
        <p className={P}>
          {to("lake-restoration", "The lake-restoration page")}{" "}
          carries the city&apos;s dated, budgeted lake work:
          the water-body component of AMRUT 2.0, 11 GVMC tanks worth Rs 23.31 crore. MoHUA&apos;s status list of 5
          March 2026 marks 10 completed and one, Thungalam, being implemented, with completion scheduled for
          September 2026. MoHUA&apos;s live list, checked on 14 October 2026, has no Thungalam row. In its place is
          a Rs 1.27 crore &lsquo;Thimmaraju Tank&rsquo; project, which appears to be the same project under a new
          name; MoHUA&apos;s live list has no project IDs and does not say so. The live list also shows a 12th
          project, Rajupalem tank in GVMC&apos;s Anakapalli division (Rs 2.00 crore, at DPR stage), which is not in
          the 5 March list and is not counted.
        </p>
        <p className={P}>
          Beside the programme, the page shows the five water bodies with sourced histories, with conflicting
          figures side by side. Proposals without a sanction, such as the ponds and sponge parks in the draft Green
          City Action Plan, are left out: a draft is not a programme.
        </p>
        <Gap title="No court orders yet">
          <p>
            We have not found a court or tribunal order about a Visakhapatnam lake or tank to the page&apos;s
            standard: court, case number, date, and the order or a primary report of it. The NGT&apos;s public
            judgment search offers only a date range and a captcha, so this is a gap in what could be searched,
            not a finding that no case exists.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="page-facts" title="Facts and rainfall">
        <p className={P}>
          {to("facts", "The facts page")}{" "}
          is a set of quotable cards, each with its source and date, built from the
          same data files as the pages they summarise rather than typed in a second time. Some cards are gaps or
          cautions: that CPCB samples the city&apos;s channels at reservoirs, a creek and a canal but at no
          river-type station, and that the water-bodies map is not an official register. One card reports a
          peer-reviewed study and says it is research, not official monitoring.
        </p>
        <p className={P}>
          Rainfall comes from IMD&apos;s 0.25-degree gridded record, 1970 to 2025, at the cell 17.75 N, 83.25 E,
          inside GVMC and the grid point nearest the city centre. Three cells nearer the coast are sea and have
          no value in any year from 1991 to 2025, so picking one would write zeros. We checked the choice: over 1991-2020 this cell gives 1,053.4 mm a year,
          against 1,054.5 mm at IMD&apos;s Visakhapatnam airport observatory and 1,113.1 mm at its other
          Visakhapatnam observatory. Its 1970-2020 average is about 1,043 mm. Months after IMD&apos;s last
          published month are filled from Open-Meteo&apos;s reanalysis and marked provisional until IMD catches up.
        </p>
      </SubSection>

      <SubSection id="page-origins" title="Origins - a harbour with no large river">
        <p className={P}>
          {to("origins", "The origins page")}{" "}
          is the long read, in eight chapters from the trading posts of the
          1600s to the data-centre clearances of 2026: the inner harbour dug at the mouth of the Meghadri Gedda
          between 1927 and 1933, the first piped water from a dammed hill stream (handed over in May 1903, in the
          reservoir known today as Mudasarlova), the wartime Gosthani and Meghadrigedda works, the reservoirs
          planned for farms and the steel plant from which the city&apos;s share was carved, the Godavari lifts,
          Cyclone Hudhud in 2014, and what the ground and the sea are saying now.
        </p>
        <p className={P}>
          It sets different official readings side by side rather than forcing them into one number, and it lists
          what we looked for and did not find in an official record, such as a count of the days the city went
          without piped water after Hudhud.
        </p>
      </SubSection>

      <SubSection id="page-not-shown" title="What is not shown, and why">
        <p className={P}>
          Each absence below is a decision with a reason, recorded in the repository so that an omission is never
          mistaken for a bug.
        </p>
        <Gap title="No ward pages">
          <p>
            We have not found ward geometry that can be published. The 98-ward boundaries in circulation are an
            Esri India tracing of a GVMC CAD drawing. We have not found a licence anywhere in the chain, and their
            zone field disagrees with GVMC&apos;s own ward list for 94 of 98 wards. The 98 wards are also
            superseded: GVMC notified 120 wards in 2026, and we have not found a published map of them. This
            closes when GVMC publishes official ward boundaries.
          </p>
        </Gap>
        <Gap title="No tanker page">
          <p>
            The only tanker figures from GVMC that we have found are for a single day: 615 trips on 11 March 2021,
            in an NGT filing. GVMC runs a Dial-a-Tanker booking line, but we have not found a series by day, zone
            or ward. One day is not a tanker record.
          </p>
        </Gap>
        <Gap title="No climate-risk page">
          <p>
            Buildable but not built. The sub-basin risk layer comes from HydroBASINS, which covers the north Andhra
            coast, so this is a backlog item rather than a refusal.
          </p>
        </Gap>
        <Gap title="Not in Telugu yet">
          <p>
            The city&apos;s name is shown in Telugu, but the pages have not been translated. A native speaker has to
            translate them rather than a machine, so they stay in English until then.
          </p>
        </Gap>
      </SubSection>
    </>
  );
}
