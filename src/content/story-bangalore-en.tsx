/**
 * Bangalore water story - "City of stolen kere: what Kempegowda built and
 * what Bengaluru built over it." Composed from the Lede / Chapter / Figure /
 * PullQuote / CTA / ThenNow shortcodes.
 *
 * Source spine for verifiable claims:
 *   - Harini Nagendra, Nature in the City: Bengaluru in the Past, Present, and Future (OUP 2016)
 *   - Fathima Samana, Historical Evolution of Tank System in Bangalore City (2008)
 *   - Cambridge Urban History 2021 - "Flows and fixes: water, disease and housing in Bangalore, 1860-1915"
 *   - Water Alternatives 2025 - A Case Study of Hesaraghatta Waterworks in Bangalore
 *   - D'Souza & Nagendra 2011 - Changes in Public Commons / Agara Lake (Environmental Management 47:840-850)
 *   - Ramachandra et al. (IISc CES) - Wetlands of Bengaluru, 105-lake survey
 *   - JICA Bengaluru Water Supply and Sewerage Project (Phase 3) Final Report, Nov 2017
 *   - Forward Foundation v State of Karnataka (NGT) - Bellandur-Varthur Rajakaluves case
 *   - WELL Labs Bengaluru Urban Water Balance Report (Jan 2024)
 *   - IISc Groundwater Outlook of Bengaluru City (BWSSB-commissioned, April 2025)
 *   - The Ken May 2026 series "Bengaluru doesn't have a water problem"
 *
 * No Hero image in V0 - we don't ship images without source attribution
 * and we have no licensed Bangalore archival image in /public/images/story/
 * bangalore/ yet. Add via a follow-up commit when an image is sourced.
 */

import { StoryPage } from "@/components/story/story-page";
import {
  Chapter,
  CTA,
  Figure,
  Hero,
  Lede,
  PullQuote,
  ThenNow,
} from "@/components/story/story-shortcodes";

export function BangaloreStoryEn() {
  return (
    <StoryPage
      cityId="bangalore"
      cityDisplayName="Bengaluru"
      tagline="City of stolen kere: what Kempegowda built and what Bengaluru built over it"
      lastRevised="May 2026"
    >
      <Hero
        src="/images/story/bangalore/bangalore-1854-map.jpg"
        alt="Surveyed map of Bangalore in 1854, published by Pharaoh and Co., Madras. The old walled Pete sits to the left and the British Cantonment to the right, with the daisy-chained kere - Dharmambudhi, Sampangi, Halsoor, Sankey, Kempambudhi and dozens of smaller tanks - shown in their period-correct positions across both halves of the city."
        source="Wikimedia Commons / Pharaoh and Co. atlas"
        credit="Surveyed for Pharaoh and Co. Madras, 1854 (public domain)"
      />
      <Lede>
        Bengaluru sits on a ridge, not a river. Its founder in 1537,
        Kempe Gowda I, had no Vaigai or Cooum to dam, so he built lakes
        instead - <em>kere</em> (ಕೆರೆ) in Kannada, earthen bunds across
        the gentlest slope of each valley, daisy-chained so the overflow
        from the upper kere filled the next one down. Nineteenth-century
        gazetteers counted close to three hundred kere in what is now
        BBMP. Today, by the most generous count, about a third still
        hold water; by a stricter count, fewer than twenty are in
        something the Indian Institute of Science is willing to call{" "}
        <em>good condition</em>. The oldest kere this city had -
        Dharmambudhi - is a bus stand. The kere the founder himself
        built - Kempambudhi - is now a sewage drain. The first thing every
        visitor to Bengaluru ever did - look at a kere - is now harder
        to do here than in most villages in Karnataka.
      </Lede>

      <Chapter
        id="kere-the-tank-builders"
        number={1}
        title="Kere: the tank builders, 1537-1799"
        thesis="Bengaluru did not have a river. It had a chieftain whose mother told him in Kannada to build lakes and plant trees, and a Vijayanagar emperor who gave him permission to do it."
      >
        <p>
          Kempe Gowda I (1513-1569) was a vassal of the Vijayanagara
          empire, ruling the Yelahanka <em>nadu</em> as the head of the
          Morasu Vokkaliga community. The empire was at its imperial
          height under Krishnadevaraya; Yelahanka was a productive but
          unremarkable hill-country tract about ten kilometres north of
          a slightly larger ridge plateau that the locals already called
          Bengaluru. An inscription at Dasarahalli, on the way down from
          Yelahanka into the plateau, records the year in which the
          emperor Achyutaraya granted Kempe Gowda permission to build a
          new town there: 1532. Construction took five years. A founding
          ceremony at Doddapete junction - today the intersection of
          Avenue Road and Chickpete, the centre of the original walled
          Pete (ಪೇಟೆ) - laid down four roads in the four cardinal
          directions, anchored by four watchtowers, and on an auspicious
          moment fixed by an astrologer Kempe Gowda yoked a pair of
          bullocks to a plough and turned the first furrow. The year was
          1537. That ploughed line is the founding date Karnataka still
          celebrates.
        </p>
        <p>
          He did not just build a town. He built it together with its
          water. The locally remembered version is that his mother
          instructed him in a single Kannada sentence:{" "}
          <em>keregalum kattu, marangalum nedu</em> - build lakes, plant
          trees. He took it literally. Within his lifetime he had built
          the kere that bears his family deity Kempamma&apos;s name -
          Kempambudhi - alongside Dharmambudhi (whose surplus drained
          toward what is now Majestic), Sampangi (which gave its name to
          the road that ran around it), and several smaller ponds in the
          Pete. Three valleys ran off the ridge the city sat on; he
          aligned the kere along all three. Each one was a low earthen
          bund across the gentlest slope of the valley, fronted by a
          stone <em>kalyani</em> (ಕಲ್ಯಾಣಿ) where temple priests drew
          water for ritual, with a sluice (or sometimes a notched
          spillway) controlling release. The overflow from the upper
          kere fed the next one downstream. By Kempe Gowda&apos;s
          grandson&apos;s time, in the early seventeenth century, the
          three valleys held a working cascade of dozens of
          interconnected kere whose water irrigated paddy, washed
          clothes, recharged the open wells in every <em>pete</em>{" "}
          neighbourhood, and supplied tank-fed temple festivals.
        </p>
        <PullQuote attribution="Harini Nagendra, Nature in the City (OUP 2016)">
          The lakes of Bengaluru are not natural lakes. They are tanks -
          made by damming the flow of water, fed by the rain, designed
          to feed each other.
        </PullQuote>
        <Figure
          src="/images/story/bangalore/ulsoor-1834.jpg"
          alt="Steel engraving of Ulsoor (Halsoor) Lake in Bangalore, 1834, by William Miller after Humphrey Jervis. The kere is full; the bund is visible at right; a temple complex stands on the shore. Cattle graze at the water's edge in the foreground."
          caption="Ulsoor (Halsoor) Lake, 1834. A working Bengaluru kere a generation before the Cantonment Water Works at Hesaraghatta (1894) demoted the kere system from primary water supply to overflow buffer. Steel engraving by William Miller after Humphrey Jervis."
          source="Wikimedia Commons"
          credit="William Miller (1796-1882) after Humphrey Jervis, 1834 (public domain)"
          aspect="7/5"
          fit="contain"
        />
        <p>
          Two more political eras built on what Kempe Gowda started. The
          Maratha governor Shahaji Bhonsle ruled Bengaluru from 1638;
          his son Shivaji was born here. The Wadiyars of Mysore took it
          in 1689, kept it for seventy years, then lost it to Hyder Ali
          in 1761. Hyder Ali and his son Tipu Sultan - who together
          ruled Bengaluru for the last four decades of the eighteenth
          century - built a stone fort, expanded the cantonment-era
          armaments, and laid out the famous Lal Bagh botanical garden
          (literally <em>the red garden</em>, after its red rose
          plantings). They did not invent the kere system. They
          inherited and maintained it. The maintenance was done at the
          village level through a tax-supported obligation that the
          colonial gazetteers later called <em>shisthu kattu</em> - tank
          repair was a community duty enforced by the state and tied to
          land revenue. Bunds were patched after every monsoon; sluices
          were de-silted; the chains stayed connected. The kere did not
          maintain themselves. Nobody pretended they did. The
          eighteenth-century historian Mark Wilks, writing of the
          Mysore wars, recorded the kere as ordinary working
          infrastructure in the landscape - hardly worth narrating,
          which is itself the highest compliment a piece of working
          infrastructure can receive.
        </p>
        <p>
          In May 1799 the British and the Marathas together stormed
          Tipu Sultan&apos;s capital at Srirangapatna, fifty miles
          south-west of Bengaluru. Tipu fell at the breach. The British
          East India Company took the Mysore kingdom under indirect
          rule. Bengaluru, the old Pete, was technically restored to
          the Wadiyar dynasty under British paramountcy. What the
          British took directly was the cantonment.
        </p>
      </Chapter>

      <Chapter
        id="the-cantonment-tap"
        number={2}
        title="The Cantonment tap, 1809-1947"
        thesis="When British military health needed water, the kere stopped being the city's water and became the natives' water. Two cities, two pipes."
      >
        <p>
          In 1809 the East India Company, finding the swampy islets of
          Srirangapatna unfit for the long-term health of European
          troops, moved the resident garrison north to the higher,
          drier Bengaluru plateau. By 1811 a fifty-thousand-strong
          cantonment had been laid out east of the old Pete around
          Halsoor Lake. Two cities now coexisted under one name:{" "}
          <em>Bangalore Civil and Military Station</em> - the
          Cantonment, administered directly by the British Resident -
          and <em>Bangalore Pete</em>, the older walled town, which
          remained nominally under the Mysore Durbar at the Wadiyar
          palace. The line between them ran roughly along what is now
          MG Road. The Cantonment populated itself with Tamil-speaking
          mess servants, English officers, Anglo-Indian railway clerks,
          and an Irish regimental population. The Pete remained
          Kannada-speaking. Both cities used the kere. The Cantonment,
          for its first half-century, drew its water from Halsoor lake,
          from open wells, and from the seasonal Vrishabhavathi runoff.
        </p>
        <p>
          The break came with cholera. The Cambridge Urban History
          article by James Heitzman and others titled{" "}
          <em>Flows and fixes: water, disease and housing in
          Bangalore, 1860-1915</em>{" "}
          (Urban History, 2021) traces the sequence in granular
          detail. After repeated cholera and typhoid outbreaks in the
          1870s and 1880s, the colonial Sanitary Commissioner for
          Mysore concluded that British troops could not safely
          continue to drink from the same kere as the native
          population. A separate piped water supply was needed - one
          fed not by the contaminated tanks at the edge of the
          Cantonment but by an impoundment somewhere upstream and
          uphill, where catchment land could be cleared of human
          settlement and the water bacterially clean. The candidate was
          the Arkavathi River, eighteen miles north-west of the city.
          The dam was built at Hesaraghatta village, completed in 1894,
          and named the <em>Chamarajendra Water Works</em> after the
          then-king Chamarajendra Wadiyar IX. The project was driven
          and largely financed by Sir K. Seshadri Iyer, Dewan of
          Mysore from 1883 to 1901, who is the only Indian official
          formally credited with the scheme. It was the first piped
          water supply ever delivered to any Indian city by mechanised
          pumping rather than gravity.
        </p>
        <PullQuote attribution="Water Alternatives, 2025 (Hesaraghatta waterworks case study)">
          Hesaraghatta was not a substitute for the kere. It was a
          parallel water supply for the population that could no longer
          be asked to share a tank with the population that already
          had one.
        </PullQuote>
        <p>
          The point of Hesaraghatta is not that it gave Bengaluru piped
          water. It is what it did to the kere. From 1894 onward the
          official water supply, the one the Cantonment trusted and the
          colonial Sanitary Commissioner certified, came from
          somewhere else. The kere were no longer central to the
          European population&apos;s water need. They became the
          natives&apos; water - and, slowly, the city&apos;s wastewater.
          The colonial-era institution that had maintained the cascade,{" "}
          <em>shisthu kattu</em>, was not exactly abolished; it was
          quietly stopped being enforced. Tanks that no one was
          responsible for began to silt. The kere closest to the
          Cantonment - Halsoor, Sampangi, Akkithimmanahalli - became
          increasingly polluted as colonial-era industry and small
          settlements drained into them without the maintenance cycle
          that had kept them clean.
        </p>
        <p>
          By 1933 Hesaraghatta itself was no longer enough. A second,
          larger reservoir was built downstream on the same Arkavathi
          river, at Tippagondanahalli, and named Chamaraja Sagara after
          the dynasty&apos;s long-serving monarch. <em>TG Halli</em>,
          as it came to be called in BWSSB shorthand, became the
          city&apos;s primary surface-water supply from the 1930s into
          the 1980s. Both Hesaraghatta and TG Halli would later die
          the same way: the Arkavathi catchment got built over, the
          monsoon stopped recharging them, and untreated sewage from
          the upstream layout colonies destroyed the water quality of
          what was left. By the time BWSSB was constituted as a
          statutory board in 1964 to professionalise the city&apos;s
          water supply, the Arkavathi reservoirs were already losing
          yield. The Cantonment-Pete water arithmetic of the 1890s -
          there are too many of them and not enough water, so build a
          separate supply for the ones who matter - was about to be
          repeated at a larger scale, with a different river.
        </p>
      </Chapter>

      <Chapter
        id="cauvery-ninety-km-away"
        number={3}
        title="Cauvery ninety kilometres away, 1947-2010"
        thesis="Bengaluru stopped being a city with lakes and became a city with a pipe coming uphill from a river it never saw."
      >
        <p>
          The Cauvery does not flow past Bengaluru. The river runs
          ninety-five kilometres south-east of the city, draining a
          watershed Bengaluru is not in. By the late 1960s the
          Arkavathi was visibly failing; the BBMP&apos;s precursor, the
          City Municipal Council, was already rationing supply. The
          Government of Karnataka petitioned the central government
          for an allocation from the Cauvery, and in December 1974 the
          first stage of the Cauvery Water Supply Scheme was
          commissioned, lifting 135 million litres per day from an
          intake at T.K. Halli on the Cauvery, treating it at a
          riverside plant, and pumping it uphill against five hundred
          metres of elevation through three pumping stations -
          T.K. Halli to Harohalli to Tataguni - and into the city. It
          was, and remains, one of the most energy-intensive municipal
          water supplies in the world. The Bangalore Water Supply and
          Sewerage Board (BWSSB), constituted by the Karnataka
          legislature ten years earlier in 1964, owned and ran the
          pipe. By the salient-features table of the JICA Bengaluru
          Water Supply and Sewerage Project Phase 3 Final Report (2017),
          roughly seventy-five per cent of BWSSB&apos;s annual operating
          revenue is consumed by electricity for that pumping.
        </p>
        <p>
          The pipe came in stages. Stage I in 1974 added 135 MLD; Stage
          II in 1982, another 135 MLD; Stage III in 1992, 270 MLD;
          Stage IV Phase 1 in 2002, 270 MLD; Stage IV Phase 2 in 2012,
          500 MLD. The total Cauvery WTP capacity at Bengaluru, by
          2012, was 1,310 MLD - up from zero forty years earlier, and
          two and a half times what Hesaraghatta plus TG Halli had ever
          managed. The official monthly-maximum supply, per the JICA
          tables, was 1,450 MLD. The city&apos;s population had grown
          from roughly two million in 1974 to over eight million by
          2010. Per-capita supply hovered around 146 litres per
          person per day on paper, against the CPHEEO design standard
          of 150 LPCD for a metropolitan city. What actually reached
          consumer taps, per the same JICA report, was seventy-six
          litres. The forty-eight per cent gap - what the engineering
          literature politely calls <em>non-revenue water</em>, the
          rest of us call leaks and theft - was higher than any
          comparable Indian city.
        </p>
        <PullQuote attribution="T.V. Ramachandra et al., IISc Centre for Ecological Sciences">
          A 466 per cent increase in built-up area between 1973 and
          2007 was accompanied by a 58 per cent decline in wetland area
          in Greater Bangalore.
        </PullQuote>
        <p>
          Meanwhile, the kere died. Not all at once. The mechanism was
          uniform: a kere, no longer maintained because no one was
          legally responsible for it, silted and shrank. Once it was
          small enough to look like waste ground, the city built on
          it. Dharmambudhi - Kempe Gowda&apos;s second-built kere - was
          drained for the Kempegowda Bus Station (Majestic). Sampangi
          went under the Sri Kanteerava Stadium. Karanji Anjaneya tank
          became the Bishop Cotton Boys School ground.
          Akkithimmanahalli tank is a hockey stadium. Sankey, named
          after the British engineer who designed it, survives as a
          decorative water body in central Malleshwaram. The Indian
          Institute of Science&apos;s Centre for Ecological Sciences,
          led by T.V. Ramachandra and Sudhira H.S., surveyed 105 kere
          across Greater Bangalore in the late 2000s and concluded
          that only four were in good condition - the rest were
          either covered in macrophyte mats, choked with solid waste,
          or holding little to no water. Using Landsat data they
          documented a 466 per cent increase in built-up area between
          1973 and 2007 alongside a 58 per cent decline in wetland
          area. The kere chains that Kempe Gowda had laid along the
          three valleys were broken; the storm-water drains
          (<em>rajakaluves</em>) that had once linked one kere to the
          next had been narrowed, paved over, or built up against.
        </p>
        <p>
          The most-studied single case is Agara. R. D&apos;Souza and
          Harini Nagendra&apos;s 2011 paper in <em>Environmental
          Management</em> - <em>Changes in Public Commons as a
          Consequence of Urbanization: The Agara Lake in Bangalore,
          India</em> - traces what happened in four decades to one
          ninety-acre kere south of the original Pete. Until the
          1970s, Agara was a working agricultural commons: fishers
          netted from a wooden landing on its eastern shore, dhobis
          washed clothes on the western, paddy farmers drew water by
          chain pump, and the surrounding villagers grazed cattle on
          its bunds. By the late 2000s, the agriculture was gone, the
          fishers had been moved out, the surrounding wards were upper
          middle class apartment blocks, and the kere had been
          re-classified as a recreation site managed by the Lake
          Development Authority. Community management had been
          replaced by state management. The visible improvement -
          jogging tracks, fencing, no more open sewage discharge -
          had come at the cost of the working uses that had given
          the kere its meaning. Nagendra&apos;s 2016 book{" "}
          <em>Nature in the City</em> documents the same pattern across
          all Bengaluru kere: the ones that survived survived as
          amenities, not as infrastructure.
        </p>
      </Chapter>

      <Chapter
        id="foam-fire-and-the-day-the-tap-almost-ran-dry"
        number={4}
        title="Foam, fire, and the day the tap almost ran dry, 2010-2026"
        thesis="By the time the lakes started burning, the city was already running on tankers."
      >
        <p>
          On 16 May 2015 the foam on the surface of Bellandur Lake - the
          city&apos;s largest, three hundred and seventeen hectares,
          fed by the entire Koramangala-Challaghatta valley sewerage
          system - caught fire. The foam rose past the height of the
          adjacent four-lane outer ring road. Passing motorists
          photographed flames burning at the lake-air interface above a
          floating raft of detergent-and-sewage scum. The fires
          recurred in 2017, in February 2018 (one fire burned for over
          thirty hours), and in 2021. The toxic foam events - foam
          spilling onto adjacent streets in shoulder-high drifts -
          recurred several times a year through the same period.
          Bellandur is downstream of the K&amp;C Valley STPs whose
          combined design capacity is two hundred and forty-eight MLD;
          the actual untreated sewage volume that reaches the lake when
          those plants are over capacity or off-line, by various
          estimates, is between four and five hundred MLD - more
          sewage per day than the original lake&apos;s design throughput
          could plausibly hold.
        </p>
        <p>
          The 2015 fire was the trigger for the case <em>Forward
          Foundation v State of Karnataka</em> at the National Green
          Tribunal. The petitioners - a Bengaluru-based environmental
          trust - documented the upstream <em>rajakaluves</em> feeding
          Bellandur, the apartment-block encroachments on the
          storm-drain network, and the buffer-zone violations along the
          lake&apos;s edges. The NGT&apos;s 2018 order required the
          Karnataka government to set aside Rs 500 crore for Bellandur
          revival and to enforce a 75-metre buffer zone (later modified
          to 30 metres at the perimeter, 50 metres for storm-water
          drains, 25 metres for canals). The order is widely cited as a
          turning point in Indian environmental jurisprudence - the
          first time an NGT bench explicitly held that a state
          government&apos;s failure to maintain a hydraulic system
          counted as an environmental violation in itself. The Bellandur
          fires have subsided since 2021. The sewage has not.
        </p>
        <PullQuote attribution="BBC, 2018 (citing UN projections)">
          Bengaluru ranks second after Cape Town among eleven global
          cities likely to run out of drinking water in the near future.
        </PullQuote>
        <p>
          In early 2018, a BBC feature - prompted by the same year&apos;s
          Cape Town Day Zero scare and a UN projections briefing - named
          Bengaluru as the city most at risk of going dry after Cape
          Town. The framing was contested in Karnataka but the
          underlying numbers held: BWSSB&apos;s 1,310 MLD Cauvery WTP
          capacity, against a JICA-projected 2034 demand of 2,608 MLD
          across Bengaluru BBMP plus the eight ULBs plus the 110
          newly-merged villages, opened a structural ~1,000 MLD gap that
          could not be closed without the as-yet-uncommissioned Cauvery
          Stage V. Households filled the gap with private borewells -
          the WELL Labs Bengaluru Urban Water Balance Report (2021
          data) estimates the city&apos;s groundwater dependence at
          1,392 MLD, above the ~800 MLD the BWSSB-commissioned IISc
          Groundwater Outlook (2024-25) reads as actual extraction -
          and with private tanker water. The OpenCity Bengaluru Tanker
          Water Surveys captured what households actually paid: the
          median price per tanker load rose from Rs 510 in 2015 to Rs
          800 in 2019 to Rs 1,300 in 2024. Of 160 apartment communities
          surveyed in 2024, 95.6 per cent reported relying on private
          tanker water; 90 per cent reported BWSSB supply had worsened
          year-on-year; 69 per cent reported ordering tanker water more
          often than the previous quarter. The Bellandur fires made
          Bengaluru&apos;s water crisis legible internationally. The
          tanker price made it legible at the household kitchen door.
        </p>
        <p>
          Two later interventions are the closest the city has come to
          structural relief. On 16 October 2024, Cauvery Stage V was
          commissioned at T.K. Halli, with a design capacity of 775
          MLD aimed at covering the 110 newly-merged villages and the
          eight ULBs that BBMP absorbed in 2007. By February 2026,
          per <em>The Ken</em>&apos;s May 2026 series{" "}
          <em>Bengaluru doesn&apos;t have a water problem</em>, actual
          delivery had reached approximately 400 MLD - just over half
          of design - because the last-mile distribution infrastructure
          in the merged villages was incomplete. And in parallel, BWSSB
          partnered with the French utility operator SUEZ on the
          country&apos;s largest indirect-potable-reuse pilot: the
          1933-vintage TG Halli reservoir, defunct as a freshwater
          source for thirty years, is being repurposed to receive 110
          MLD of tertiary-treated sewage that, after blending and
          residence time, becomes raw water for the upstream Cauvery
          WTP system. The first surviving piped supply system in
          Bengaluru is being reborn as the closing of the city&apos;s
          sewerage loop.
        </p>
        <p>
          On 15 May 2025, the BBMP was dissolved by Karnataka Act 36 of
          2025 and replaced by the Greater Bengaluru Authority (GBA),
          an umbrella body composed of five new City Corporations
          (Central, East, West, North, South) covering 369 wards. The
          final delimitation was notified on 19 November 2025, with
          name changes added 1 December 2025. The new geography
          inherits BWSSB&apos;s water arithmetic unchanged. The 65
          BBMP wards that the BWSSB-commissioned IISc Groundwater
          Outlook of Bengaluru City (April 2025) had named as
          critically over-extracted - Hebbal, Yelahanka, KR Puram,
          Koramangala, Vijayanagar, Kengeri, Nagarbhavi, Chamarajpet
          among them - are still over-extracted under whichever ward
          number the GBA has now assigned them.
        </p>
        <p>
          What is consistent through the four-century arc is that
          Bengaluru has always had to manufacture its water. There was
          no river. Kempe Gowda built the kere because he had to.
          K. Seshadri Iyer built Hesaraghatta because the cholera
          deaths had become embarrassing. BWSSB built Cauvery Stage I
          through V because the Arkavathi had been used up. What is
          different in 2026 is that the manufactured supply is
          inadequate to a city that grew faster than the engineering
          schedule. The kere - the original manufactured supply - are
          still there, mostly. Two hundred and seventy of them survive,
          on the GBA&apos;s most recent inventory, if you count
          generously. About a third of those survive as water. The
          ATREE crowdmap of remaining kere across Greater Bengaluru
          counts 1,350 if you go beyond BBMP and include the merged
          peri-urban districts.
        </p>
        <PullQuote attribution="The Ken, May 2026">
          Bengaluru doesn&apos;t have a water problem. It has a
          governance problem.
        </PullQuote>
        <ThenNow
          thenLabel="Earlier record"
          nowLabel="2024-2026 (our pipeline + cited sources)"
          rows={[
            {
              metric: "Functional kere in BBMP area",
              then: "~285 kere documented in 19th-century gazetteers; ~70-100 by 1973",
              now: "~70 still hold water; only 4 in good condition (IISc CES 105-lake survey)",
              verdict: "worse",
            },
            {
              metric: "Built-up area, Greater Bangalore",
              then: "1973 baseline (IISc Landsat analysis)",
              now: "+466% by 2007 (IISc CES); has grown further since",
              verdict: "worse",
            },
            {
              metric: "Wetland area, Greater Bangalore",
              then: "1973 baseline",
              now: "-58% by late 2000s (IISc CES)",
              verdict: "worse",
            },
            {
              metric: "BWSSB Cauvery WTP capacity",
              then: "0 MLD in 1974; 135 MLD with Stage I",
              now: "2,293 MLD installed across 6 WTPs (Stages I-IV + Stage V 775 design); ~1,500 MLD delivered (Stage V ~400 of 775)",
              verdict: "better",
            },
            {
              metric: "Non-revenue water (NRW)",
              then: "~40% in 1980s (BWSSB internal)",
              now: "36% audited 2017-18 (ISEC WP-505); down from ~48% (2017), BWSSB claims ~30% (unaudited)",
              verdict: "better",
            },
            {
              metric: "Per-capita water reaching consumer tap",
              then: "Design standard 150 LPCD (CPHEEO)",
              now: "108 LPCD average consumption (BWSSB, 2026); ISEC 106 LPCD (2017-18)",
              verdict: "worse",
            },
            {
              metric: "Median tanker price per load",
              then: "Rs 510 in 2015 (OpenCity)",
              now: "Rs 1,300 in 2024 (+155% nominal, OpenCity)",
              verdict: "worse",
            },
            {
              metric: "Apartment communities reliant on private tankers",
              then: "29.6% in 2015 surveyed sample",
              now: "95.6% in 2024 surveyed sample",
              verdict: "worse",
            },
            {
              metric: "Groundwater use (city-wide)",
              then: "~500 MLD per JICA Phase 3 Expert Committee (2017)",
              now: "~800 MLD extraction (IISc Outlook, 2024-25) to 1,392 MLD dependence (WELL Labs, 2021 balance) - method/year range, not a contradiction",
              verdict: "worse",
            },
            {
              metric: "IISc stress-ward count",
              then: "Not quantified before 2025",
              now: "65 BBMP wards critically over-extracted (IISc Groundwater Outlook, April 2025)",
              verdict: "worse",
            },
            {
              metric: "Bellandur Lake fires",
              then: "First fire May 2015; major fires 2017, 2018, 2021",
              now: "No recorded fires since 2021 (foam events recur sporadically)",
              verdict: "better",
            },
            {
              metric: "Buffer-zone legal regime around kere",
              then: "Routinely ignored pre-2018",
              now: "30 m perimeter / 50 m drains / 25 m canals (NGT in Forward Foundation, 2018)",
              verdict: "better",
            },
            {
              metric: "Tertiary treated sewage reuse",
              then: "~40 MLD pre-Stage-V (JICA Tables 6.3.3+4)",
              now: "~161 MLD across BWSSB TTP + KPTCL + Hebbal DBOT + RO bottled; TG Halli IPR pilot adds 110 MLD design",
              verdict: "better",
            },
            {
              metric: "Cascade interconnection (kere to kere)",
              then: "Already substantially broken by 1990s",
              now: "Still broken. Rajakaluves are now storm + sewer drains.",
              verdict: "same",
            },
          ]}
        />
        <p>
          The numbers in this dashboard are anchored on the
          engineering record the JICA Phase 3 Final Report (November
          2017) compiled, supplemented by the IISc Groundwater Outlook
          (April 2025), the WELL Labs Urban Water Balance (January
          2024), the OpenCity tanker surveys, and live India-WRIS CGWB
          telemetry. They tell the same story those archives have been
          telling, in different registers, for decades: Bengaluru does
          not have a water problem. It has a governance problem.
          Kempe Gowda&apos;s mother told him to build lakes and plant
          trees. He listened. We did the opposite. The work this
          dashboard tracks is whether the cascade Kempe Gowda built can
          be reconnected - not as nostalgia, but as the missing piece
          of a working sewerage system that ends at the lake instead of
          ending in the lake.
        </p>
        <CTA href="/bangalore">See today&apos;s live numbers</CTA>
        <CTA href="/bangalore/water-bodies">
          The surviving kere on the map
        </CTA>
        <CTA href="/bangalore/tanker">
          What households actually pay
        </CTA>
      </Chapter>
    </StoryPage>
  );
}
