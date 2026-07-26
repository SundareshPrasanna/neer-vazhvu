/**
 * Hyderabad water story - "The city that dammed its river to survive it, and
 * then stopped defending the water it had." Composed from the Lede / Chapter /
 * PullQuote / ThenNow / CTA shortcodes.
 *
 * IMAGES: four Wikimedia Commons plates, licence verified against the Commons
 * API at download time rather than trusted from a search result. Provenance in
 * public/images/story/hyderabad/MANIFEST.json, attribution rendered next to
 * each plate as well. Two are public domain (the Illustrated London News page
 * on the 1908 flood, and a 19th-century view of Mir Alam Tank showing the arch
 * dam); two are CC BY-SA 4.0 (Osman Sagar's retaining wall, the Musi at Purana
 * Pul).
 *
 * Source spine for verifiable claims:
 *   - Great Musi Flood of 1908 (Wikipedia, with contemporary references):
 *     ~59,000 houses damaged; 221 of the 788 tanks along the Musi breached.
 *   - Yunus Y. Lasania / The Hyderabad History Project and Siasat Daily on the
 *     1908 flood and its aftermath: Nizam VI Mahbub Ali Pasha summoned
 *     M. Visvesvaraya, then travelling in Italy; he joined as Special
 *     Consulting Engineer on 15 April 1909 and proposed impounding reservoirs
 *     "for temporarily impounding all floods in excess of what the river
 *     channel could carry". Osman Sagar begun 1913, completed 1918.
 *   - Mir Alam Tank (Wikipedia; Telangana Today "Rewind"): built 1804-1806,
 *     21 semicircular masonry arches, ~1.5 km, planned in the circle of
 *     Michel Joachim Marie Raymond. NOTE: the frequently repeated claim that
 *     it is the world's first multiple-arch dam is NOT asserted here - it is
 *     not supported by the sources consulted.
 *   - Hussain Sagar: excavated 1562, completed 1563, reign of Ibrahim Quli
 *     Qutb Shah, on a tributary of the Musi.
 *   - HMWSSB daily reservoir statement, 2014-2026 archive (in-repo, scraped by
 *     neer-vazhvu-api/scripts/scrape_hmwssb_reservoirs.py). Every draw figure,
 *     the 136% growth, and the GO 111 twin-share series are computed from it.
 *   - HMDA gazetted lake register (in-repo): 2,978 lakes, 1,352 finally
 *     notified, district breakdown.
 *   - HMWSSB tanker bookings via OpenCity (in-repo): 1,316,215 bookings,
 *     201 sections, Jan 2022 - Feb 2024.
 *   - GHMC nala layer via OpenCity (in-repo): 96 nalas, 245 km, encroachment
 *     columns published empty.
 *   - GO 111 repeal: 84 villages / 1.32 lakh acres, Telangana cabinet 2022
 *     (news-sourced; the GO itself is an outstanding fetch).
 *
 * Figures NOT used anywhere in this story because they are news-sourced only
 * and mutually inconsistent: HMWSSB's service-area size, population served,
 * total supply in MLD, and every published STP count. See
 * docs/cities/hyderabad/data-sources.md.
 *
 * English only; Telugu follows in the i18n pass.
 */

import { StoryPage } from "@/components/story/story-page";
import { Chapter, CTA, Figure, Hero, Lede, PullQuote, ThenNow } from "@/components/story/story-shortcodes";

export function HyderabadStoryEn() {
  return (
    <StoryPage
      cityId="hyderabad"
      cityDisplayName="Hyderabad"
      tagline="City of tanks - how Hyderabad engineered its way out of a flood, and what it still owes that system"
      lastRevised="July 2026"
    >
      <Hero
        src="/images/story/hyderabad/osman-sagar-retaining-wall.jpg"
        alt="The masonry retaining wall of Osman Sagar reservoir at Gandipet, curving away from a pavilion at the near end, with the spillway channel and water to the right."
        source="Wikimedia Commons"
        credit="iMahesh, CC BY-SA 4.0"
      />
      <Lede>
        On the night of 28 September 1908 the Musi rose through Hyderabad and
        took roughly fifty-nine thousand houses with it. Upstream, of the 788
        tanks strung along the river, 221 breached - the cascade that had
        watered the city for three centuries failing link by link, each
        collapse feeding the next. The Nizam sent for an engineer. M.
        Visvesvaraya, then travelling in Italy, joined the Hyderabad government
        as Special Consulting Engineer in April 1909 and gave an answer that was
        less about water supply than about survival: build reservoirs upstream
        large enough to hold back &quot;all floods in excess of what the river
        channel could carry&quot;. Osman Sagar was begun in 1913 and finished in
        1918; Himayat Sagar followed. Hyderabad dammed its river so that the
        river would stop killing it. A century later those two lakes supply
        about six per cent of the city&apos;s water, the rest is lifted from the
        Krishna and the Godavari a hundred and more kilometres away, and of the
        2,978 lakes in the metropolitan region, 1,626 have no legally settled
        boundary at all.
      </Lede>

      <Chapter
        id="tank-city"
        number={1}
        title="A city assembled out of tanks"
        thesis="Hyderabad was not built beside water. It was built out of water it made."
      >
        <p>
          The Deccan plateau gives a city granite and a monsoon and very little
          else. There is no perennial river of consequence here, no snowmelt, no
          delta. What Hyderabad&apos;s founders had instead was gradient, and
          they used it the way the Deccan always has: by cutting bunds across
          every seasonal drainage line and catching the rain where it fell.
        </p>
        <p>
          The vocabulary survives in the map. A <em>cheruvu</em> is a tank, a{" "}
          <em>kunta</em> a pond, a <em>sagar</em> a lake grand enough to be
          named for a ruler. Hussain Sagar, excavated in 1562 and completed the
          following year under Ibrahim Quli Qutb Shah, was dug on a tributary of
          the Musi more than two decades before Hyderabad itself was founded -
          the water came first, the city afterwards. Two and a half centuries
          later, between 1804 and 1806, Mir Alam Tank went up on twenty-one
          semicircular masonry arches running about a kilometre and a half, a
          piece of engineering ambitious enough that its design is still argued
          over.
        </p>
        <p>
          These were not ornaments. They were a machine with many parts, and the
          parts were connected: overflow from one tank fed the next, and the
          chain ended in the Musi. That is why the 1908 flood reads the way it
          does in the record. It was not simply that a great deal of rain fell.
          It was that 221 of 788 tanks gave way in sequence, and a system built
          to slow water down spent one night doing the opposite.
        </p>
      </Chapter>

        <Figure
          src="/images/story/hyderabad/mir-alam-tank-historic.jpg"
          alt="Nineteenth-century view of Mir Alam Tank near Hyderabad, showing the curved masonry dam running across the foreground in a series of linked semicircular arches, with the tank water and hills beyond."
          caption="Mir Alam Tank, built 1804-06 across a tributary of the Musi. The dam is a chain of semicircular masonry arches roughly 1.5 km long - the engineering idea the city had been using at smaller scale for three centuries, executed at its largest. It still holds water inside the zoo that now surrounds it."
          credit="J. F. Hurst"
          source="Wikimedia Commons (public domain)"
          aspect="3/4"
          fit="contain"
          size="wide"
        />

      <PullQuote>
        The tanks did not fail because they were old. They failed because they
        were a system, and a system fails the way it is connected.
      </PullQuote>

      <Chapter
        id="the-twins"
        number={2}
        title="The two lakes built to hold back a river"
        thesis="Osman Sagar and Himayat Sagar were flood control first. Drinking water was the second use."
      >
        <p>
          Visvesvaraya&apos;s brief in 1909 was not to find Hyderabad more
          water. It was to make sure the Musi could never again arrive in the
          city all at once. The reservoirs he proposed sat upstream on the Musi
          and on its tributary the Esi, sized to absorb a flood peak rather than
          to serve a population. Osman Sagar, begun in 1913 and completed in
          1918, is still the largest water body in the city at roughly 1,810
          hectares; Himayat Sagar, on the Esi, is about 1,492. Hussain Sagar,
          for scale, is 456.
        </p>
        <p>
          Because they were built for floods, they were also protected as
          catchments - and that protection outlived the Nizams. In 1996 a
          government order numbered 111 barred major construction across
          eighty-four villages and roughly 1.32 lakh acres in the catchment of
          the two lakes. It was one of the strongest pieces of urban water
          protection in the country, and for twenty-six years it held a
          development-shaped hole in the map of a city expanding in every
          direction.
        </p>
        <p>
          In 2022 Telangana repealed it. The stated reason was that Hyderabad
          had moved on: its water now came from the Krishna and the Godavari,
          and the twin reservoirs no longer mattered enough to justify freezing
          eighty-four villages.
        </p>
        <Figure
          src="/images/story/hyderabad/musi-flood-1908.jpg"
          alt="Page from The Illustrated London News, 24 October 1908, headed 'A city crushed by a wall of water: wrecked Hyderabad, after the flood in which many thousands perished'. Six photographs show the wrecked Afzal bridge with the city gate and clock-tower, wreckage in the grounds of the flooded British Residency, the Nizam's troops clearing debris, the ruins of the bridge linking the Residency to Hyderabad, the interior of the Residency, and the remains of a nobleman's palace."
          caption="The Illustrated London News of 24 October 1908, four weeks after the flood: 'A city crushed by a wall of water.' The wrecked Afzal bridge appears twice, top left and centre right - it carried the link between the British Residency and the city. This is the event that produced Osman Sagar and Himayat Sagar, and the reason both were built as flood control first and water supply second."
          credit="The Illustrated London News, 24 October 1908"
          source="Wikimedia Commons (public domain)"
          aspect="3/4"
          fit="contain"
          size="wide"
        />
      </Chapter>

      <Chapter
        id="the-long-lift"
        number={3}
        title="The long lift"
        thesis="As the city outgrew its own rain, it reached further and further out - and the daily draw more than doubled in twelve years."
      >
        <p>
          The board publishes, every day, how much water it took from each of
          its sources. That is unusual - most Indian utilities publish a design
          capacity and leave the actual draw to inference - and it means
          Hyderabad&apos;s growth can be measured rather than estimated.
        </p>
        <ThenNow
          thenLabel="2014"
          nowLabel="2026 (to 25 Jul)"
          rows={[
            {
              metric: "Mean daily draw, all sources",
              then: "1,117 MLD",
              now: "2,636 MLD",
              verdict: "worse",
            },
            {
              metric: "Osman Sagar + Himayat Sagar share",
              then: "11.06%",
              now: "6.54%",
              verdict: "same",
            },
            {
              metric: "Days the twin reservoirs were drawn on",
              then: "365 of 365",
              now: "206 of 206",
              verdict: "same",
            },
          ]}
        />
        <p>
          A 136 per cent increase in twelve years, and almost none of it came
          from the Musi. On 25 July 2026 the board drew 2,659 million litres. Of
          that, 1,253 came from Akkampally - a balancing reservoir on the
          Krishna, fed from Nagarjuna Sagar - and another 737 from Sripada
          Yellampally on the Godavari, about two hundred kilometres to the
          north. Singur and the Manjira barrage supplied 499 between them. Osman
          Sagar and Himayat Sagar, the two lakes the city was reorganised
          around, supplied 170.
        </p>
        <p>
          So the government&apos;s 2022 argument was not invented. In 2018 the
          twins supplied nothing at all - not on a single day of the year. In
          2016 and 2017 they ran fewer than half the days, at under one per cent
          of the city&apos;s draw. Anyone reading the ledger then would have
          reasonably called them spent.
        </p>
        <p>
          But the ledger kept being written. The twins have been drawn on every
          single day since 2020. Their share has risen every year since 2023 -
          3.25 per cent, then 4.31, then 6.32, and 6.54 so far in 2026. In
          absolute terms 2026 is the highest year in the entire record, above
          even 2014. Whether the repeal caused that or merely coincided with it
          is not something the daily statement can answer. What it can say is
          that the premise has been getting less true every year since the order
          was signed.
        </p>
      </Chapter>

      <PullQuote>
        The order was repealed because the lakes did not matter. Every year
        since, they have mattered more.
      </PullQuote>

      <Chapter
        id="the-unfinished-boundary"
        number={4}
        title="The boundary that was never drawn"
        thesis="Hyderabad's water problem is no longer scarcity. It is that the lines around its water are unfinished, and the columns meant to record what crosses them are blank."
      >
        <p>
          Every lake in the metropolitan region is supposed to have its Full
          Tank Level fixed twice: a preliminary notification, then a final one
          once objections have been heard. Until the final notification issues,
          there is no boundary a court can be pointed at. All 2,978 lakes in
          HMDA&apos;s register have the preliminary. Only 1,352 have the final.
        </p>
        <p>
          The gap is not spread evenly. Rangareddy district holds the largest
          lake estate in the region, 891 lakes, and has among the weakest
          coverage: 34.5 per cent finally notified, against 68.0 in Siddipet and
          66.7 in Hyderabad district. Rangareddy is the Outer Ring Road corridor
          - Gachibowli, Kokapet, Manikonda, the land under the heaviest
          development pressure in the state. The lakes with the most valuable
          ground around them are the lakes whose edges are least settled.
        </p>
        <p>
          Something did change recently. Final notifications ran at 152 in 2016
          and then effectively stopped - ten, sixty, two, three, two across the
          next seven years. Then 533 in 2024 and 533 again in 2025, which is
          two-thirds of every final notification ever issued, arriving in
          twenty-four months. That surge coincides with the creation of HYDRAA,
          the agency set up in 2024 to protect lakes and clear encroachments.
          The register is being finished, late and fast.
        </p>
        <p>
          The drains tell a thinner story. GHMC maps 96 named nalas running 245
          kilometres, and its own data layer defines exactly the fields the
          flooding debate needs: encroachments per drain, separated into
          government, private and religious, with a count of how many are in
          court. All five fields are published as zero, for all 96 drains. In a
          city that created an agency to demolish encroachments and has been
          demolishing them since, that is an empty column rather than a clean
          record - and because the city has already specified the schema, it is
          an unusually precise thing to ask it to fill.
        </p>
        <p>
          Meanwhile the demand shows up where the map is newest. Across 1.32
          million tanker bookings, the heaviest are not in the old city but in
          Madhapur, Kondapur and Hafeezpet, then Gachibowli, Manikonda,
          Nizampet - the IT corridor, plus Banjara Hills and Jubilee Hills. It
          is the same geography as the unfinished lake boundaries. The city
          grew faster than its pipes, and where the pipes have not arrived, the
          tankers have.
        </p>
      </Chapter>

        <Figure
          src="/images/story/hyderabad/musi-purana-pul.jpg"
          alt="The Musi river at Purana Pul, Hyderabad. A long arched stone bridge crosses the frame with shelters and shops built along its parapet; the water below carries visible debris along its edge."
          caption="The Musi at Purana Pul. This is the reach the interception programme covers between Bapu Ghat and Gowrelly, and the one the riverfront programme is being built along. CPCB's monitoring puts dissolved oxygen at or below 0.5 mg/L through the city every year from 2019 to 2024."
          credit="Kavali Chandrakanth KCK"
          source="Wikimedia Commons (CC BY-SA 4.0)"
          aspect="3/2"
        />

      <CTA href="/hyderabad">
        Every figure in this story is computed from sources you can open -
        HMWSSB&apos;s daily reservoir statement going back to 2014, HMDA&apos;s
        lake register, and GHMC&apos;s own drain and tanker data. Where a number
        is missing or a column is blank, the pages say so. See the daily record.
      </CTA>
    </StoryPage>
  );
}
