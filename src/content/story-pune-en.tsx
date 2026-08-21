/**
 * Pune water story - "The city that dammed one river four times and still
 * counts four hours." Composed from the Hero / Lede / Chapter / Figure /
 * PullQuote / ThenNow / CTA shortcodes, following the Chennai pattern.
 *
 * Image slots reference /public/images/story/pune/* - the manifest lives in
 * MANIFEST.json next to the images, and records the two images we checked and
 * REJECTED as well as the two we ship. Every Figure passes a `source` and a
 * `credit`; we do not ship images without provenance.
 *
 * SOURCE SPINE for every verifiable claim. All in-repo or primary:
 *   - PMC Draft Environment Status Report 2025-26 (in-repo, via
 *     pune-supply-overview.json): the water budget (21.030 TMC required
 *     against 16.36 sanctioned, 32% NRW = 6.730 TMC), 1,681.5 MLD of
 *     abstraction, 1,854 MLD of treatment across 18 plants, ~2,600 km of
 *     mains, the four-hour service level reprinted for four years, the
 *     equitable-supply project at Rs 2,818.46 cr with Rs 1,557.89 cr spent
 *     and 35 of 82 tanks commissioned, 980 MLD of sewage against 477 MLD of
 *     operating capacity, and the boundary table (147.58 -> 478.29 sq km)
 *   - MWRRA Order in Case 14 of 2018 and Order 01/2025 (in-repo, same
 *     artifact): the 2005 High Power Committee reservation, the 1 Mar 2013
 *     agreement, the PDRO's 8.19 TMC of 23 Oct 2017, the 13 Dec 2018
 *     restoration and the "deprived of their share" finding, the
 *     Khadakwasla Complex's 33.77 TMC / 22.55 TMC irrigation split, PMC's
 *     recorded use 2011-12 to 2017-18, and the 19 May 2025 remittal
 *   - IN-GRES 2019-20 to 2025-26 (in-repo, gwr-blocks-pune.json): Shirur
 *     critical in all six editions, the district's 63.73% SAFE aggregate,
 *     the per-taluka rainfall gradient, agriculture's share of extraction
 *   - CPCB, Polluted River Stretches (Updated Version), October 2025
 *     (in-repo, river-quality-pune.json): the priority classes, and
 *     Annexure XIV's 2024 BOD - 4.1 mg/L at Khadakwasla dam, 102.5 at
 *     Bopodi, and the national ranking of that figure
 *   - Maharashtra WRD Pravah daily bulletin + CWC NRLD-2019 (in-repo,
 *     pune-dam-storage.json): the four chain capacities and their sum
 *   - OpenCity / PMC STP layer (in-repo, pune-stps.geojson): 9 existing
 *     plants at 477 MLD, 11 proposed at 396 MLD
 *
 * TWO CLAIMS THAT ARE NOT OURS AND ARE LABELLED AS SUCH IN THE PROSE:
 *   - The 1961 Panshet death toll. The Government of Maharashtra's own
 *     current Pune District Disaster Management Plan states that no official
 *     count exists. The story says that, and does not substitute the
 *     circulating figure.
 *   - Borewell extraction. PMC publishes none; ACWADAM's 2019 appraisal
 *     estimates ~4 TMC/yr. Carried as a research estimate, never as a
 *     measurement.
 *
 * DAM COMMISSIONING YEARS are given only where CWC's two register editions
 * agree, or are given as a range where they do not (NRLD-2019 vs NRLD-2023
 * disagree on Panshet, Warasgaon, Temghar and Bhama Askhed). Khadakwasla's
 * 1879/1880 is the one worth naming and the editions differ by a year.
 *
 * English-only; Marathi follows in the i18n pass (native review pending),
 * matching the Kolkata, Mumbai, Delhi and Gurugram launch posture.
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

export function PuneStoryEn() {
  return (
    <StoryPage
      cityId="pune"
      cityDisplayName="Pune"
      tagline="The city that dammed one river four times and still counts four hours"
      lastRevised="August 2026"
    >
      <Hero
        src="/images/story/pune/mula-mutha-bund-garden-c1875.jpg"
        alt="An oval-vignetted albumen print mounted on card, captioned in period lettering 'The Fitzgerald Bridge, Bund Gardens &amp; River shewing the Bund. Poona.' A stone balustrade and the arched crest of the bund cross the foreground; behind them the Mula-Mutha widens into the pool the bund holds, with wooded banks to the left and low hills on the far shore."
        source="Rijksmuseum, Amsterdam (RP-F-00-6379) via Wikimedia Commons"
        credit="Unknown photographer, ca. 1875-1900 (CC0)"
      />
      <Lede>
        The bund in that photograph is the point. Someone built a masonry weir
        across the Mula-Mutha in the middle of the nineteenth century because
        the river, left alone, did not hold a pool worth looking at through the
        dry months. Pune sits at the eastern edge of the Western Ghats, where
        the rain stops. Its own catchment gets a great deal of water for four
        months and very little for eight, so the city&apos;s entire hydraulic
        history is a history of holding: a weir, then a dam, then three more
        dams above it, then a canal to carry what the dams held out to the
        farmland east of the city. Today those four dams hold{" "}
        <strong>29.15 thousand million cubic feet</strong> between them. The
        average Punekar gets water for <strong>four hours a day</strong>. Both
        of those numbers come from Pune Municipal Corporation, and the distance
        between them is what this story is about.
      </Lede>

      <Chapter
        id="a-river-that-had-to-be-held"
        number={1}
        title="A river that had to be held"
        thesis="Pune's water problem is not that it is dry. It is that its water arrives in four months and its rain gradient collapses within a single district."
      >
        <p>
          The two rivers meet in the middle of the city. The Mula comes down
          from Mulshi in the west, the Mutha from the hills behind Temghar, and
          they join at the Sangam near what is now Sangamwadi. Below the
          confluence the combined Mula-Mutha runs east and eventually reaches
          the Bhima, and through it the Krishna.
        </p>
        <p>
          What makes this district unusual is not the rivers but the gradient
          across them. The national groundwater assessment publishes a rainfall
          figure for every taluka in Pune district, and in the same year those
          figures run from <strong>2,182 mm at Velhe</strong>, up in the Ghats,
          to <strong>468 mm at Indapur</strong> in the east. That is a
          <strong> 4.7-fold spread inside one district</strong>. The wet end is
          where the dams sit. The dry end is where their canal goes. Almost
          every argument Pune has about water is an argument between those two
          ends of the same district.
        </p>
        <p>
          The city itself sits in between, and closer to the dry end than most
          people assume: IMD&apos;s Shivajinagar observatory normal is about 841
          mm a year - well under half of what the assessment records for Velhe,
          which is a little over thirty kilometres to the west.
        </p>
        <Figure
          src="/images/story/pune/poona-1911-map.jpg"
          alt="A 1911 survey map of Poona and its cantonment, showing the Mula and Mutha rivers converging, the walled city west of the confluence, the cantonment east of it, and the canal running out to the south-east."
          caption="Poona in 1911: thirty-one years after Khadakwasla was completed, fifty years before Panshet failed. The Mula and the Mutha meet near the top of the sheet. Almost everything PMC supplies today is off the edge of this map."
          source="John Murray, A handbook for travellers in India, Burma, and Ceylon (1911), p.537, via Internet Archive Book Images / Wikimedia Commons"
          credit="No known copyright restrictions"
          size="wide"
          aspect="4/5"
          fit="contain"
        />
      </Chapter>

      <Chapter
        id="four-dams"
        number={2}
        title="Four dams on one river"
        thesis="Khadakwasla was built for irrigation in 1880. Three more dams were built above it over the following century. Not one of them was built primarily to supply the city."
      >
        <p>
          Khadakwasla came first, completed around 1880 - CWC&apos;s two
          register editions differ by a year on it. It is the smallest of the
          four, holding about 55.9 million cubic metres of live storage, and it
          is the one everything else flows into: Temghar, Warasgaon and Panshet
          were built upstream over the following century and release down into
          it. Khadakwasla is a balancing reservoir, and its discharge in cusecs
          is the number the city hears on a flood day.
        </p>
        <p>
          The four together hold 825.66 million cubic metres, or 29.158 TMC.
          That figure is worth trusting because two arms of government arrive at
          it independently: it is what the Maharashtra Water Resources
          Department&apos;s daily dam bulletin adds up to, and PMC publishes
          29.15 TMC in its own annual report from a separate accounting. They
          agree to three hundredths of a percent.
        </p>
        <p>
          But the Khadakwasla Complex was not built to fill taps. It is an{" "}
          <strong>irrigation project</strong>. When the Executive Engineer of
          the Khadakwasla Irrigation Division filed an affidavit before the state
          water regulator in December 2018, the numbers he gave were these: the
          complex accounts for 33.77 TMC of use, of which{" "}
          <strong>22.55 TMC is the irrigation provision</strong> and{" "}
          <strong>8.3 TMC was the drinking-water provision in the
          project&apos;s own planning</strong>. The canal that carries the
          irrigation share east - the New Mutha Right Bank Canal, forty-five
          kilometres of it on our map - serves a planned command of roughly
          77,000 hectares around Daund and Indapur.
        </p>
        <PullQuote attribution="Maharashtra Water Resources Regulatory Authority, Order in Case 14 of 2018">
          The farmers on Khadakwasla Complex are deprived of their share.
        </PullQuote>
        <p>
          That sentence is the reason this dashboard shows you Pune&apos;s
          reservoir levels but does not divide them by the city&apos;s demand to
          produce a days-of-water-left number. Most of that storage is not the
          city&apos;s to drink. A runway computed from the total would be
          arithmetic performed on somebody else&apos;s water, in the middle of a
          dispute about exactly that.
        </p>
      </Chapter>

      <Chapter
        id="panshet"
        number={3}
        title="12 July 1961"
        thesis="The dam Pune built above Khadakwasla failed while it was still filling, and the city has no official record of how many people it killed."
      >
        <p>
          Panshet was under construction on the Ambi, a Mutha tributary, and had
          not been completed when it breached on the morning of{" "}
          <strong>12 July 1961</strong>. The wall opened, the water went down
          the Mutha, and it went through Pune. Contemporary accounts describe
          the ground floor of Garware College on Karve Road submerged, water
          through Deccan Gymkhana and along what is now Fergusson College Road,
          and something close to half the built city inundated.
        </p>
        <p>
          How many people died is not known, and that is not a gap in our
          research. The Government of Maharashtra&apos;s own current Pune
          District Disaster Management Plan records the 1961 Panshet disaster
          and states that <strong>no official casualty figure exists</strong>.
          A round number circulates in retellings; it has circulated for
          sixty-five years; it has never been anybody&apos;s official count. We
          are not going to be the platform that launders it into one.
        </p>
        <p>
          Panshet was rebuilt and now holds 301.6 million cubic metres, the
          second-largest of the four. It is the founding trauma of Pune&apos;s
          water system and the reason the phrase &ldquo;discharge from
          Khadakwasla&rdquo; still moves the city.
        </p>
      </Chapter>

      <Chapter
        id="the-boundary"
        number={4}
        title="The boundary moved faster than the pipes"
        thesis="PMC tripled its area in twenty-four years. The 25 villages on the outer edge are budgeted at 70 litres a person a day and served by tanker."
      >
        <p>
          PMC&apos;s own boundary table, in its annual environment report, reads
          as a series of steps: 147.58 sq km originally; 247.58 after 23
          villages came in in 1997; 254.39 when Yewalewadi was added in 2012;{" "}
          <strong>337.91 after eleven villages in 2017</strong>;{" "}
          <strong>505.65 after twenty-three more in 2021</strong>, which made
          Pune the largest municipal area in Maharashtra; and 478.29 today,
          after Uruli Devachi and Fursungi were taken out again in 2024 to form
          their own council.
        </p>
        <p>
          Thirty-four villages came in. The pipes did not follow at the same
          rate, and PMC&apos;s water budget is explicit about the consequence.
          It divides the city into service tiers with different per-person
          allowances: the old municipal limits at{" "}
          <strong>150 litres per person per day</strong>, nine merged villages
          with sewerage at <strong>120</strong>, and{" "}
          <strong>twenty-five outer villages at 70</strong> - less than half the
          old city&apos;s allowance. Against that last line PMC writes, in its
          own report, that their need is also met by tanker supply.
        </p>
        <p>
          In early 2025 that arrangement produced a public-health event PMC
          documents itself. Between January and March, <strong>141 cases</strong>{" "}
          of Guillain-Barré syndrome were recorded in PMC jurisdiction - and{" "}
          <strong>95 of the 141 were in the newly merged areas</strong> against
          46 in the old city. Ten people died, seven of them with GBS confirmed.
          PMC&apos;s own stated conclusion was that contaminated drinking water
          in the newly merged villages was the most probable source, in areas
          that lacked adequate purification, with private tankers, leaking mains
          and poor drainage driving the contamination. The worst-hit names on its
          list - Sinhagad Road, Nanded, Khadakwasla, Kirkatwadi, Dhayari - are
          all recent additions.
        </p>
      </Chapter>

      <Chapter
        id="the-arithmetic"
        number={5}
        title="The shortfall is smaller than the leak"
        thesis="PMC publishes both halves of its own problem in a single table, and the gap it is fighting the regulator over is arithmetically inside its own distribution losses."
      >
        <p>
          Here is the table, in PMC&apos;s numbers. It needs{" "}
          <strong>21.030 TMC</strong> a year: 14.308 TMC of net demand for
          8,164,868 people, plus <strong>6.730 TMC of system losses</strong> at
          32% non-revenue water. It is sanctioned{" "}
          <strong>16.36 TMC</strong>. It reports the shortfall as{" "}
          <strong>4.67 TMC</strong>.
        </p>
        <p>
          Set those two figures beside each other. The shortfall PMC is
          contesting is <strong>smaller than the water it loses</strong> between
          the treatment plant and the tap. Eliminate the leakage and the
          requirement falls to 14.31 TMC against a 16.36 TMC entitlement - a
          surplus of about 2 TMC, without a drop of new water, without a new dam,
          and without taking anything from the canal. That is a subtraction
          across two rows of one PMC table. It is not a model and it is not our
          estimate.
        </p>
        <p>
          One correction worth making, because the wrong version of this is
          everywhere. The figure usually quoted as Pune&apos;s quota is 11.5
          TMC. That is the <strong>Khadakwasla-only</strong> reservation,
          approved by a state High Power Committee on 10 March 2005 and carried
          into the PMC-WRD agreement of 1 March 2013 as 11.0 TMC domestic plus
          0.5 commercial. It is one reservoir&apos;s share. PMC&apos;s total
          authorisation, per the regulator&apos;s 2025 order, is 16.36 TMC - the
          14.61 TMC agreement plus 1.75 TMC granted for the merged villages in
          July 2021. Comparing 11.5 against total lifting compares a part
          against the whole, and the comparison has been repeated for years.
        </p>
      </Chapter>

      <Chapter
        id="nine-years"
        number={6}
        title="Nine years, two orders, no number"
        thesis="Pune's water entitlement has been adjudicated twice and settled neither time."
      >
        <p>
          In October 2017 the Pune District Regulatory Officer fixed PMC&apos;s
          entitlement at <strong>8.19 TMC</strong>. In December 2018 the
          Maharashtra Water Resources Regulatory Authority set that order aside,
          deemed 11.5 TMC an entitlement under section 31(B), and found
          PMC&apos;s use far in excess both of the project&apos;s own 8.3 TMC
          drinking provision and of the state&apos;s sectoral allocation. In the
          same order it recorded what the water department had filed about
          PMC&apos;s actual use: 15.90 TMC in 2011-12, rising to{" "}
          <strong>18.71 TMC in 2017-18</strong>, a seven-year average of 17.3.
        </p>
        <p>
          PMC&apos;s own affidavit for that same year said 14.56 TMC. The
          utility and its regulator disagree by 4.15 TMC about how much water
          the utility took, and{" "}
          <strong>no measured annual draw has been published since</strong>.
        </p>
        <p>
          PMC appealed. On <strong>19 May 2025</strong> MWRRA found that the
          officer who had issued the order under challenge was not the competent
          authority to issue it, and remitted the matter to the Chief Engineer
          for disposal within three months. Nine years, two orders, and the
          entitlement is still formally unresolved.
        </p>
        <p>
          This is why Pune has no allocation ledger on this platform yet. The
          ledger&apos;s whole point is entitled against <em>received</em>, and
          the received column has been contested and unpublished for eight
          years.
        </p>
      </Chapter>

      <Chapter
        id="the-river-below"
        number={7}
        title="Four milligrams at the dam, a hundred and two downstream"
        thesis="The Mutha leaves Khadakwasla nearly clean. What happens to it happens inside the city, in about fifteen kilometres."
      >
        <p>
          The Central Pollution Control Board samples both ends of this. In its
          October 2025 assessment, the Mutha at Khadakwasla dam measured{" "}
          <strong>4.1 mg/L of biochemical oxygen demand</strong> in 2024 -
          close to the 3 mg/L bathing standard. By Deccan Bridge it is 32.5. At
          the Sangam, 35.0. At Veer Savarkar Bhavan,{" "}
          <strong>50.2</strong>. The river does not arrive polluted. Pune
          pollutes it, and does so over roughly fifteen kilometres.
        </p>
        <p>
          The reason is not mysterious and PMC states it. The city generates{" "}
          <strong>980 MLD of sewage</strong> and has{" "}
          <strong>477 MLD of operating treatment capacity</strong> across nine
          plants. About half of what Pune produces reaches the river untreated.
          Eleven more plants totalling 396 MLD are under the JICA-funded
          Mula-Mutha pollution abatement programme; the loan was signed in
          January 2016 for a May 2023 completion and is now targeted at 2026.
        </p>
        <p>
          The sharpest number, though, is on the Mula, and it comes with a
          contradiction attached. CPCB&apos;s 2025 report classifies the Mula as{" "}
          <strong>improved</strong> - Priority I down to Priority II. An annexure
          to the same report gives 2024 readings at the same stations, and the
          Mula at Harrison Bridge, Bopodi, reads{" "}
          <strong>102.5 mg/L</strong>. Of 756 locations tabulated across India,
          only six exceed 100. That one is in Pune, and it is higher than the
          worst Yamuna station CPCB publishes for Delhi and higher than the
          Mithi at Mahim.
        </p>
        <PullQuote>
          The same report says the river is improving and that it is one of the
          six filthiest measured points in the country.
        </PullQuote>
      </Chapter>

      <Chapter
        id="under-the-city"
        number={8}
        title="What nobody is counting"
        thesis="Pune's groundwater is assessed by taluka, monitored almost entirely outside the city, and excluded from the municipal accounts by PMC's own admission."
      >
        <p>
          The national groundwater assessment puts Pune district at{" "}
          <strong>63.73% of its extractable resource</strong> and categorises it{" "}
          <strong>SAFE</strong>. Inside that district,{" "}
          <strong>Shirur taluka is CRITICAL at 95.71%</strong>, and has been
          critical in every one of the six published editions, never dropping
          below 94.24%. Ninety-three percent of Shirur&apos;s extraction is
          agriculture. The district average is not wrong; it is just the average
          of the wet west and the pumped east, and it conceals the thing worth
          knowing.
        </p>
        <p>
          For the city itself, the honest answer is that almost nobody is
          measuring. Maharashtra runs{" "}
          <strong>120 telemetric groundwater stations</strong> across Pune
          district - genuinely dense - and{" "}
          <strong>exactly one of them stands inside the municipal
          boundary</strong>, at Shivajinagar. The rest instrument the irrigation
          belt. You can see this on our groundwater map: the dots cluster east
          and south, away from the city they are nearest to.
        </p>
        <p>
          PMC does not fill that gap and says so. Its water accounts state in
          terms that they exclude groundwater, private tanker supply and other
          alternative sources, and its 2025-26 report{" "}
          <em>recommends creating</em> seasonal borewell monitoring, city
          groundwater maps and a licensing regime for commercial borewells -
          which is a corporation telling you it does not have them. Its only
          survey is a 320-borewell pilot across five clusters.
        </p>
        <p>
          The one independent estimate is ACWADAM&apos;s, from a 2019
          hydrogeological appraisal of Pune&apos;s aquifers: roughly{" "}
          <strong>4 TMC a year</strong> drawn from somewhere between 80,000 and
          125,000 borewells - about a quarter of formal municipal supply, pumped
          out of the ground by a city that keeps no record of it. That is a
          research estimate, not a measurement, and we carry it as one.
        </p>
      </Chapter>

      <Chapter
        id="where-we-are"
        number={9}
        title="Rs 1,558 crore in, four hours out"
        thesis="The project meant to fix distribution is eight years in and 85% complete by its own account, and the service level it was built to change has not moved."
      >
        <p>
          PMC&apos;s equitable water supply project - the 24x7 scheme - is
          sanctioned at <strong>Rs 2,818.46 crore</strong>, of which{" "}
          <strong>Rs 1,557.89 crore</strong> has been spent. It has laid 98.9 km
          of feeder mains and 1,039.5 km of distribution mains and installed
          199,553 automatic meters. Of the <strong>82 elevated service
          reservoirs</strong> it planned, <strong>67 are built</strong> and{" "}
          <strong>35 are commissioned</strong> - and the difference between built
          and commissioned is the honest measure of what has reached anybody.
          PMC reports the project 85% complete with twelve to fourteen months to
          go.
        </p>
        <p>
          Where it is finished, PMC claims real gains: leakage down from 40% to
          29%, and private tankers in Baner-Balewadi down from about 170 a day to
          about 75. Citywide, however, its own service-level benchmark table
          reports <strong>four hours of supply a day</strong> against a
          24-hour target.
        </p>
        <p>
          It reports four hours in the 2021-22 edition, and in 2022-23, and in
          2023-24, and in 2024-25, and in 2025-26. In fact PMC reprinted{" "}
          <strong>the same benchmark table, unchanged, for four consecutive
          years</strong> - coverage 98%, supply 4 hours, non-revenue water 35%,
          per-capita 250 LPCD, metering 30%, collection efficiency 88%. Only the
          2025-26 edition moves any of it. So the correct reading is not that
          Pune held steady for five years; it is that we have{" "}
          <em>one observation</em> repeated four times and then a second one.
          That is a finding about the reporting as much as about the water, and
          it is why this dashboard shows you the source vintage on every number
          it can.
        </p>
        <ThenNow
          thenLabel="1911"
          nowLabel="2026"
          rows={[
            {
              metric: "Dams on the Mutha system",
              then: "1 (Khadakwasla, c.1880)",
              now: "4, holding 29.15 TMC",
              verdict: "better",
            },
            {
              metric: "PMC area",
              then: "The walled city and its peths",
              now: "478.29 sq km, 34 merged villages",
              verdict: "same",
            },
            {
              metric: "Mutha at Khadakwasla dam",
              then: "Not measured",
              now: "4.1 mg/L BOD (CPCB, 2024)",
              verdict: "same",
            },
            {
              metric: "Mula at Bopodi",
              then: "Not measured",
              now: "102.5 mg/L BOD - 6th worst of 756 sites in India",
              verdict: "worse",
            },
            {
              metric: "Sewage treated",
              then: "None",
              now: "477 of 980 MLD generated",
              verdict: "better",
            },
            {
              metric: "Hours of supply a day",
              then: "Standposts and wells",
              now: "4, against PMC's own 24-hour target",
              verdict: "worse",
            },
            {
              metric: "Groundwater stations inside the city",
              then: "None",
              now: "1, of 120 across the district",
              verdict: "same",
            },
          ]}
        />
      </Chapter>

      <Chapter
        id="what-it-would-take"
        number={10}
        title="What it would take"
        thesis="Every number in the previous chapter is PMC's own. So is the one that fixes them."
      >
        <p>
          Pune is not short of water in the way Chennai was short of water in
          2019. It holds 29 TMC in four reservoirs, and in August 2026 all four
          were at 100% of live storage. What it is short of is water that
          arrives where it is billed, and an agreed number for how much of the
          river system is its to take.
        </p>
        <p>
          The first is measurable and PMC measures it: 6.73 TMC a year, 32% of
          everything it lifts, lost between plant and tap. Closing that gap
          would end the entitlement dispute arithmetically - the demand would
          fall below the sanction - and it would do so without asking the canal
          for anything. The project to do it is eight years old, 85% complete,
          and has commissioned 35 of 82 tanks.
        </p>
        <p>
          The second is a governance problem, not a hydrological one. Two
          adjudications in nine years have produced no settled entitlement, and
          the last one turned on which officer was competent to sign. In the
          meantime the regulator has directed PMC to publish its water data
          under the public trust doctrine, and to return treated water for
          agriculture to the extent it draws above the project&apos;s own
          drinking provision.
        </p>
        <p>
          And a third thing, which is smaller but ours to say: nobody is
          measuring the aquifer under the city. One station. A corporation that
          excludes borewells from its accounts and recommends that someone build
          the monitoring it lacks. A single independent estimate, from 2019,
          suggesting a quarter of the city&apos;s water is coming from a source
          with no meter on it. The first repair here is not a pipe. It is a
          record.
        </p>
        <CTA href="/pune">See where Pune stands today</CTA>
        <CTA href="/pune/groundwater">The taluka the district average hides</CTA>
        <CTA href="/pune/rivers">Four milligrams to a hundred and two</CTA>
      </Chapter>
    </StoryPage>
  );
}
