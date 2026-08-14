/**
 * Kolkata water story - "The city that built itself around a pond, and the
 * wetland that takes what it throws away." Composed from the Lede / Chapter /
 * Figure / PullQuote / ThenNow / CTA shortcodes.
 *
 * Source spine for verifiable claims - all in-repo or primary:
 *   - KMC, District Environment Plan 2021 (NGT-mandated filing): the 1,400 /
 *     910 / 179 / 311 MLD sewage balance; 3,777 ponds on a 1993 tank list;
 *     144 wards; the blank industrial-wastewater section
 *   - KMC, Sewerage and Drainage (2009): the 6 mm/hour design standard,
 *     180 km of century-old brick sewer, combined system
 *   - KMC, Weekly Drainage Activity Chart (in-repo weekly scrape)
 *   - WBPCB EMIS water quality (in-repo, 41 stations / 3,209 samples,
 *     2010-2026) - the Adi Ganga zero-DO readings and the tidal pairing
 *   - Mohit Ray, "Water bodies of Kolkata" (CSE): the four conflicting pond
 *     counts and the ~44% loss
 *   - EKWMA: 12,500 ha, 254 sewage-fed fisheries, 37 mouzas; EKW
 *     (Conservation and Management) Act 2006
 *   - Open-Meteo ERA5 hourly archive (in-repo): 2000-2025 exceedance ladder
 *   - IN-GRES (in-repo): Kolkata district categorised `salinity`
 *   - BGS/ADB, Arsenic and Fluoride in Drinking Water in West Bengal (2018)
 *   - KMC-SHARP Semi Annual Environment Monitoring Report Jul-Dec 2025
 *     (ADB Loan 4584-IND): package status, 0.0% physical progress
 *   - NGT, 15 Nov 2017 order on Rabindra Sarobar (KMDA appointed custodian)
 *
 * Images: /public/images/story/kolkata/* - provenance, license and processing
 * in MANIFEST.json in that directory (Wikimedia Commons; CC BY / CC BY-SA).
 * English-only; Bengali follows in the i18n pass (native review pending).
 */

import { StoryPage } from "@/components/story/story-page";
import { Chapter, CTA, Figure, Hero, Lede, PullQuote, ThenNow } from "@/components/story/story-shortcodes";

export function KolkataStoryEn() {
  return (
    <StoryPage
      cityId="kolkata"
      cityDisplayName="Kolkata"
      tagline="The city that built itself around a pond - and the wetland that takes what it throws away"
      lastRevised="July 2026"
    >
      <Hero
        src="/images/story/kolkata/lal-dighi-bbd-bagh.jpg"
        alt="Lal Dighi in Kolkata: three people bathing and washing clothes at the tank's stone steps in the foreground, with the white dome of the General Post Office and the colonial administrative buildings of B.B.D. Bagh rising behind the water. A discarded tyre lies on the steps at the left."
        source="Wikimedia Commons"
        credit="Vyacheslav Argenberg (CC BY 4.0)"
      />
      <Lede>
        In the middle of Kolkata&apos;s administrative core, under the dome of
        the General Post Office and surrounded by the buildings from which an
        empire was once run, there is a pond - and people are washing in it.
        Lal Dighi, the red tank, which the British called simply the Great
        Tank, was here before the offices were, and the city arranged itself
        around it. Three centuries later it is still doing domestic work.
        That is the founding fact, and it is worth holding onto, because Kolkata
        went on to fill roughly <strong>44%</strong> of its ponds within two
        decades. The names survive where the water does not: Beniapukur,
        Manoharpukur, Jhamapukur, Shyampukur - <em>pukur</em> (পুকুর) means pond,
        and KMC&apos;s own road directory lists sixty-one streets named after
        water bodies. Meanwhile the city&apos;s single largest piece of water
        infrastructure is not a plant or a reservoir but a wetland it does not
        own, lying outside its boundary, treating{" "}
        <strong>910 of Kolkata&apos;s 1,400 million litres of sewage a day</strong>{" "}
        in fish ponds - roughly five times what all five of the city&apos;s
        treatment plants manage between them. Kolkata is not running out of
        water. It is a city defined by water it cannot get rid of.
      </Lede>

      <Chapter
        id="pond-city"
        number={1}
        title="A city you could swim across (c. 1690-1900)"
        thesis="Kolkata grew on a deltaic plain where the problem was never finding water but draining it - so it organised itself around tanks, and named itself after them."
      >
        <p>
          The three villages that became Calcutta sat on the east bank of the
          Hooghly, on ground so flat and so wet that the founding engineering
          problem was not supply but disposal. Rain fell - about 1,650
          millimetres a year - onto clay that would not absorb it, in a delta
          with almost no gradient to carry it away. The answer, repeated
          thousands of times across the settlement, was the tank: dig a pond,
          pile the spoil into a building platform, and let the hole hold the
          rain. Every tank was simultaneously a borrow pit, a reservoir, a
          bathing place, a fishery and a firebreak.
        </p>
        <p>
          The result was a city so dense with ponds that you could, as the
          environmentalist Mohit Ray has put it, swim across Kolkata from one{" "}
          <em>pukur</em> to the next. The toponymy is the proof: Monoharpukur,
          Ahiripukur, Bosepukur, Thakurpukur, Paddapukur, Talpukur, Keorapukur,
          Hanspukur, Shyampukur, Muraripukur, Jorapukur, Jhamapukur, Beniapukur,
          Fariapukur, Chunapukur, Tanupukur. Sixty-one roads in KMC&apos;s own
          2006 directory carry a water body&apos;s name.
        </p>
        <p>
          Two things followed from building on a tidal delta rather than a river
          plain. First, the city never impounded anything: there is no dam
          anywhere in Kolkata&apos;s water system, then or now. Second, the
          drainage had to be engineered from scratch - and in the nineteenth
          century it was, as a <strong>combined</strong> system, carrying sewage
          and stormwater in the same conduit. That decision is still the single
          most consequential fact about Kolkata&apos;s water, and we will come
          back to it twice.
        </p>
      </Chapter>

      <Chapter
        id="six-millimetres"
        number={2}
        title="Six millimetres an hour (1870s-present)"
        thesis="The Victorian sewers were built to a published standard. The standard has not changed; the rain has."
      >
        <p>
          KMC&apos;s own sewerage document states it plainly: the main network
          &quot;was designed to discharge a rainfall of 6 mm. per hour&quot;.
          That is the promise the city&apos;s drains make. Around it sit{" "}
          <strong>180 kilometres of century-old brick sewer</strong> and pumping
          stations that the corporation says were built fifty to a hundred years
          ago. As late as 2004-05 the whole city had{" "}
          <strong>one</strong> storm-water drainage pumping station; by 2009 it
          had four.
        </p>
        <p>
          We took twenty-six years of hourly rainfall - 232,896 hours, 2000 to
          2025 - and asked how often the sky beats six millimetres. The answer
          is a mean of <strong>31.8 hours a year</strong>. But the record splits
          almost in half: <strong>19.2 hours a year in 2000-2012</strong>,
          against <strong>44.5 in 2013-2025</strong>. In 2025 the standard was
          beaten for 59 hours across 50 separate days. The wettest hour on
          record delivered 40.2 millimetres - <strong>6.7 times</strong> what
          the sewers were built to carry.
        </p>
        <PullQuote attribution="Kolkata Municipal Corporation, Sewerage and Drainage">
          Designed to discharge a rainfall of 6 mm. per hour.
        </PullQuote>
        <p>
          What that looks like on the ground is not an annual catastrophe but a
          weekly routine. KMC publishes a chart every week listing the
          waterlogging pockets it has sent de-silting machines to. In one
          ordinary week of July 2026 our capture recorded{" "}
          <strong>66 pockets across 53 wards and 15 boroughs</strong>, with 469
          machine deployments; the week we captured in August named 60 pockets
          across 55. Neither is a spike. The corporation lists its own causes without
          flinching: siltation, collapsing brick sewers, century-old pumps,
          silted outfall canals - and the destruction of wetlands increasing
          runoff.
        </p>
        <p>
          Because the system is combined, every one of those hours does two
          things at once. It floods the street, and it pushes untreated sewage
          into the canals. In Kolkata, a drainage failure and a pollution event
          are the same event.
        </p>
      </Chapter>

      <Chapter
        id="adi-ganga"
        number={3}
        title="The river that stopped breathing"
        thesis="The original course of the Ganga runs through south Kolkata past one of Hinduism's great temples, and carries no dissolved oxygen at all."
      >
        <Figure
          src="/images/story/kolkata/adi-ganga-tollygunge-2014.jpg"
          alt="The Adi Ganga at Tollygunge in Kolkata: a narrow, dark, rubbish-strewn channel running between built-up banks."
          caption="The Adi Ganga at Tollygunge. This is the original course of the Ganga - the river that made the delta - reduced to an engineered channel also known as Tolly's Nullah."
          source="Wikimedia Commons"
          credit="Biswarup Ganguly (CC BY 3.0)"
        />
        <p>
          The Adi Ganga is not a minor drain with a grand name. It is the{" "}
          <em>adi</em> - the original - course of the Ganga, the channel the
          river ran down before it shifted west, and it passes Kalighat, the
          temple the city takes its name from. In 1777 Major William Tolly had
          it dredged as a navigation cut, which is why it is also called Tolly&apos;s
          Nullah.
        </p>
        <p>
          West Bengal&apos;s Pollution Control Board samples it at six points,
          and does something no other monitoring programme on this platform
          does: it samples each point <strong>separately at high tide and at
          low tide</strong>. The Hooghly is tidal this far inland, so the same
          location is a different water body six hours apart. Keeping the two
          apart, rather than averaging them, is the only honest way to measure
          a tidal channel - and it produces a finding the average would have
          erased.
        </p>
        <p>
          On 7 May 2026 at Bansdroni, the board&apos;s own observers recorded
          the water as <strong>&quot;Blackish&quot;</strong> and{" "}
          <strong>&quot;Pungent&quot;</strong>. Dissolved oxygen:{" "}
          <strong>NIL</strong>. Faecal coliform: <strong>4,900,000</strong> MPN
          per 100 ml. That is the high-tide reading. At low tide, the same day,
          the same point: BOD 14.53 against 10.75, faecal coliform{" "}
          <strong>8.4 million</strong> against 4.9 million. Less dilution, more
          concentration. Dissolved oxygen was nil at every monitored point along
          the channel.
        </p>
        <p>
          Four kilometres away the Hooghly itself - the city&apos;s actual
          drinking-water source, abstracted at Palta some twenty-two kilometres
          upstream - was running dissolved oxygen above 6 mg/l and BOD around
          2. The mainstem is not the story. What the city does to its own
          smaller channels is.
        </p>
      </Chapter>

      <Chapter
        id="the-wetland"
        number={4}
        title="The wetland that does the work"
        thesis="Kolkata's largest sewage treatment plant is not a plant. It is 12,500 hectares of fish ponds outside the city limits, and nobody built it."
      >
        <Figure
          src="/images/story/kolkata/ekw-fishing-among-skyscrapers.jpg"
          alt="A fisherman working a shallow pond in the East Kolkata Wetlands, with the towers of the city rising directly behind him."
          caption="The East Kolkata Wetlands: 254 sewage-fed fisheries treating 910 MLD of the city's sewage, with Kolkata's skyline advancing on them."
          source="Wikimedia Commons"
          credit="Sudipvssudip (CC BY-SA 4.0)"
        />
        <p>
          When the Bidyadhari river silted up in the early twentieth century,
          Kolkata&apos;s eastward drainage failed. What grew in its place was
          not an engineering scheme but a livelihood: fish farmers discovered
          that the city&apos;s sewage, let into shallow ponds and worked by
          sunlight and algae, grew fish. Over decades this became the largest
          wastewater-fed aquaculture system in the world - 12,500 hectares, 254
          sewage-fed fisheries, 37 <em>mouzas</em>, protected since 2006 by its
          own Act and listed as a Ramsar site.
        </p>
        <p>
          By KMC&apos;s own statutory accounting, the wetlands treat{" "}
          <strong>910 of the city&apos;s 1,400 MLD</strong>. The five actual
          treatment plants manage <strong>179</strong>. A further{" "}
          <strong>311 MLD - 22.21%</strong> - is untreated or only partly
          treated. So the principal sewage infrastructure of a city of four and
          a half million people is unbuilt, unpaid for, unengineered, under
          continuous real-estate pressure - and lies <strong>outside the
          corporation&apos;s boundary</strong>, in North and South 24 Parganas.
        </p>
        <PullQuote attribution="KMC, District Environment Plan 2021">
          910 MLD in EKW fisheries + 179 MLD in existing 5 nos. STPs = Total 1089 MLD.
        </PullQuote>
        <p>
          Ten more plants are planned, adding 280.06 MLD. Even if every one is
          built, 30.94 MLD stays untreated - and that arithmetic assumes the
          wetlands keep absorbing 910 MLD indefinitely. As of December 2025,
          five of the sewerage packages financed under an Asian Development Bank
          loan had been awarded, contractors mobilised, work formally commenced
          in October - and every one of them stood at{" "}
          <strong>0.0% physical progress</strong>.
        </p>
      </Chapter>

      <Chapter
        id="where-we-are"
        number={5}
        title="What the numbers refuse to say"
        thesis="Kolkata's water problem is unusually well documented and unusually badly counted - and several of the gaps are the corporation's own admissions."
      >
        <p>
          Some of what is missing here is missing on the record, which is rarer
          and more useful than it sounds. KMC&apos;s statutory Environment Plan
          leaves the <strong>entire industrial-wastewater section blank</strong>
          , every field empty, naming the state pollution board as responsible.
          That is a corporation declaring a gap in its own legally mandated
          plan.
        </p>
        <p>
          The corporation also contests its own population. The same Environment
          Plan gives more than 4.5 million residents and a floating population of
          six million a day; KMC&apos;s water-supply pages frame demand off a
          &quot;static population&quot; of 44.96 lakh. Whatever litres-per-capita
          figure anyone quotes for Kolkata, the denominator is disputed by the
          publisher - which is why this platform publishes none. For the same
          reason it publishes no total supply capacity: KMC&apos;s own page
          lists plants summing to 2,324.7 MLD beside a target of roughly 1,900,
          on a page labelled draft and footered 2013.
        </p>
        <p>
          Nobody agrees how many ponds there are either. For 2006 alone there
          are four published counts: KMC&apos;s own list said 3,873, the
          National Atlas organisation&apos;s map census said 8,731, a satellite
          count said 4,889, and KMC&apos;s earlier 1997 list had said 1,786.
          That last pair is the trap - KMC&apos;s count went <em>up</em>, which
          is not ponds appearing but the corporation searching harder. The 44%
          loss figure comes from comparing the map census against the satellite
          count in the same year. KMC is now, finally, commissioning a fresh
          inventory; the one it has been working from was compiled in{" "}
          <strong>1993</strong>.
        </p>
        <p>
          Even the groundwater refuses the usual framing. The national
          assessment does not classify Kolkata district as safe, or critical, or
          over-exploited. It classifies it as <strong>saline</strong> - a
          water-quality category, not an extraction one - so the district has no
          extraction stage at all. Around it, the arsenic belt: 42.4% of North
          24 Parganas habitations affected, in the district that holds both
          Kolkata&apos;s intake at Palta and its fastest-growing suburbs.
        </p>

        <ThenNow
          thenLabel="Then"
          nowLabel="Now"
          rows={[
            { metric: "Water bodies in the city", then: "8,731 mapped (NATMO, 2006)", now: "~4,889 counted from satellite, same year", verdict: "worse" },
            { metric: "Working inventory KMC uses", then: "Departmental tank list, 1993", now: "Still the 1993 list; new survey commissioned", verdict: "same" },
            { metric: "Hours a year rain beats the drains", then: "19.2 (2000-2012 average)", now: "44.5 (2013-2025 average)", verdict: "worse" },
            { metric: "Storm-water pumping stations", then: "1 (2004-05)", now: "4 (2009)", verdict: "better" },
            { metric: "Sewage treated by the wetlands", then: "910 MLD", now: "910 MLD, with the wetlands shrinking", verdict: "worse" },
            { metric: "Dissolved oxygen, Adi Ganga", then: "-", now: "NIL at every monitored point", verdict: "worse" },
          ]}
        />
      </Chapter>

      <Chapter
        id="what-it-would-take"
        number={6}
        title="What it would take"
        thesis="Kolkata's fixes are unusually legible, because most of them are already written down by the people responsible."
      >
        <p>
          <strong>Count the ponds.</strong> The single cheapest intervention is
          the inventory KMC has already commissioned. A city cannot protect
          water bodies it has not enumerated since 1993, and the West Bengal
          Inland Fisheries Act already prohibits filling any water body of five
          cottahs or more without permission. The law exists; the register does
          not.
        </p>
        <p>
          <strong>Treat the wetlands as infrastructure, not scenery.</strong>{" "}
          910 MLD of treatment capacity that nobody built and nobody pays for is
          the largest untracked asset on this platform. It has an Act, an
          authority and a charge-sheet register - and no line in the
          corporation&apos;s capital budget commensurate with what it does.
        </p>
        <p>
          <strong>Publish the drainage network.</strong> KMC has 80 per-ward
          drainage maps. They are PDFs. Chennai publishes 10,308 surveyed drain
          segments as data; Kolkata&apos;s equivalent exists on paper only,
          which means nobody outside the department can analyse where the system
          fails.
        </p>
        <p>
          <strong>Restore the early-warning system.</strong> The programme that
          built Kolkata&apos;s flood early-warning system still links to it. As
          of July 2026 the domain no longer resolves. A city that floods as a
          weekly operating condition has no public warning surface at all.
        </p>
        <p>
          None of these require a new dam, a new river, or a new treaty. Kolkata
          has enough water. What it has never had is an honest account of where
          that water goes - and, for a hundred and fifty years, drains built for
          six millimetres of rain an hour in a city that increasingly gets more.
        </p>
        <CTA href="/kolkata">See the live Kolkata dashboard</CTA>
      </Chapter>
    </StoryPage>
  );
}
