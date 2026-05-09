/**
 * Madurai water story - "Temple city, broken cascade: the history of
 * water in Madurai." Composed from the Hero / Lede / Chapter / Figure /
 * PullQuote / CTA / ThenNow shortcodes.
 *
 * Image slots reference /public/images/story/madurai/* - the manifest
 * lives in MANIFEST.json next to the images. We deliberately do not
 * ship images without source attribution; every Figure passes a
 * `source` (and usually `credit`) explicitly.
 *
 * This file is the editable text; structural changes (new chapter
 * types, new shortcodes) live in src/components/story/.
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

export function MaduraiStoryEn() {
  return (
    <StoryPage
      cityId="madurai"
      cityDisplayName="Madurai"
      tagline="The history of water in Madurai"
      lastRevised="May 2026"
    >
      <Hero
        src="/images/story/madurai/teppakulam-1870.jpg"
        alt="Vandiyur Mariamman Teppakulam, Madurai, c. 1870. Albumen print of the temple tank with the central island shrine, full of water."
        source="Wikimedia Commons / KITLV"
        credit="Unknown photographer, c. 1870 (public domain)"
      />
      <Lede>
        Madurai has been many cities under one sky. To the
        Sangam-era poets it was{" "}
        <em>Koodal Maanagar</em> (கூடல் மாநகர்), the city of the
        assembly. Today it is <em>Thoonga Nagaram</em>{" "}
        (தூங்கா நகரம்), the city that never sleeps. Its deeper
        name is older still: <em>Marutham</em>, the Sangam-era
        word for the riverine, paddy-growing landscape itself.
        For two thousand years that landscape had its water - a
        hydraulic civilisation that linked roughly 2,500 tanks
        (<em>kanmoi</em>, கண்மாய்) into a single cascade fed by
        the Vaigai. Today the cascade is severed from the river
        that fed it; about a third of the city&apos;s historic
        tank surface no longer holds water. The cascade is not
        gone. It is just disconnected. The work this dashboard
        tracks is whether and how the connection comes back.
      </Lede>

      <Chapter
        id="how-water-made-madurai"
        number={1}
        title="How water made Madurai"
        thesis="Madurai did not just have water infrastructure. It was water infrastructure."
      >
        <p>
          Madurai is older than most surviving cities on earth. A
          second-century BCE Tamil-Brahmi inscription, deciphered
          by the epigrapher Iravatham Mahadevan, calls it{" "}
          <em>matiray</em> - the walled city. Earlier Brahmi
          inscriptions at Mangulam, twenty kilometres north, name
          workers of the Pandyan king Nedunchezhiyan I in the third
          century BCE - the oldest dated evidence of organised state
          presence in this landscape (Mahadevan, <em>Early Tamil
          Epigraphy</em>). The Greeks who reached this coast wrote
          of it as <em>Methora</em>; the nineteenth-century British
          colonial press called it the Athens of the East; and
          today it is popularly called <em>Thoonga Nagaram</em>,
          the city that never sleeps. Two thousand years of
          continuous habitation in a 900 mm-rainfall semi-arid zone
          - a place where, by every climatic argument, no city this
          large should exist, let alone stay awake all night.
        </p>
        <p>
          What made it possible was not faith. It was hydraulics.
          The Pandyans, then the Madurai Nayaks, built a network of
          interconnected tanks called <em>kanmoi</em> (கண்மாய்) -
          earthen bunds holding back monsoon runoff, stone{" "}
          <em>kalingu</em> sluices controlling release, and feeder
          channels connecting each tank both upstream and downstream
          to the next. Hundreds of them daisy-chained together
          formed a cascade. The overflow from tank N filled tank
          N+1, which filled N+2, all the way down a watershed. By
          the colonial gazetteers&apos; count, the Madurai region
          held more than two thousand five hundred such tanks and
          minor structures.
        </p>
        <p>
          This cascade did not just water fields. It made the city
          of festivals possible. Every Chithirai - the Tamil month
          that straddles April and May - Madurai swells past its
          working population to a million pilgrims for the celestial
          wedding of Meenakshi and Sundareshwarar at the
          Meenakshi-Amman temple. The dramatic centrepiece is not
          the wedding. It is the moment Lord Kallazhagar - the
          Vishnu deity who lives twenty-one kilometres away at the
          Azhagar Koyil hill temple - rides down from the hills as
          Meenakshi&apos;s brother, fords the Vaigai on horseback
          to attend the wedding, and turns back when he hears the
          rite is already complete. The river crossing is the
          iconic image. A million people line the banks for it.
          The <em>Madurai Kanchi</em>, a second-century CE Sangam
          composition by the poet Mangudi Marudan - literally{" "}
          &ldquo;a counsel offered in Madurai&rdquo; - describes
          this same temple-city&apos;s water culture two thousand
          years ago. The {`Tevaram`} of the seventh- and
          eighth-century Nayanar saints addresses the city as{" "}
          <em>Thirualavai</em>. None of those texts describe the god
          stepping over a dry riverbed of plastic and sewage.
        </p>
        <p>
          A few months later, in the cooler month of Thai, the
          Vandiyur Mariamman <em>teppakulam</em> - sixteen acres of
          temple tank built in 1645 CE by Thirumalai Nayak, the
          same Madurai Nayak king who built the Tirumalai Nayakkar
          Mahal palace half a kilometre from the Meenakshi temple -
          fills to its stone steps and the float festival begins.
          The largest temple tank in Tamil Nadu was not a
          decoration. It was the bottom of a cascade. Without the
          channels that brought water in, the float festival
          cannot happen. Without the kanmoi above them feeding the
          channels, the channels do not flow.
        </p>
        <PullQuote attribution="Columbia GSAPP / TCE, 2016">
          Surplus channels are the links of a chain, which function
          as the most efficient water-harvesting structures in arid
          plains.
        </PullQuote>
        <Figure
          src="/images/story/madurai/madurai-1906-gazetteer-map-v2.jpg"
          alt="1906 Survey Office Madras map of Madurai Municipality, showing the Vaigai river running across the top with bridges, the walled old city, and several elongated tank polygons including the Vandiyur Mariamman teppakulam and surrounding water bodies, with a numbered legend identifying tanks, temples, and civic landmarks."
          caption="Madurai Municipality, 1906. The Vaigai runs east-west across the top with bridges; the elongated tank polygons inside and around the walled city are the surviving kanmoi at the time the Madras District Gazetteer was published. The cascade was already weakening under colonial neglect, but the structure of the hydraulic civilisation - river, bunds, bus stand and rail still threading between tanks rather than over them - is still legible."
          credit="W. Francis, Madras District Gazetteers: Madura, 1906; Survey Office, Madras"
          source="Wikimedia Commons (public domain)"
          aspect="3/2"
          fit="contain"
          size="wide"
        />
        <p>
          Seven named surplus channels carried the Vaigai&apos;s
          flow in and out of Madurai - Anuppanadi, Paniyur,
          Sottathatti and Avaniyapuram on the southern bank; Sellur,
          Pandalkudi and Vandiyur on the northern bank. Sixteen
          kilometres downstream, the Anaikondan kanmoi network in
          Tirumangalam taluk - sixteenth-century Pandyan-era
          engineering, still functional - was notified as Tamil
          Nadu&apos;s first Biodiversity Heritage Site in November
          2022. Four centuries of continuous service before the
          state thought to formally protect it.
        </p>
        <p>
          And this was not folk wisdom. It was state infrastructure,
          surveyed and budgeted. Tank maintenance was a tax-supported
          obligation called <em>kudimaramathu</em> - community tank
          repair - that ran continuously from the Pandyan period
          into the early colonial era. The Oxford anthropologist
          David Mosse, whose <em>The Rule of Water</em> (2003) is an
          ethnography of the Sivagangai-Madurai tank country,
          documents how this was simultaneously hydraulic
          infrastructure, caste-state authority, and temple
          economy - the same institution doing three jobs at once.
          To live in this region was to owe the cascade something.
          The kanmoi did not maintain themselves; nor did the
          people pretend they did.
        </p>
      </Chapter>

      <Chapter
        id="how-it-came-undone"
        number={2}
        title="How the cascade came undone"
        thesis="The cascade did not collapse from one cause. It was unwound, piece by piece, by named decisions across three eras."
      >
        <p>
          The British East India Company found the kanmoi system
          working. The colonial engineering office did not see a
          functioning hydraulic civilisation; it saw obsolete
          plumbing. Large dams and centralised waterworks were{" "}
          <em>modern</em>. A two-thousand-year-old cascade
          maintained by farmer councils was, in the colonial mind,
          something to be replaced. Mosse&apos;s 1999 paper{" "}
          <em>Colonial and Contemporary Ideologies of &lsquo;Community
          Management&rsquo;</em> argues that the very story of decayed{" "}
          <em>kudimaramathu</em> was constructed by colonial
          administrators to justify state takeover - the kanmoi did
          not stop working because the institution failed; the
          institution was first declared failed, and then starved
          of the authority that kept it running. The annual{" "}
          <em>kudimaramathu</em> obligation was folded into the
          Public Works Department schedule. The social capital that
          had kept the bunds repaired and the channels clear, that
          had taught the next generation which tank fed which,
          began to dissolve. Tanks that no one was responsible for
          slowly silted up.
        </p>
        <p>
          In 1924 the British laid the city&apos;s first underground
          sewer, covering what was then the core - about thirty per
          cent of Madurai&apos;s present footprint. That number is
          worth holding on to. The other seventy per cent of today&apos;s
          Madurai - the part that grew after Independence, that
          buried tank beds under courthouses and bus stands and slum
          colonies - was added on top of the cascade without a sewer
          to match. The seven named surplus channels picked up the
          overflow by default. By the time the 2011 Jawaharlal Nehru
          National Urban Renewal Mission finally extended underground
          drainage to ninety per cent of households, the channels
          had already been storm and sewage drains for a generation.
          The colonial framing won twice: it dismissed the cascade
          first, then built nothing fast enough to replace what the
          cascade used to do.
        </p>
        <p>
          After 1947, the colonial framing carried over. The Vaigai
          dam (1959) and the intensified Mullaperiyar tunnel
          diversion industrialised the upstream supply, while the
          downstream cascade - the channels and tanks the river
          fed - decayed without a department key performance
          indicator measuring it. From 1951 to 1971, rural-to-urban
          migration filled Madurai. The easiest land got built on
          first: dry-season tank beds, broad and flat, with no
          living owner to object.
        </p>
        <PullQuote>
          The District Court complex stands on Sengulam tank&apos;s
          bed. Madurai Corporation&apos;s offices stand on
          Tallakulam tank&apos;s bed.
        </PullQuote>
        <p>
          Fourteen named urban tanks are documented as completely
          lost. About sixteen and a half square kilometres of
          historic tank surface - close to a third of the
          historical wet city - has been built over (Vencatesan,{" "}
          <em>Dying Tanks in Urban Areas</em>). Roughly fifteen
          thousand households now live on what were once tank beds,
          on land that floods predictably when the monsoon
          remembers what the ground is.
        </p>
        <p>
          But the deepest change was hydraulic, not legal. Two
          decisions, taken in living memory, severed the river from
          the cascade it used to fill.
        </p>
        <p>
          <strong>One.</strong> The bund road laid along the Vaigai
          in the late 1990s - intended to give the riverbanks a
          motorable edge - destroyed the surviving ghats and
          encroached ten metres on both sides. The seven named
          surplus channels were paved over or repurposed as storm
          drains. They are now, every one of them, sewage drains.
          The pilgrims at Chithirai still bathe in the river. Lord
          Azhagar still rides down from the hill to ford it. The
          river they bathe in, the river he fords, is what flows
          out of those drains.
        </p>
        <p>
          <strong>Two.</strong> Sand mining lowered the Vaigai bed
          itself. The bed dropped <em>below the elevation</em> of
          every channel intake along its banks. Even on a wet
          year, gravity will not lift water uphill into a channel
          that now sits metres above the stream. The cascade was
          no longer just blocked. It was physically decoupled from
          the river it used to draw from. The kanmoi did not lose
          their water; they lost their feed.
        </p>
        <PullQuote>
          The cascade is not gone. It is just disconnected.
        </PullQuote>
      </Chapter>

      <Chapter
        id="where-we-stand"
        number={3}
        title="Where we stand now"
        thesis={"The trajectory across the published record - Pandyan-era inscriptions, the 1906 gazetteer, late-twentieth-century studies, today’s telemetry - all point in the same direction. Some pieces have improved. The hydraulic system itself has not."}
      >
        <p>
          Madurai&apos;s water condition is one of the better
          documented in Tamil Nadu. The Pandyan inscriptions named
          the tanks. The 1906 Madras District Gazetteer mapped
          them. David Mosse&apos;s ethnography (<em>The Rule of
          Water</em>, Oxford, 2003) traced how their institutional
          authority unwound. K. Sivasubramaniyan&apos;s 2007 paper
          quantified Tamil Nadu-wide tank-irrigated area decline
          since 1961. The 2020-21 peer-reviewed Vandiyur cascade
          study (Sashikkumar et al., <em>Discover Applied Sciences</em>)
          tracked borewell depths along Madurai&apos;s flagship
          surviving network: roughly eight metres in the early
          1990s, sixty metres by 2007, two hundred metres by
          2017-18. India Water Portal&apos;s field studies recorded
          a 300% peri-urban land-cover increase between 2002 and
          2018, with monsoon rainfall down 11.2% (NE) and 10.6%
          (SW) over the same window. Mongabay India&apos;s 2021
          Vaigai feature established that about eighty-five per
          cent of the Vaigai dam&apos;s water now arrives via the
          Mullaperiyar tunnel from Kerala&apos;s Periyar catchment
          - the Vaigai&apos;s own basin contributes only fifteen
          per cent. The Columbia GSAPP and Thiagarajar College of
          Engineering studio (<em>Water Urbanism in Madurai</em>,
          2016) was one entry in this lineage, not the foundation
          of it.
        </p>
        <p>
          What follows is a comparison between what those sources
          documented and what our own pipeline measures from
          live feeds today.
        </p>
        <ThenNow
          thenLabel="Earlier record"
          nowLabel="2024-2026 (our pipeline)"
          rows={[
            {
              metric: "Groundwater along the Vandiyur cascade",
              then: "8 m → 60 m → 200 m (1990s / 2007 / 2017-18, Sashikkumar et al.)",
              now: "Madurai West block: 105.8% draft-to-availability, over-exploited (CGWB GWR2024)",
              verdict: "worse",
            },
            {
              metric: "Vaigai water quality (BOD, downstream of Madurai)",
              then: "Stretch on CPCB priority polluted-rivers list (NWMP 2018)",
              now: "BOD doubled, 2.0 → 4.2 mg/L (CPCB Sellur to Anuppanadi, 2021 → 2024)",
              verdict: "worse",
            },
            {
              metric: "Vaigai inflow composition",
              then: "Increasing Mullaperiyar dependence noted from 1990s",
              now: "~85% from Mullaperiyar tunnel; ~15% from Vaigai’s own catchment (Mongabay 2021)",
              verdict: "worse",
            },
            {
              metric: "Reservoir state (Vaigai + Mullaperiyar)",
              then: "Recurring summer-month low-storage crises since 2003",
              now: "~7% of operational capacity (May 2026, pre-monsoon, our reservoir feed)",
              verdict: "same",
            },
            {
              metric: "Tank surface lost to encroachment",
              then: "14 fully lost urban tanks; ~16.5 sq km gone (Vencatesan inventory)",
              now: "Same 14 unrecovered; HC PILs ongoing on at least three (Vandiyur, Thenkal, Sengulam)",
              verdict: "same",
            },
            {
              metric: "Open defecation",
              then: "Pre-Swachh-Bharat-baseline figures put Madurai in double digits (2014)",
              now: "Single digits, post-Swachh Bharat 2014-2019 + AMRUT-1 connections",
              verdict: "better",
            },
            {
              metric: "Water-body legal protection",
              then: "Ad-hoc PILs, no public registry (pre-2024)",
              now: "Madras HC March 2024 order: TN to publish a public water-body registry within six months",
              verdict: "better",
            },
            {
              metric: "Functional kanmoi cascade",
              then: "Already disconnected by 1990s bund road + sand-mining bed drop",
              now: "Still largely disconnected. No bed-restoration plan on any current DPR.",
              verdict: "same",
            },
          ]}
        />
        <p>
          Sanitation has improved. Legal frameworks have improved.
          Specific tanks - Vandiyur, Madakulam, Anaikondan in the
          Arittapatti BHS - have had bunds repaired and inflow
          channels cleared. The hydraulic system itself, the
          river-channel-tank cascade that defined this city for
          two thousand years, has not. Vaigai BOD downstream of
          Madurai has doubled in four years. Groundwater under
          the Meenakshi temple, under the Tirumalai Nayakkar
          Mahal, under the Vandiyur teppakulam, is being drafted
          faster than it recharges. The reservoirs that Chithirai
          and the float festival quietly depend on sit at
          single-digit-percent capacity in early summer. The
          cascade has not reconnected because no one in any
          department&apos;s plan has yet drawn the line from sand
          mining to bed drop to severed channel to dry kanmoi to
          dry teppakulam to a stalled festival no city will admit,
          in writing, that it is losing.
        </p>
        <CTA href="/madurai">See today&apos;s live numbers</CTA>
      </Chapter>

      <Chapter
        id="what-we-owe-it"
        number={4}
        title="What we owe it"
        thesis="The fix is not heroic. It is owed."
      >
        <p>
          A city that has stood for two thousand years is not a
          private possession. It was given to us. The kanmoi we
          built our courthouses on were not ours to bury. The river
          we mined the bed out of was not ours to break. The
          obligation called <em>kudimaramathu</em> - that the people
          who used the cascade owed it maintenance - did not end
          when the colonial office stopped recording it. We just
          stopped paying.
        </p>
        <PullQuote attribution="Think Tank project, GSAPP / TCE 2016">
          Shift the perception of tanks from neglected backyard to
          front yard of the city.
        </PullQuote>
        <p>
          What restoration looks like, concretely, is not glamorous.
          It is a sequence of unromantic decisions, some of them
          already in motion:
        </p>
        <ul>
          <li>
            <strong>The Madras High Court water-body registry.</strong>{" "}
            The March 2024 order in <em>R. Manibharathi v Union of
            India</em> directs Tamil Nadu to publish a public website
            listing every water body with survey number, location,
            original and present extent, within six months. Status:
            pending compliance. Until compliance happens, every tank
            is plausibly deniable.
          </li>
          <li>
            <strong>Madurai Smart City Mission and AMRUT-2 tank interventions.</strong>{" "}
            Discrete kanmoi - Vandiyur,
            Madakulam, others - have been de-silted, bunds repaired,
            inflow channels cleared. They are showing what a properly
            maintained kanmoi looks like in 2026. Single tanks
            though, not a cascade. Sakthivadivel and Shah&apos;s
            2019 IWMI evaluation of Tamil Nadu&apos;s 2017
            Kudimaramathu revival was sceptical for exactly this
            reason: state-led tank rehabilitation that does not
            also rebuild the social authority of{" "}
            <em>kudimaramathu</em> - the obligation, not just the
            engineering - tends to cosmetically restore one tank at
            a time and lose the cascade.
          </li>
          <li>
            <strong>The Rs 440 crore Vaigai cleanup proposal.</strong>{" "}
            Submitted by Madurai Municipal Corporation in 2024,
            covering pumping-station overhaul plus river cleanup.
            Status: pending Tamil Nadu government sanction.
          </li>
        </ul>
        <p>
          What is missing from every one of those plans, and what
          this dashboard exists to surface: the sand-mining bed
          drop. The kanmoi cannot reconnect to the Vaigai unless the
          riverbed is either raised back up - check dams, sediment
          retention, banned mining enforced rather than scheduled -
          or the channel intakes are lowered to meet the new bed.
          Until that calculation appears on someone&apos;s
          engineering plan, every other restoration is a
          single-tank intervention dressed up as cascade revival. A
          temple tank fed only by direct rainfall is a swimming
          pool, not a teppakulam.
        </p>
        <p>
          Madurai&apos;s names form a single civilisation -{" "}
          <em>Koodal Maanagar</em> of the Sangam,{" "}
          <em>Marutham</em> of the riverine landscape, the Athens
          of the East, the city of tanks, the city that does not
          sleep. Each describes a part of the same hydraulic
          continuity. Restoring the cascade does not mean
          rebuilding what was lost. It means reconnecting what is
          still there to the river that used to feed it. Some of
          that work is already underway. The rest is what this
          dashboard tracks.
        </p>
        <CTA href="/madurai/water-bodies">
          See the cascade today on the map
        </CTA>
        <CTA href="/madurai/facts">Quotable facts and citations</CTA>
      </Chapter>
    </StoryPage>
  );
}
