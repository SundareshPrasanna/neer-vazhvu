/**
 * Surat water story - "The city the river made, unmade, and made again."
 * Composed from the Lede / Chapter / Figure / PullQuote / ThenNow / CTA
 * shortcodes.
 *
 * IMAGES: four Wikimedia Commons plates, licence verified against the Commons
 * API at download time (action=query&prop=imageinfo&iiprop=extmetadata) rather
 * than trusted from a search result. Provenance in
 * public/images/story/surat/MANIFEST.json, attribution rendered next to each
 * plate as well. One CC0 (the Rijksmuseum's c.1670 view of the harbour), one
 * public domain (van der Heen's 1782 view across the Tapti), one CC BY-SA 4.0
 * (Gopi Talav), one GODL-India (the PIB aerial survey of the 2006 flood).
 *
 * WHAT THIS STORY DOES NOT SAY, and why. Not one figure from the August 2006
 * flood appears anywhere below: not the peak discharge, not the share of the
 * city inundated, not the death toll, not the losses. Every one of those
 * currently traces to encyclopaedia entries, news coverage or advocacy reports
 * rather than to a primary record, and the house rule is that external numbers
 * are primary-source verified before publication. They are held for the
 * People's Committee on Gujarat Floods report and the Surat Citizens' Council
 * Trust report. The chapter is written around that absence rather than
 * pretending to it - which is, as it happens, the more honest version of the
 * chapter anyway.
 *
 * Source spine for verifiable claims:
 *   - SMC's own wardwise area and population table (1961-2011 census and after
 *     the June 2020 city-limit extension): 8 km2 across 12 wards growing to
 *     462.149 km2 across 134. In-repo cross-check: the nine zones in
 *     public/data/surat-zones.json sum to 461.64 km2 and their 2011
 *     populations to 4,645,384.
 *   - SMC, "Reuse of Treated Used Water: A Successful Model", 8 March 2024
 *     (CSE-hosted): 11 STPs at 1,726.50 MLD, ~1,018 MLD collected and treated,
 *     330 MLD reused, 3 TTPs producing 115 MLD for 249 industrial units,
 *     Rs 314.39 Cr capital, Rs 496.23 Cr cumulative revenue to January 2024,
 *     tariff Rs 18.20/KL (2014) rising to Rs 36.2/KL, targets of 70% by 2030
 *     and 100% with zero liquid discharge by 2035.
 *   - CPCB NWMP 2022, Table 9 (River Tapi), in-repo as
 *     public/data/river-quality-surat.json: conductivity 369-513 umhos/cm at
 *     Ukai rising to 1,537-49,720 at the ONGC bridge at Hazira, with BOD at or
 *     below detection limit at most Surat stations.
 *   - SMC's live rainfall and flood page, in-repo as
 *     public/data/surat-flood-chain.json: Ukai FRL 345 ft, causeway overflow
 *     6.0 m, and the five khadis with their published danger levels.
 *   - Founding of the city around Gopi's tank (1516) and the naming as
 *     Suryapur/Surat: Britannica and the standard histories. The 1613 English
 *     factory after the Battle of Swally, and the silting of the Tapi ceding
 *     the shipping to Bombay, likewise.
 *   - 1994 plague: the flood-and-waterlogging trigger, roughly a third of the
 *     city then covered by drainage, and S. R. Rao's 1995-96 reform. These are
 *     secondary-sourced and are stated qualitatively rather than numerically
 *     for that reason.
 *
 * English only; Gujarati follows in the i18n pass.
 */

import { StoryPage } from "@/components/story/story-page";
import { Chapter, CTA, Figure, Hero, Lede, PullQuote, ThenNow } from "@/components/story/story-shortcodes";

export function SuratStoryEn() {
  return (
    <StoryPage
      cityId="surat"
      cityDisplayName="Surat"
      tagline="The city the river made, unmade, and made again"
      lastRevised="August 2026"
    >
      <Hero
        src="/images/story/surat/surat-harbour-c1670.jpg"
        alt="A seventeenth-century painted view of the harbour at Surat, crowded with ships"
        source="Rijksmuseum, via Wikimedia Commons"
        credit="CC0"
      />

      <Lede>
        Surat begins with a tank. Around 1516 a man named Gopi dug one on the
        south bank of the Tapi and called the settlement around it Suryapur; the
        name shortened, and the city has been Surat ever since. Five hundred
        years later it is the fastest-growing large city in India, it sells its
        own sewage back to industry for more than a hundred crore a year, and it
        publishes the level of every creek running through it against the height
        at which that creek becomes dangerous. In between, the river that made it
        the richest port in Mughal India quietly filled its own harbour with
        silt and handed the trade to Bombay.
      </Lede>

      <Lede>
        Almost every city on this platform is a scarcity story. Surat is not.
        Surat impounds nothing, stores nothing, and has no meaningful drought
        anxiety. Its water question has always been the opposite one: not
        whether the water will come, but how much of it, and how fast.
      </Lede>

      <Chapter
        id="the-port"
        number={1}
        title="The port the river made"
        thesis="Surat's greatness was a hydrological accident, and so was its decline."
      >
        <p>
          Surat rose because another harbour failed. Khambhat, up the coast, had
          been Gujarat&apos;s great port until its harbour silted up towards the
          end of the fifteenth century; the trade moved south to the Tapi mouth,
          and Surat inherited it. Under Akbar, Jahangir and Shah Jahan it became
          the chief commercial city of India, with an imperial mint. It was the
          port from which pilgrims sailed for Mecca. In 1613, after the English
          broke Portuguese naval supremacy off Swally, the East India Company
          obtained a firman for a factory here, and the Dutch, French and
          Portuguese all followed.
        </p>
        <p>
          Then the river did to Surat exactly what it had done for it. The Tapi
          silted. By the middle of the nineteenth century larger vessels could
          not safely reach the city, and the shipping went to Bombay, which had
          the deeper and more accessible harbour. The Marathas came, and the
          Company&apos;s attention went south with the ships.
        </p>

        <Figure
          src="/images/story/surat/surat-from-the-tapti-1782.jpg"
          alt="An engraved view of Surat seen from across the River Tapti, dated 1782"
          caption="Surat from across the Tapti in 1782. By this date the river's silt had already begun sending the deep-draught shipping to Bombay."
          source="A. van der Heen, 1782, via Wikimedia Commons"
          credit="Public domain"
        />

        <PullQuote>
          The same silt that opened Surat&apos;s harbour by closing
          Khambhat&apos;s went on to close Surat&apos;s.
        </PullQuote>

        <p>
          It is worth sitting with that, because it sets the pattern for
          everything that follows. Surat has never controlled the water it
          depends on. The river gave it a harbour and took the harbour away. Four
          centuries later the same river gives it drinking water and takes the
          streets away, and the decision about how much arrives is still made
          somewhere upstream.
        </p>
      </Chapter>

      <Chapter
        id="the-tank"
        number={2}
        title="A city named after a water body"
        thesis="Surat's founding infrastructure was a tank, and the city has been building water infrastructure to catch up with itself ever since."
      >
        <p>
          Gopi Talav is still there, restored and landscaped, a rectangle of
          water in a city of six-lane roads. It is a useful place to stand,
          because it is roughly where Surat was in 1516, and you can see how far
          the city has travelled from it.
        </p>

        <Figure
          src="/images/story/surat/gopi-talav.jpg"
          alt="Aerial view of Gopi Talav, a large rectangular tank surrounded by the modern city"
          caption="Gopi Talav, dug around 1516. The city took its name from the settlement that grew around this tank."
          source="Ashvin29, via Wikimedia Commons"
          credit="CC BY-SA 4.0"
        />

        <p>
          The corporation&apos;s own wardwise table records the distance
          travelled with unusual precision. In 1961 Surat was{" "}
          <strong>8 square kilometres across 12 wards</strong>. Today it is{" "}
          <strong>462.149 square kilometres across 134</strong>, reached in six
          separate annexations, the most recent in June 2020. That is a
          fifty-fold expansion in sixty years, onto an estuarine flood plain,
          and it is the precondition for every flood story the city has had
          since.
        </p>
        <p>
          The figure survives an independent check, which is why we use it. The
          nine administrative zones SMC publishes through its own GIS sum to
          461.64 square kilometres, and their 2011 census populations sum to
          4,645,384. Two separate corporation surfaces, agreeing to within a
          tenth of a per cent.
        </p>
      </Chapter>

      <Chapter
        id="the-plague"
        number={3}
        title="What the drainage did in 1994"
        thesis="Surat's worst public health disaster was a water-management failure, and its recovery was a water-management reform."
      >
        <p>
          In September 1994 Surat had a plague outbreak. It started with
          flooding: water stood for days because the drainage could not take it
          away, sewers backed up into the standing water, and the city that had
          grown fifty-fold had drainage, piped water and garbage collection
          across roughly a third of itself. Tens of thousands of people left the
          city within days.
        </p>
        <p>
          What happened next is the part worth remembering. The municipal
          commissioner who arrived in 1995, S. R. Rao, treated it as an
          administrative problem rather than a medical one: decentralised
          decision-making into the zones, required officials to spend their
          mornings in the field rather than at desks, covered the drains, and
          enforced the sanitation rules that already existed. Within two years
          Surat was being described as one of the cleanest cities in India, and
          it has spent the three decades since near the top of that ranking.
        </p>
        <p>
          We state this qualitatively and without numbers, because the numbers
          for it live in news archives and retrospectives rather than in a
          primary record. The shape of the thing is not in doubt; the precise
          figures are not ours to assert.
        </p>

        <PullQuote>
          The disaster was drainage. So was the recovery.
        </PullQuote>
      </Chapter>

      <Chapter
        id="the-flood"
        number={4}
        title="August 2006, and the numbers we are not printing"
        thesis="Surat's defining flood is the one event about which we will not give you a figure."
      >
        <p>
          In August 2006 the Tapi came through Surat. Ukai dam, about a hundred
          kilometres upstream and operated by the state irrigation department
          rather than by the city, released water at a rate the channel through
          Surat could not carry. Most of the city went under. The sanitation
          system built after the plague is widely credited with how quickly the
          debris was cleared afterwards.
        </p>

        <Figure
          src="/images/story/surat/surat-flood-2006-aerial.jpg"
          alt="Aerial photograph of flooded Surat taken during an official survey on 11 August 2006"
          caption="Aerial survey of the flooded city, 11 August 2006."
          source="Press Information Bureau, Government of India, via Wikimedia Commons"
          credit="GODL-India"
        />

        <p>
          You will notice there are no figures in that paragraph. Not the peak
          discharge, not the share of the city inundated, not the death toll, not
          the losses. This is deliberate, and it is the most important sentence
          in this story.
        </p>
        <p>
          Every number in circulation for the 2006 flood traces back to
          encyclopaedia entries, contemporary news coverage, or the reports of
          citizens&apos; committees, rather than to a primary official record we
          have read. The figures are probably close to right. But this site&apos;s
          rule is that an external number is verified against a primary source
          before it is published, and a flood of this consequence is precisely
          the wrong place to make an exception, because it is precisely the place
          where a number will be quoted onward. Two documents would settle it:
          the report of the People&apos;s Committee on Gujarat Floods and the
          Surat Citizens&apos; Council Trust&apos;s report. Until we have read
          them, this chapter is a shape without a scale.
        </p>
        <p>
          What we can show is the footprint. The corporation&apos;s own GIS
          carries a depth-classed map of the 2006 inundation, and that map is on
          the flood page. The extent is the corporation&apos;s own record. The
          discharge is somebody else&apos;s number.
        </p>
      </Chapter>

      <Chapter
        id="the-chain"
        number={5}
        title="What Surat publishes now"
        thesis="After 1994 and 2006, Surat built the one thing no other Indian city on this platform publishes: a live warning chain with the thresholds attached."
      >
        <p>
          Go to the corporation&apos;s website today and you will find a plain
          HTML page, updated through the day, that carries four things at once:
          the level of Ukai dam with its inflow and outflow, the level of the
          weir-cum-causeway the city drinks from, rainfall for each zone, and the
          water level in five khadis - the tidal creeks that run through the
          middle of Surat.
        </p>
        <p>
          Any city might publish readings. What makes this page unusual is that
          every reading arrives{" "}
          <strong>with the number it is being measured against</strong>. Ukai is
          full at 345 feet. The causeway overflows at 6.0 metres. Kakara Khadi is
          dangerous at 8.48 metres, Bhedwad at 7.2, Mithi at 9.35, Bhatena at
          8.25, Simada at 4.50. The corporation is not merely telling you the
          level. It is telling you how much room is left.
        </p>
        <p>
          That is why this city&apos;s dashboard looks different from every other
          city&apos;s on this site. There is no days-of-water headline, because
          there is no stored water to divide - the weir pond is a stretch of
          river, and Ukai belongs to the state. Instead the dashboard shows the
          chain in the order the water travels it, and the distance to the
          threshold at each link. Every one of those thresholds is the
          corporation&apos;s figure, not ours. The only arithmetic we do is
          subtraction.
        </p>
        <p>
          There is one catch, and it is the reason this page began being archived
          the day this city was onboarded: SMC shows about ten readings and keeps
          no history. There is no archive, no dated URL, no interface. Whatever
          is not captured on the day is gone.
        </p>
      </Chapter>

      <Chapter
        id="the-reuse"
        number={6}
        title="The city that sells its sewage"
        thesis="Surat turned the waste stream into a revenue line, which is the most transferable thing about it."
      >
        <p>
          Surat is a textile city - several hundred dyeing and printing houses
          sit in the industrial estates at Pandesara and Sachin - and dyeing
          needs enormous volumes of water that do not need to be drinkable. In
          2014 the corporation opened a tertiary treatment plant at Bamroli that
          takes treated sewage, puts it through ultrafiltration and reverse
          osmosis, and sells it to those mills as industrial-grade water.
        </p>
        <p>
          By the corporation&apos;s own accounting in March 2024: eleven sewage
          treatment plants with a combined 1,726.50 MLD of capacity, about 1,018
          MLD of sewage collected and treated, and{" "}
          <strong>330 MLD reused</strong> - roughly a third - across eleven named
          uses. Three tertiary plants produce 115 MLD of that for 249 industrial
          units. The capital cost was Rs 314.39 crore; cumulative revenue to
          January 2024 was <strong>Rs 496.23 crore</strong>. The tariff started
          at Rs 18.20 a kilolitre in 2014 and now stands at Rs 36.2, indexed
          annually.
        </p>
        <p>
          The corporation has committed publicly to 70% reuse by 2030 and 100%
          with zero liquid discharge by 2035. Those two dates are in the
          commitments register on this site, with the slide they came from.
        </p>
        <p>
          A note on sourcing, because it matters here. Press coverage of this
          programme reports materially different figures - a different cumulative
          total and a different annual revenue. We use the corporation&apos;s own
          document and cite it, and where the press disagrees with the
          institution about the institution&apos;s own accounts, we take the
          institution.
        </p>
      </Chapter>

      <Chapter
        id="the-river-now"
        number={7}
        title="What the river is now"
        thesis="The Tapi's problem at Surat is salt, not sewage - which is not what you would guess."
      >
        <p>
          The obvious assumption about an Indian urban river is that the city
          poisons it: sewage in, dissolved oxygen down, biochemical oxygen demand
          up. Read CPCB&apos;s 2022 monitoring along the Tapi in order from Ukai
          to the sea and that is not what you find. BOD sits at or below the
          detection limit at most of the Surat stations. The river is not being
          organically loaded as it passes through the city, in the way the Musi
          is at Hyderabad or the Adi Ganga is at Kolkata.
        </p>
        <p>
          What climbs is conductivity - dissolved salt. It runs 369 to 513 at
          Ukai, 363 to 7,656 at Kathore just upstream of the city, and 1,537 to{" "}
          <strong>49,720</strong> at the ONGC bridge at Hazira, which is
          seawater. The city sits twenty kilometres from the Arabian Sea on a
          river whose flow is controlled upstream, and the sea comes up to meet
          it.
        </p>
        <p>
          That is a different problem with a different politics. It is not fixed
          by intercepting sewage. It is a question about how much freshwater is
          released from a dam the city does not operate, and when.
        </p>

        <ThenNow
          thenLabel="17th century"
          nowLabel="Today"
          rows={[
            {
              metric: "What the Tapi gives the city",
              then: "The richest harbour in Mughal India",
              now: "All of its drinking water, from one weir",
              verdict: "same",
            },
            {
              metric: "Who controls the flow",
              then: "The monsoon",
              now: "Ukai dam, operated by the state",
              verdict: "worse",
            },
            {
              metric: "The river's own threat",
              then: "Silt closing the harbour",
              now: "Salt climbing the estuary",
              verdict: "same",
            },
            {
              metric: "City area",
              then: "A walled town on one bank",
              now: "462.149 sq km across both",
              verdict: "same",
            },
            {
              metric: "Warning before a release reaches the city",
              then: "None",
              now: "Published hourly, against stated danger levels",
              verdict: "better",
            },
          ]}
        />
      </Chapter>

      <Chapter
        id="what-is-missing"
        number={8}
        title="What is still missing"
        thesis="The gaps in Surat's public record are specific, and most of them are one administrative decision away from closing."
      >
        <p>
          Surat&apos;s municipal GIS is the richest we have found on this
          platform: roughly 390 layers, including the entire water supply
          network, the entire sewerage network, ten depth slices of a groundwater
          resistivity survey, and the depth-classed footprint of the 2006 flood.
          It is public and it needs no login. But it will only draw you a
          picture. The setting that would let anyone download the boundaries
          themselves is switched off, which is why this site has no ward map for
          Surat and cannot build one. That is a single configuration change on
          the corporation&apos;s side.
        </p>
        <p>
          Three other absences are worth naming. Surat publishes no measured
          non-revenue water: the column that looks like one in the national open
          data release is a flat 20% assumption applied to every month, sitting
          next to another column that contradicts it. There is no register of
          which water bodies have been restored, or when, or for how much. And
          for a textile city, the effluent monitoring that exists - the pollution
          board&apos;s continuous feed, and the discharge monitoring at the
          Pandesara and Sachin common effluent plants - is not yet on this site.
        </p>
        <p>
          None of these are secrets. They are, mostly, things that exist inside
          the corporation and have not been published in a form anyone outside it
          can use.
        </p>
      </Chapter>

      <CTA href="/surat">See what Surat&apos;s water is doing today</CTA>
    </StoryPage>
  );
}
