/**
 * Jaipur water story. The tagline is originsTagline in config.ts. Composed from
 * the Hero / Lede / Chapter / Figure / PullQuote / ThenNow / CTA shortcodes,
 * following the Ahmedabad and Nagpur pattern.
 *
 * IMAGES: eight plates in /public/images/story/jaipur. Licences were read from
 * the Commons API (extmetadata and the file page wikitext) and from the
 * Internet Archive item metadata on 20-21 Oct 2026. MANIFEST.json next to them
 * records every plate shipped, its SHA-256, and the candidates checked and NOT
 * used, with the reason. The CC BY-SA photographs carry the photographer and
 * the licence in the Figure credit.
 *
 * SOURCE SPINE (claim ids in .onboarding-state/research/*):
 *   - Imperial Gazetteer of India, vol. XIII (1908), "Jaipur State" and
 *     "Jaipur City": Amber as capital (p.385), founding 1728 and the dry lake
 *     bed (pp.386, 400), Tal Katora (p.400), the 1874 waterworks, municipality
 *     1868, Ram Singh's gas and water-works (pp.387, 401) [orig-001, 020-022,
 *     036, 038, 039]
 *   - Imperial Gazetteer of India, vol. VI (1908), "Banganga" p.379: Ramgarh
 *     [orig-050 to 052]
 *   - T. H. Hendley, A Medico-topographical Account of Jeypore (1895), pp.3-4,
 *     read on the page images: storm water to Man Sagar, the 827 wells, the
 *     wells and the old channels, the 1840 dam, the 1874 pumps and 1875
 *     pipes, the priests' committee, Jacob's bund, 1892 consumption, seven
 *     wards, the Ganda Nallah [orig-014, 023-025, 030-035, 080, 081]
 *   - CWC National Register of Large Dams 2019: Ramgarh 1901, Bisalpur 1999
 *     [orig-053, orig-070]
 *   - Supreme Court, NIMS University v. State of Rajasthan (9 Nov 2017):
 *     Ramgarh 1903, catchment, irrigation to 1978, 1982 Asian Games, the 2003
 *     PIL, the 2011 suo motu case, the monitoring committee, the 2012 plan and
 *     2013 report, "still bone dry", costs and demolition [orig-054 to 066]
 *   - Rajasthan High Court, D.B. CWP 11153/2011, orders of 30 Jul and 13 Aug
 *     2026 (LiveLaw-hosted court PDFs) [hc-2026-07-30, hc-2026-08-13]
 *   - Supreme Court, Jal Mahal Resorts v. K.P. Sharma (25 Apr 2014): the
 *     developer's account of the Man Sagar dam, Jal Mahal "18th century",
 *     1962 sewage, 1975 hyacinth (petitioners), NLCP Rs 24.72 crore, the
 *     lease, 30 years, 8.65 and 14.15 acres [orig-010, 011, 085, 088, 089,
 *     sc2014-*]; Supreme Court order of 28 Feb 2025 (NEERI) [sc2025-damaged]
 *   - JICA ex-post evaluation, Bisalpur Jaipur Water Supply Project (2016) and
 *     ADB validation report PVR-254 (2013): 2003 baseline, 120 km, the loans,
 *     dates and the 2012 shares [orig-067, 071 to 077, sup-005, sup-020]
 *   - PHED Annual Progress Reports 2024-25 and 2025-26: city supply at 31 Dec
 *     2024 and 31 Dec 2025, tankers June 2025, zone schedule 2024 [sup-010 to
 *     019, sup-050, sup-070]; WRD Feb 2020 draft study (World Bank) on the
 *     Bisalpur shares [sup-032]
 *   - WRD daily dam report, 8 Oct 2026: Ramgarh, Bisalpur, state total
 *     [wrd-ramgarh, sup-030]
 *   - JDA EIA/EMP ch.2 (2017) and Rajasthan High Court order of 19 Dec 2024
 *     (JDA v. TPL-SUCG): the Dravyavati [rv-01 to 03, dv-02, 04, 05, 08, 10,
 *     12, 14]
 *   - CGWB: IN-GRES 2025-26 and GWRA 2025 for Jaipur Urban and the district,
 *     NWDP Durgapura piezometer, NAQUIM 2.0 inception report (2023)
 *     [gw-ingres-04, 06, gw-dist-02, gw-lvl-01, rv-09]
 *   - IMD 1991-2020 normals, Jaipur 42348 [fl-11]
 *
 * WHAT THIS STORY DOES NOT SAY, and why:
 *   - No single founding year. The Gazetteer gives 1728, later accounts 1727;
 *     the World Heritage file that might settle it could not be reached.
 *   - No year for the Man Sagar dam or Jal Mahal. The dam's builder rests on a
 *     party's account recorded by the Supreme Court; Jal Mahal is "18th
 *     century" in the court's own words, and other accounts disagree.
 *   - Nothing on Jaigarh's tanks, Maota's water-lifting or the Galta springs:
 *     no primary or scholarly source was found.
 *   - No single completion year for Ramgarh (1901 CWC, 1903 Supreme Court),
 *     no year the city began drawing from it before 1978, and no anicut count.
 *   - No date for Bisalpur water first reaching Jaipur: none was found.
 *   - The Darbhawati (the stream the Man Sagar dam is said to block) is not
 *     equated with the Dravyavati; the sources do not join them.
 *   - The 1892 and 1904 consumption figures are not compared; the drop between
 *     them is unexplained in both sources.
 *
 * English-only; Hindi follows in the i18n pass.
 */

import { StoryPage } from "@/components/story/story-page";
import {
  Hero,
  Lede,
  Chapter,
  Figure,
  PullQuote,
  CTA,
  ThenNow,
} from "@/components/story/story-shortcodes";
import config from "./config";

export function JaipurStoryEn() {
  return (
    <StoryPage
      cityId="jaipur"
      cityDisplayName="Jaipur"
      tagline={config.originsTagline}
      lastRevised="October 2026"
    >
      <Hero
        src="/images/story/jaipur/jal-mahal-man-sagar-2019.jpg"
        alt="Jal Mahal, a long pale-yellow palace with domed corner pavilions and trees growing on its roof, standing in the still water of Man Sagar lake. Hazy hills rise behind it, egrets stand on a strip of green in the foreground, and a bird flies low over the water."
        source="Wikimedia Commons"
        credit="Jakub Hałun, Jal Mahal in Man Sagar, December 2019, CC BY-SA 4.0"
      />
      <Lede>
        Jaipur sits among dry hills, with about 600 millimetres of rain in a
        normal year, two-thirds of it in July and August. For three centuries it
        has reached further out for its water. The planned city of the 1720s
        drank from wells inside its walls. From 1874 it pumped the Amanishah, a
        river to the west that now carries storm water and sewage. Later it
        turned to Ramgarh, a reservoir in the hills that on 8 October 2026 held
        nothing. Today <strong>590 of the 766.73 million litres a day</strong>{" "}
        that the state&apos;s Public Health Engineering Department (PHED)
        supplies to the city come from Bisalpur, a dam on the Banas about 120
        kilometres away.
      </Lede>
      <Lede>
        The oldest source never went away. Under the city, the Central Ground
        Water Board&apos;s latest assessment finds about three and a half times
        as much groundwater being drawn each year as can safely be taken.
      </Lede>

      <Chapter
        id="a-capital-in-the-hills"
        number={1}
        title="A capital in the hills"
        thesis="Before Jaipur there was Amer, a hill capital with a lake below its palace, and on the road down from it a lake that may be older than the city."
      >
        <p>
          For nearly six centuries, says the Imperial Gazetteer of 1908, the
          Kachwaha rulers had their capital at Amber, now Amer, in the hills north
          of today&apos;s city. Below the palace lies the Maota lake. The first
          national census of water bodies, for 2017-18, lists it as a tank of 10.89
          hectares and records it as not in use that year.
        </p>
        <Figure
          src="/images/story/jaipur/amer-fort-maota-2019.jpg"
          alt="Amer Fort, a long sandstone palace on a hillside, reflected in the still blue water of Maota lake. An arcaded stone wall runs along the near shore below the fort. On the ridge far to the left, a second fort's walls and a watchtower stand against the sky."
          caption="Amer Fort seen from the bank of the Maota lake in December 2019, with Jaigarh fort on the ridge behind."
          source="Wikimedia Commons"
          credit="Jakub Hałun, Amber Fort from Maota lake, 2019, CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0)"
          aspect="2000/1815"
        />
        <p>
          On the road down from Amer lies a second lake, Man Sagar. In the Supreme
          Court&apos;s 2014 judgment on the lake, the developer&apos;s side says
          Man Singh of Amer, who ruled from 1589 to 1614, built its dam
          &ldquo;much earlier than Jaipur was founded&rdquo;. That is one
          party&apos;s account, not a finding, and we found no year for the dam.
          The judgment&apos;s account of the background dates the pavilion in the
          lake, Jal Mahal, only to &ldquo;the 18th century&rdquo;; later accounts disagree on the
          ruler and the decade.
        </p>
        <p>
          In 1895 T. H. Hendley, for twenty years the surgeon at the Jaipur
          Residency, wrote that storm water on the north of the city ran into the
          palace tanks or into &ldquo;a small river, connected with them, which
          conveys it into the Man-Sagar Lake&rdquo;.
        </p>
      </Chapter>

      <Chapter
        id="the-planned-city"
        number={2}
        title="The planned city and its wells"
        thesis="The new city stood on a plain the Gazetteer thought was the bed of a dried-up lake. It kept tanks beside its palace and drank from its wells."
      >
        <p>
          Sawai Jai Singh II, who succeeded at Amer in 1699, moved his capital
          down to the plain. The Imperial Gazetteer dates the new city to 1728;
          many later accounts give 1727, and we could not reach the official file
          that might settle it. The Gazetteer describes the ground: the city
          &ldquo;stands on a small plain conjectured to be the bed of a dried-up
          lake&rdquo;.
        </p>
        <p>
          Water was kept close to the palace. &ldquo;To the north of the palace
          is the Tal Katora tank, enclosed by a masonry wall,&rdquo; the Gazetteer
          says, &ldquo;and beyond it again is the Raja Mal-ka-talao, about 100
          acres in area and stocked with crocodiles.&rdquo;
        </p>
        <Figure
          src="/images/story/jaipur/tal-katora-2026.jpg"
          alt="An aerial view over dense rows of cream and yellow city buildings. In the middle lies a long rectangular tank of still blue water with straight walled edges, the buildings around it reflected in the surface."
          caption="Tal Katora, the walled tank north of the palace that the Gazetteer described in 1908, seen from the hills on the road to Nahargarh fort in February 2026."
          source="Wikimedia Commons"
          credit="Hardscarf, Lake Talkatora from the Aravalli range, 2026, CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0)"
          aspect="2000/1125"
        />
        <p>
          Drinking water came from wells. Until the 1870s, Hendley wrote, people
          relied on the wells inside the city, &ldquo;but those who could afford
          it were in the habit of sending for their drinking water to certain
          wells which were reputed to contain a pure supply&rdquo;, mostly outside
          the walls. He also saw traces of old channels and thought it &ldquo;more
          than probable&rdquo; that water had once come by an open canal from an
          embankment across the Amanishah river; by his time the river had cut its
          bed 50 feet deeper. He gives no builder or date, and we have found none.
        </p>
        <p>
          The wells inside the walls did not stay clean. Hendley put it down to
          the ground around them, fouled &ldquo;for the past 160 years with the
          excreta of men and animals&rdquo;.
        </p>
        <PullQuote attribution="T. H. Hendley, A Medico-topographical Account of Jeypore (1895)">
          In 1880 out of 827 wells within the walls, only 49 contained pure water.
        </PullQuote>
      </Chapter>

      <Chapter
        id="steam-pumps"
        number={3}
        title="Steam pumps on the Amanishah"
        thesis="After a dam on the river to the west gave way around 1840, the state pumped its water to the city from 1874 and piped it from December 1875."
      >
        <p>
          The Amanishah, Hendley wrote, &ldquo;runs about two miles to the west of
          Jeypore and drains about 25 miles of hills and uncontaminated
          country&rdquo;. About 1840 a masonry dam costing four and a half lakh
          rupees was built across it. When the water reached the top it
          &ldquo;got round the west abutment and carried part of the dam
          away&rdquo;.
        </p>
        <p>
          Nothing more was done until <strong>1874</strong>, when steam pumps were
          set up just above the old dam site. The water went to the city at first
          through the old masonry duct and, from <strong>December 1875</strong>,
          by pipes. Objections, Hendley says, were met &ldquo;by the approval, in
          the first place of a committee of priests, pundits, &amp;c., appointed by
          the Maharaja, and in the end, by the self-interest and convenience of
          the people&rdquo;.
        </p>
        <Figure
          src="/images/story/jaipur/hendley-1895-water-supply.jpg"
          alt="A scanned page of printed text on yellowed paper. It begins 'In 1880 out of 827 wells within the walls, only 49 contained pure water', and under the heading 'WATER-SUPPLY' describes the wells, the traces of an old canal from the Aman-i-Shah river, the masonry embankment of about 1840 that was carried away, and the steam pumps erected in 1874."
          caption="Page 3 of Hendley's 1895 account of Jaipur: the 827 wells, the old channels from the Amanishah, the dam of about 1840 and the steam pumps of 1874."
          source="Wellcome Collection via Internet Archive"
          credit="T. H. Hendley, A Medico-topographical Account of Jeypore (Calcutta, 1895), p.3. Public domain"
          aspect="2000/1812"
          fit="contain"
        />
        <p>
          The state&apos;s engineer, Colonel Jacob, later built an earthen bund
          about 500 feet above the pumps, making &ldquo;a lake a couple of miles
          long&rdquo;. In 1892 the city used 897,884 gallons a day, a little over
          five and a half gallons for each of the 158,787 people counted in 1891,
          and piped water reached, at least in part, seven of its wards.
        </p>
        <p>
          The Imperial Gazetteer of 1908 describes engines lifting the water 109
          feet into covered reservoirs and sending it through the city &ldquo;in
          iron pipes under 50 feet pressure&rdquo;. Jaipur had a municipality from
          1868, but the waterworks were the state&apos;s: Maharaja Ram Singh, who
          died in 1880, gave his capital &ldquo;the benefits of gas and
          water-works&rdquo;, and the state&apos;s Public Works department ran
          them. The state&apos;s engineers ran the water then; the state&apos;s
          PHED supplies it now.
        </p>
      </Chapter>

      <Chapter
        id="ramgarh"
        number={4}
        title="Ramgarh: a dam for fields, then for the city"
        thesis="At the start of the twentieth century the state built its most important irrigation reservoir in the hills to the north-east. From 1978 its water went to Jaipur's taps."
      >
        <p>
          The next source lay in the hills to the north-east. The Gazetteer of
          1908 describes a dam 80 feet high on the Banganga near Gopalgarh,
          forming &ldquo;the Ramgarh reservoir, the most important irrigation work
          in the Jaipur State&rdquo;. Full, it covered six square miles and could
          hold up to 3,000 million cubic feet of water, about 85 million cubic
          metres.
        </p>
        <Figure
          src="/images/story/jaipur/imperial-gazetteer-1908-ramgarh.jpg"
          alt="A scanned paragraph of printed text describing a dam 80 feet high near the village of Gopalgarh in the Ramgarh hills, forming the Ramgarh reservoir, the most important irrigation work in the Jaipur State, covering six square miles when full and costing nearly five lakhs of rupees."
          caption="The Imperial Gazetteer of 1908 on the new Ramgarh reservoir, in its article on the Banganga."
          source="University of Toronto via Internet Archive"
          credit="Imperial Gazetteer of India, vol. VI (Oxford, 1908), p.379. Public domain"
          aspect="1620/914"
          fit="contain"
        />
        <p>
          When it was finished depends on the document: 1901 in the Central Water
          Commission&apos;s register of large dams, 1903 in a 2017 Supreme Court
          judgment. The court gives it a catchment of about 769 square kilometres
          across four tehsils, Jamwa Ramgarh, Amer, Shahpura and Viratnagar, and
          says its water was &ldquo;till 1978, a source of irrigation. Thereafter,
          it became a source of drinking water&rdquo; for Jaipur. In 1982 the
          Asian Games held their water sports on the lake.
        </p>
      </Chapter>

      <Chapter
        id="a-lake-that-stopped-filling"
        number={5}
        title="A lake that stopped filling"
        thesis="Ramgarh's catchment was built over, the water stopped coming, and for more than twenty years the courts have been asking for the catchment back."
      >
        <p>
          In the early 2000s it gave the city little. When the Japan International
          Cooperation Agency (JICA) appraised a new supply project in 2003,{" "}
          <strong>97%</strong>{" "}of the city&apos;s 345 million litres a day came
          from groundwater. Ramgarh, &ldquo;the sole source of surface
          water&rdquo;, gave 10 to 15 million litres a day against an expected 72.
        </p>
        <p>
          The courts had begun to ask why. In July 2003 the Rajasthan High Court,
          on a public interest petition, ordered a survey of catchment land used
          &ldquo;for construction and mining purposes&rdquo;. In 2011 it opened a
          case of its own and asked the state for a plan to remove encroachments
          &ldquo;so as to restore the position as was existing on
          15.08.1947&rdquo;. Its monitoring committee reported that Ramgarh
          &ldquo;had become dry due to encroachments and obstructions&rdquo;. In
          January 2013 a state technical committee reported on &ldquo;Less/no
          inflow in Ramgarh Dam (District Jaipur) Despite Average and Above
          Average Rainfall&rdquo;.
        </p>
        <Figure
          src="/images/story/jaipur/ramgarh-lake-2014.jpg"
          alt="A view from beside a high masonry wall with steps and a small domed stone pavilion. Beyond the wall, low hills and a wide expanse of dense green scrub stretch to the horizon under a pale sky."
          caption="'Ramgarh Lake, Jaipur district', as its photographer described this view in August 2014. In November 2017 the Supreme Court was told the lake was 'still bone dry'."
          source="Wikimedia Commons"
          credit="Muzzawb, Ramgarh lake, 2014, CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0)"
          aspect="4/3"
        />
        <p>
          In November 2017 the Supreme Court asked whether the lake held any water
          and was told it was &ldquo;still bone dry&rdquo;. It dismissed a
          university&apos;s petitions over buildings in the catchment, with costs
          of Rs 10 lakh each, and ordered the construction removed.
        </p>
        <p>
          The case is still open. On 30 July 2026 the High Court directed the
          state&apos;s Water Resources Department to remove the anicuts, small
          check dams, that stand in the way of the flow to the lake. On 13 August
          it had the district collector&apos;s list of encroachers in the
          catchment published in two newspapers, as notice. We have not found the
          order from its next hearing, on 15 September. On 8 October 2026 the
          department&apos;s daily report showed Ramgarh holding{" "}
          <strong>nothing</strong>{" "}of its 75.04 million cubic metres. It held
          nothing on the same day a year earlier, when the state&apos;s dams
          overall were 90% full.
        </p>
      </Chapter>

      <Chapter
        id="bisalpur"
        number={6}
        title="Water from the Banas, 120 kilometres away"
        thesis="By 2012 most of Jaipur's water came by pipeline from a dam in Tonk district, brought in with two foreign loans. The dam is shared with Ajmer."
      >
        <p>
          The water that took Ramgarh&apos;s place comes from the south-west.
          Bisalpur dam, on the Banas in Tonk district, was completed in 1999,
          according to the Central Water Commission&apos;s register, and holds up
          to 1,095.84 million cubic metres. JICA puts it about 120 kilometres from the city.
        </p>
        <p>
          The Asian Development Bank financed the main line from the dam, an
          addition estimated at $120 million to an urban project it was already
          funding in Rajasthan. JICA lent for the transfer system into the city:
          its loan was signed in March 2004, PHED built the works, and the city
          packages were handed over between July and December 2010. We have not
          found an official record of the day Bisalpur water first reached
          Jaipur&apos;s taps.
        </p>
        <Figure
          src="/images/story/jaipur/bisalpur-dam-2011.jpg"
          alt="A tall concrete dam wall with a road along its crest and an orange-and-white control tower, holding back a wide, calm reservoir that stretches to a hazy horizon with a low island. A railing runs along the near edge."
          caption="Bisalpur dam on the Banas in Tonk district, December 2011. On 31 December 2025, 590 of the 766.73 million litres a day PHED supplied to Jaipur came from here."
          source="Wikimedia Commons"
          credit="Eklavya Yadav, Bisalpur Dam, 2011, CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0)"
          aspect="4/3"
        />
        <p>
          JICA&apos;s figures show the change. Groundwater, 97% of the city&apos;s
          supply in 2003, was 19% in 2012. The volume from Bisalpur kept growing.
          On 31 December 2025, PHED&apos;s annual report gives the city{" "}
          <strong>766.73 million litres a day (MLD)</strong>: 590 from Bisalpur
          and 176 from 3,633 PHED tube wells. A year earlier it was 668.09 MLD,
          with 492.08 from Bisalpur.
        </p>
        <p>
          The dam is shared. A 2020 draft study by the state&apos;s Water
          Resources Department describes 11.1 thousand million cubic feet a year
          (about 314 million cubic metres) for Jaipur and the villages along its
          pipeline, 5.1 for Ajmer and its route, and about 8 for irrigation. We
          have not found an order that fixes those shares. On 8 October 2026
          Bisalpur was 71.31% full; a year earlier it was full.
        </p>
        <PullQuote attribution="Central Ground Water Board (2023)">
          The earlier source of surface water was Ramgarh lake, which has been
          dried up and now surface water is transferred through pipe line from
          Bisalpur Dam on Banas River located about 120 km. from Jaipur.
        </PullQuote>
      </Chapter>

      <Chapter
        id="lake-and-river"
        number={7}
        title="A lake that took the sewage, a river that became a drain"
        thesis="In 1962 the walled city's sewage was turned into the lake on the Amer road, and the river that fed the first pipes now carries storm water and sewage."
      >
        <p>
          The Supreme Court&apos;s 2014 judgment records that in 1962 the walled
          city&apos;s two main sewage drains, Nagtalai and Brahmapuri, were turned
          into Man Sagar; by the petitioners&apos; account, water hyacinth arrived
          in 1975. A restoration under the National Lake Conservation Plan,
          estimated at Rs 24.72 crore with 70% from the Government of India, was
          approved in 2002 and carried out by the JDA, the Jaipur Development
          Authority. In 2005, 100 acres of the lake precinct were leased to a
          private company for 99 years. The High Court declared the lease void in
          2012. In 2014 the Supreme Court cut it to 30 years, returned 8.65 acres
          to the lake and kept 14.15 acres as a public promenade where nothing may
          be built.
        </p>
        <p>
          In February 2025 the Supreme Court directed that NEERI, the National
          Environmental Engineering Research Institute, study the lake, and held
          back development there under a state plan until it reports. We have
          found no later order or report.
        </p>
        <Figure
          src="/images/story/jaipur/jal-mahal-2006.jpg"
          alt="Jal Mahal lit up in warm light in the middle of Man Sagar lake, its reflection on the dark water, with black hills and a dark grey sky behind."
          caption="Jal Mahal lit up in Man Sagar on 1 January 2006, six weeks after the lease of the lake precinct was signed on 22 November 2005."
          source="Wikimedia Commons"
          credit="Patrick J. Finn, Jal Mahal at Jaipur, 2006, CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0)"
          aspect="3/2"
        />
        <p>
          The river that first fed the pipes is still there. In 1895 Hendley
          described the Ganda Nallah, which &ldquo;leaves the City
          below the South Wall, and then runs on to join the Aman-i-Shah
          River&rdquo;. In 2017 the JDA, seeking environmental clearance to rebuild
          the channel, described what had become of it.
        </p>
        <PullQuote attribution="Environmental impact assessment for the Dravyavati project, Jaipur Development Authority (2017)">
          Dravyavati River was the active river of Jaipur which, over the time
          turned into a Nallah (Amanisha Nallah) due to rapid urbanization &amp;
          industrialization on both side of the river.
        </PullQuote>
        <p>
          In the JDA&apos;s description the channel runs 47.5 kilometres from the
          Nahargarh hills, takes storm and waste water from the walled city through
          the same Ganda Nallah, and ends in the Dhund river. The JDA contracted
          its rebuilding on 18 March 2016, for Rs 1,470.85 crore plus Rs 206.08
          crore for ten years of upkeep, with 170 MLD of sewage treatment planned,
          and issued a commissioning certificate on 9 December 2022. In December
          2024 the High Court recorded that no work had been done in the
          submergence areas of three dams on the river, and asked for yearly
          reports on its upkeep.
        </p>
      </Chapter>

      <Chapter
        id="today"
        number={8}
        title="A dam far away, and an aquifer below"
        thesis="Jaipur now drinks mostly from a river it does not stand on, and draws far more from the ground beneath it than the rain puts back."
      >
        <p>
          In most of the roughly 400 zones in PHED&apos;s 2024 supply schedule,
          piped water comes for about an hour a day. In summer it is topped up by
          road: at the June 2025 peak PHED ran 230 tankers a day in the city,
          making 1,283 trips.
        </p>
        <p>
          Under the city, the water table has fallen a long way. At the Central
          Ground Water Board&apos;s piezometer at Durgapura, water stood 19.5
          metres below the ground in May 1995, 62.8 metres in May 2010 and 55.7
          metres in May 2023. In the board&apos;s latest assessment (IN-GRES,
          2025-26), the city&apos;s own unit, Jaipur Urban, draws{" "}
          <strong>349.88%</strong>{" "}of the groundwater that can safely be
          taken out each year; the printed 2025 report put it at 328.41%. In that
          report all 16 assessment units in Jaipur district were over-exploited.
        </p>
        <p>
          The city that once drank from 827 wells inside its walls now drinks from
          a dam 120 kilometres away, and pumps the ground beneath it at more than
          three times what the official count says it can safely give.
        </p>
        <ThenNow
          thenLabel="1880-1908"
          nowLabel="2025-26"
          rows={[
            {
              metric: "Main source of drinking water",
              then: "Wells inside the walls; the Amanishah by pipe from 1875",
              now: "Bisalpur dam, 120 km away: 590 of 766.73 MLD (PHED, 31 Dec 2025)",
            },
            {
              metric: "Piped water per person",
              then: "A little over 5½ gallons a day, about 25 litres (1892)",
              now: "135 litres a day, PHED's reported service level (2025)",
            },
            {
              metric: "The river to the west",
              then: "The Amanishah, pumped for the city's drinking water",
              now: "The Dravyavati channel, carrying storm water and sewage to the Dhund",
            },
            {
              metric: "Ramgarh",
              then: "'The most important irrigation work in the Jaipur State' (1908)",
              now: "Nothing of 75.04 million m³ on 8 October 2026 (WRD)",
            },
            {
              metric: "Man Sagar",
              then: "Where the north of the city's storm water ran (1895)",
              now: "Under a NEERI study ordered by the Supreme Court (2025)",
            },
            {
              metric: "Groundwater",
              then: "49 of 827 wells inside the walls held pure water (1880)",
              now: "Jaipur Urban drawn at 349.88% of what can safely be taken (IN-GRES 2025-26)",
            },
          ]}
        />
        <CTA href="/jaipur">See where Jaipur&apos;s water comes from today</CTA>
        <CTA href="/jaipur/groundwater">The aquifer under the city</CTA>
        <CTA href="/jaipur/water-bodies">Ramgarh, Man Sagar and the city&apos;s lakes</CTA>
      </Chapter>
    </StoryPage>
  );
}

export default JaipurStoryEn;
