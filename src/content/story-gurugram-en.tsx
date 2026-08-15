/**
 * Gurugram water story - "The city that outgrew its water in twelve years."
 *
 * Source spine for verifiable claims - all in-repo or primary:
 *   - GMDA OneMap (in-repo harvest, ArcGIS REST): the MCG municipal limit at
 *     1985 / 1996 / 2008 / 2010 / 2015 / 2020; the 824-feature NGT water-body
 *     register with GMDA's own cross-survey flags; 36 MCG wards; 524 municipal
 *     tubewells; 95 underground tanks; the two WTPs and their capacities
 *   - IN-GRES 2024-25 (in-repo, gwr-blocks-gurugram.json): district 194.59%,
 *     GURGAON_URBAN 326.26%, all five blocks over-exploited, Jhajjar safe,
 *     Haryana 136.75%
 *   - GMDA Water Tanker MIS 2019 / 2020 / 2021 (in-repo,
 *     gurugram-tanker-sales.json): 29,284 bookings, 1.72 billion litres,
 *     Rs 8.72 crore, the three-tier tariff and the composition shift
 *   - HSPCB STP monitoring, edition dated 17.07.2026: 18 Gurugram plants with
 *     commissioning dates and owning agency
 *   - CSE / Down To Earth, "Gurgaon: The Water-Waste Portrait" (October 2011):
 *     the pre-2011 supply chain, Kakroi headworks, the NCR channel
 *   - CGWA: Gurugram notified a dark zone, 2008
 *
 * NUMBERS THAT ARE DERIVED, NOT PUBLISHED - flagged in the prose too. The
 * municipal-limit AREAS are computed from GMDA's boundary geometry with a
 * local equal-area approximation. GMDA publishes the boundaries, not the
 * areas. The ratios are sound; the absolutes are ours and are described that
 * way. Replace them if GMDA publishes its own figures.
 *
 * NO IMAGES, deliberately. Every other city story carries a Hero and Figures
 * with licence provenance recorded in a MANIFEST.json beside the files. No
 * licence-cleared photograph of Gurugram's water infrastructure has been
 * sourced yet, and inventing provenance would be worse than running text-only.
 * The images are a known gap, not an oversight.
 *
 * English-only; Hindi follows in the i18n pass.
 */

import { StoryPage } from "@/components/story/story-page";
import { Chapter, CTA, Lede, PullQuote, ThenNow } from "@/components/story/story-shortcodes";

export function GurugramStoryEn() {
  return (
    <StoryPage
      cityId="gurugram"
      cityDisplayName="Gurugram"
      tagline="The city that outgrew its water in twelve years"
      lastRevised="August 2026"
    >
      <Lede>
        Gurugram has no river. It has no reservoir, no dam, and no water it
        impounds itself. What it has is a canal that brings the Yamuna across
        the plain, an aquifer it has been draining since before it was called
        Gurugram, and a market in tanker loads that covers the difference. In
        1985 the municipal limit enclosed about twenty square kilometres. By
        2020 it enclosed close to three hundred. The water did not scale with
        the boundary, and the arithmetic of that gap is the whole story.
      </Lede>

      <Chapter
        id="before"
        number={1}
        title="A town on a seasonal river"
        thesis="Before the glass towers, Gurgaon was a district town on the Sahibi, drinking from village ponds and johads."
      >
        <p>
          The Sahibi rises in the Aravalli in Rajasthan and runs north-east
          across Haryana toward the Yamuna. It is seasonal, and it has been
          dammed and diverted upstream for decades, so it now reaches Gurugram
          rarely and reaches Delhi as a drain. Around it, the older water system
          was small and local: village ponds, johads catching Aravalli runoff,
          and open wells.
        </p>
        <p>
          That system is still legible in the revenue record. GMDA&apos;s own
          water-body register carries a flag for every body it can match to the
          1956 record of rights, and 283 of the 824 bodies in the register match
          one. They are mostly not municipal property even now: 392 belong to
          gram panchayats and 208 are privately held, against 62 owned by the
          corporation.
        </p>
        <p>
          In 1985 the municipal limit covered roughly 20 square kilometres. By
          1996, after eleven years, it covered roughly 21. For practical
          purposes the town did not grow at all.
        </p>
      </Chapter>

      <Chapter
        id="the-jump"
        number={2}
        title="Twelve years, eight times the ground"
        thesis="Between 1996 and 2008 the municipal limit went from about 21 square kilometres to about 164. The Central Ground Water Authority declared Gurugram a dark zone in the same year that expansion finished."
      >
        <p>
          The boundary GMDA publishes for 2008 encloses roughly 164 square
          kilometres. The one it publishes for 1996 encloses roughly 21. In
          twelve years the city took in nearly eight times the ground it had
          held for the previous eleven. It kept going after that: about 204
          square kilometres by 2010, 231 by 2015, 297 by 2020.
        </p>
        <p>
          These areas are ours, not GMDA&apos;s. The authority publishes the
          dated boundaries; we measured what they enclose. The proportions are
          what matter and they are not in doubt.
        </p>
        <PullQuote attribution="Central Ground Water Authority, notification, 2008">
          In 2008, the year the municipal limit finished growing eightfold, the
          Central Ground Water Authority declared Gurugram a dark zone.
        </PullQuote>
        <p>
          The two facts belong together. A dark-zone notification is a statement
          that extraction has passed what the aquifer replaces, and it arrived
          exactly as the city finished drawing the lines it intended to build
          inside. What followed was construction on that new ground, and the
          water for it came from below.
        </p>
      </Chapter>

      <Chapter
        id="the-aquifer"
        number={3}
        title="Three times what comes back"
        thesis="Every one of the district's five assessment blocks is over-exploited. The built city is the worst of them."
      >
        <p>
          The current picture comes from IN-GRES, the official CGWB and state
          assessment. In 2024-25 Gurugram district extracted{" "}
          <strong>194.59% of its annual recharge</strong>. That is the number
          that circulates in write-ups about the city as &quot;about 195
          percent&quot;, usually with nothing behind it; this is where it comes
          from.
        </p>
        <p>
          Broken into blocks it is worse and more specific. The built city,
          which the assessment calls Gurgaon Urban, stands at{" "}
          <strong>326.26%</strong>. Pataudi is at 168.48, Sohna at 156.86,
          Farrukh Nagar at 143.39, and rural Gurgaon at 106.91. All five are
          over-exploited. Haryana as a whole is at 136.75.
        </p>
        <p>
          The neighbours are what make it legible as a local failure rather than
          a regional condition. Rewari and Faridabad are also over-exploited and
          Palwal is critical, but Nuh is only semi-critical and{" "}
          <strong>Jhajjar, immediately north-west, is safe</strong>. The same
          aquifer system, the same rainfall, a different amount of city on top
          of it.
        </p>
        <p>
          What the platform cannot show is how deep the water actually is. The
          India-WRIS level record for this district covers 37 stations and stops
          in June 2020, and Haryana&apos;s telemetry network does not include
          Gurugram at all. For a city whose defining problem is groundwater,
          nobody is publishing a current measured depth.
        </p>
      </Chapter>

      <Chapter
        id="the-ponds"
        number={4}
        title="What happened to the ponds"
        thesis="Most of Gurugram's water bodies are outside the corporation that would be blamed for them."
      >
        <p>
          GMDA maintains a register of 824 water bodies, built for the National
          Green Tribunal, covering about 2,851 acres. It carries the
          authority&apos;s own cross-survey attribution: for each body, whether
          it appears in the 1956 record of rights, the 1976 Survey of India
          sheets, 2012 satellite imagery, drone survey and Google Earth.
        </p>
        <p>
          Of the 283 bodies traceable to a 1956 revenue plot,{" "}
          <strong>29 are absent from the 2012 satellite pass</strong>. That is a
          floor rather than a total, because a pond that vanished before 2012
          would not be a row in a 2012-derived register at all.
        </p>
        <p>
          The raw counts across the three vintages are 640 for 1956, 519 for
          1976 and 824 for 2012, and they must not be read as a series. The
          number goes up at the end because three survey methods have three
          inclusion criteria, and a satellite pass picks up construction pits
          and seasonal water that a revenue clerk never listed.
        </p>
        <PullQuote attribution="Derived from GMDA's NGT water-body register">
          Only 163 of the 824 water bodies sit inside the municipal
          corporation&apos;s boundary. 454 sit inside GMDA&apos;s wider
          metropolitan area.
        </PullQuote>
        <p>
          That split matters for who answers for them. The corporation people
          petition is responsible for a fifth of the register.
        </p>
      </Chapter>

      <Chapter
        id="the-tankers"
        number={5}
        title="The market in the gap"
        thesis="For three years GMDA published every tanker load it sold, and the record shows a city quietly moving off drinking water."
      >
        <p>
          Gurugram is one of very few Indian cities where the authority sells
          bulk water by the tanker and published the transaction log. For 2019,
          2020 and 2021 GMDA put out a booking record covering{" "}
          <strong>29,284 loads and 1.72 billion litres</strong>, worth about Rs
          8.72 crore. It names the buyers, and they are almost entirely
          developers, contractors and industry: DLF, Shapoorji Pallonji, Tata
          Projects, Godrej, Candor, Lenskart, Honeywell.
        </p>
        <p>
          It sold three grades at three prices, and the prices did not move
          across the three years: drinking water at Rs 70.50 a kilolitre,
          recycled water at Rs 30, and treated effluent from the common effluent
          plant at Rs 8. Drinking water cost nearly nine times what the treated
          alternative cost.
        </p>
        <p>
          The volume falls across the three years, from 12,337 loads to 7,208,
          and that should not be read as falling dependence: this is a
          construction-driven market and 2020 and 2021 were COVID years. What
          does survive is the mix, because it is a ratio inside the same
          disrupted period. The non-potable share of every litre GMDA sold went
          from <strong>29.7% in 2019 to 42.2% in 2020 to 51.2% in 2021</strong>.
          Potable volume fell by roughly two thirds while treated and recycled
          volume held flat.
        </p>
        <p>
          Over three years, in a dark-zone city, the authority moved the
          majority of its bulk tanker water off the drinking supply and onto
          treated effluent. The series stops after 2021.
        </p>
      </Chapter>

      <Chapter
        id="downstream"
        number={6}
        title="Gurugram is Delhi's problem too"
        thesis="What the city does not drink leaves north, into the Najafgarh jheel and then into the Yamuna."
      >
        <p>
          Gurugram&apos;s treated and untreated flow leaves the city northward
          toward the Najafgarh jheel, a transboundary wetland on the
          Delhi-Haryana line, and from there into the Najafgarh drain, which is
          the single largest contributor of pollution to the Yamuna in Delhi.
          The drain is the Sahibi, under another name.
        </p>
        <p>
          The jheel has been awaiting formal wetland notification for over a
          decade while the two states disagree about the land, and the National
          Green Tribunal has directed both to implement a joint management plan.
          Gurugram sits upstream of all of it.
        </p>
        <p>
          On the treatment side, the state pollution board lists 18 sewage
          treatment plants in the district, from GMDA&apos;s large Dhanwapur and
          Behrampur units down to seven one-megalitre village plants
          commissioned in February 2021. Their combined output is the water the
          tanker market has been quietly substituting in.
        </p>
      </Chapter>

      <ThenNow
        thenLabel="1985-1996"
        nowLabel="Today"
        rows={[
          {
            metric: "Municipal limit (derived from GMDA boundaries)",
            then: "~20-21 sq km",
            now: "~297 sq km",
            verdict: "worse",
          },
          {
            metric: "Groundwater status",
            then: "Not notified",
            now: "Dark zone since 2008; 194.59% of recharge",
            verdict: "worse",
          },
          {
            metric: "Built city block (Gurgaon Urban)",
            then: "Not separately assessed",
            now: "326.26% of recharge, over-exploited",
            verdict: "worse",
          },
          {
            metric: "Treatment capacity",
            then: "Village ponds, wells and johads",
            now: "572 MLD across two canal-fed plants",
            verdict: "better",
          },
          {
            metric: "Non-potable share of GMDA tanker sales",
            then: "29.7% (2019)",
            now: "51.2% (2021)",
            verdict: "better",
          },
          {
            metric: "Published measured water depth",
            then: "Manual station record",
            now: "Nothing since June 2020",
            verdict: "worse",
          },
        ]}
      />

      <CTA href="/gurugram/groundwater">
        See the block-level extraction assessment
      </CTA>
    </StoryPage>
  );
}
