/**
 * Chennai water story - "City of estuaries: how Madras drowns and runs
 * dry in the same year." Composed from the Hero / Lede / Chapter /
 * Figure / BeforeAfter / PullQuote / ThenNow / CTA shortcodes.
 *
 * Image slots reference /public/images/story/chennai/* - the manifest
 * lives in MANIFEST.json next to the images. Every Figure passes a
 * `source` (and usually `credit`) explicitly; we do not ship images
 * without provenance.
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
  BeforeAfter,
  PullQuote,
  CTA,
  ThenNow,
} from "@/components/story/story-shortcodes";

export function ChennaiStoryEn() {
  return (
    <StoryPage
      cityId="chennai"
      cityDisplayName="Chennai"
      tagline="The history of water in Chennai"
      lastRevised="May 2026"
    >
      <Hero
        src="/images/story/chennai/madras-beach-1851.jpg"
        alt="Beach of Madras, c.1851. A hand-coloured salt print showing colonial buildings on the foreshore at Madras with the Bay of Bengal stretching beyond."
        source="Wikimedia Commons / British Library"
        credit="Frederick Fiebig, c. 1851 (public domain)"
      />
      <Lede>
        Walk into almost any old Chennai neighbourhood and you
        are standing on water, or on what used to be water.
        Triplicane is <em>Thiru-Alli-Keni</em> (திருவல்லிக்கேணி),{" "}
        the sacred lily tank. Mylapore still launches its god on
        a wooden raft across the four-acre Kapaleeshwarar tank
        once a year, the way the Cholas would have. Tambaram,
        Madambakkam, Pallikaranai, Vyasarpadi, Korattur,
        Velachery, Otteri: half the place names on a Chennai
        bus board are <em>eris</em> (ஏரி), or named for them.
        They are not metaphors. They are the actual water bodies
        the city was built around. The same city that drowned
        in December 2015 was the city declared dry on the
        morning of 19 June 2019, when its four main reservoirs
        held about nineteen million cubic feet of usable
        storage between them, effectively zero. The two
        catastrophes were the same catastrophe in different
        seasons. The sponge that had absorbed the monsoon for
        two thousand years, and held it through summer, was
        gone. What this dashboard tracks is whether and how it
        comes back.
      </Lede>

      <Chapter
        id="how-water-made-madras"
        number={1}
        title="How water made Madras"
        thesis="Madras was not built next to water. It was built on it."
      >
        <p>
          On 22 August 1639, Francis Day of the East India Company
          secured a three-mile coastal strip from Damarla
          Venkatadri Nayaka, a vassal of the last Vijayanagara
          king. Fort St George, the first English fort in India,
          rose on the sand at the Cooum&apos;s estuary by April
          1640. The reason the Company chose this stretch of
          fishing villages over Mylapore (the older port of the
          Portuguese, two centuries old already) was a sandbar.
          The site was chosen for its anchorage, not its hydrology.
          For the next century and a half, water for the new
          settlement came from what the Company&apos;s own records
          called <em>traditional Nullahs, natural streams, rivers,
          tanks (Ooranies and Nalla Thanee Ooranies) and open
          wells</em>{" "}- in other words, from the same pre-colonial
          system the Tondaimandalam villages had built, and
          maintained without any European help, for at least a
          thousand years before the Company arrived. The Cholas
          had inscribed the rules for it. The Pallavas had
          inherited them.
        </p>
        <p>
          That system was the <em>eri</em> (ஏரி) cascade. When
          rain fell on the Eastern Ghats it did not flow free to
          the Bay; it stepped down through hundreds of tanks,
          each spillway feeding the next. The smaller tanks - those
          under a hundred acres of <em>ayacut</em>, the irrigated
          area below them - were the village&apos;s, looked after
          by an <em>eri-variyam</em> or <em>kulavariyam</em>
          committee whose name appears on Chola copper-plates
          from the tenth century onward. The larger
          &ldquo;system tanks&rdquo; were the king&apos;s. By the
          time the Madras Public Works Department got around to
          counting them, the Madras Presidency held something on
          the order of seventy-five thousand of these tanks; Tamil
          Nadu inherited at least thirty-nine thousand at
          Independence, and they irrigated close to half of the
          state&apos;s cropped land. Chengalpattu district alone -
          the city&apos;s own hydrological hinterland, the country
          immediately to the south and west - held thousands.
        </p>
        <p>
          To live in this country was to owe the cascade something.
          The obligation was called <em>kudimaramathu</em>,
          community tank repair, and it ran continuously from
          the Chola period into the early colonial era. The
          Oxford anthropologist David Mosse, whose <em>The Rule of
          Water</em> (Oxford, 2003) is the definitive ethnography
          of South Indian tank governance, documents how this
          was simultaneously hydraulic infrastructure, caste-state
          authority, and temple economy - the same institution
          doing three jobs at once. The hereditary <em>neerkatti</em>
          (water turner) opened and closed a tank&apos;s sluice
          on a calendar that was both agricultural and ritual.
          The kanmoi did not maintain themselves; nor did the
          people pretend they did.
        </p>
        <Figure
          src="/images/story/chennai/madras-1822-ravenshaw-map.jpg"
          alt="Plan of the town of Madras and its limits, surveyed in 1822 by Captain W. Ravenshaw of the Civil Engineers, engraved by J. Walker. Shows the walled Fort, Black Town, the Cooum river running east into the sea, and the elongated tank polygons including the Long Tank, Spur Tank, Nungambakkam Tank and Mylapore Tank."
          caption="Madras and its limits, surveyed in 1822 for the Justices in Sessions. The Cooum runs east into the Bay across the upper third of the map, with Fort St George at its mouth and Black Town beyond. The elongated polygons inside and around the city are the surviving tanks at the time the survey was made: the Long Tank running north-south on the western edge (its overflow drained east via the Mambalam canal to the Adyar), the Spur Tank at Chetpet, the Nungambakkam Tank, and the Mylapore Tank to the south. None of these survives today as water."
          credit="Captain W. Ravenshaw, surveyor; engraved by J. Walker"
          source="Wikimedia Commons (public domain)"
          aspect="3/2"
          fit="contain"
          size="wide"
        />
        <p>
          Inside the municipal boundary the same logic produced a
          smaller, denser cascade. The {`Long Tank`} - really two
          linked reservoirs, the Mylapore Tank south and the
          Nungambakkam Tank north, five miles long and a mile wide
          at peak - defined the city&apos;s western limit until
          1921. Its overflow drained east through the Mambalam
          canal into the Adyar. The Spur Tank at Chetpet,
          Vyasarpadi tank (into which water from twenty-eight
          smaller tanks once flowed), the Mylapore tank, the
          Perambur and Peravallur and Madavakkam tanks, the
          Chetput and Kottur and Kalikundram tanks - all of them
          held water year-round and fed the wells around them.
          Around 1900, by S. Muthiah&apos;s reading of the Madras
          municipal records in <em>Madras Rediscovered</em>,
          there were something like three hundred water bodies
          inside the city. The eri network was not folklore. It
          was the city&apos;s plumbing.
        </p>
        <PullQuote attribution="S. Muthiah, Madras Rediscovered">
          About a hundred years ago, Madras had within its
          municipal limits something like three hundred water
          bodies. Today, there are hardly a couple of dozen.
        </PullQuote>
        <p>
          South of all this, beyond the city&apos;s boundary
          until the late twentieth century, lay the southern
          aquifer recharge - the <em>Pallikaranai marsh</em>.
          One of only two natural freshwater marshes in South
          India, and the only one inside any Indian metropolis,
          it covered roughly six thousand hectares at its
          mid-twentieth-century baseline. The marsh was where
          the city&apos;s
          monsoon went when it had nowhere else to go: the flat
          terminus of the Adyar and Buckingham basins, a sponge
          that swelled in November and shrank by April. It was
          not a wasteland. It was the bottom of a watershed.
        </p>
      </Chapter>

      <Chapter
        id="how-it-came-undone"
        number={2}
        title="How the cascade came undone"
        thesis="The cascade did not collapse from one cause. It was unwound, piece by piece, by named decisions across three eras."
      >
        <p>
          The British East India Company found the eri system
          working. The Madras Presidency that the Crown
          inherited from the Company in 1858 did not. The
          colonial engineering office did not see a functioning
          hydraulic civilisation; it saw obsolete plumbing.
          Large dams and centralised waterworks were{" "}
          <em>modern</em>. A village-managed cascade maintained
          by a hereditary water-turner and an annual labour
          obligation was, in the colonial mind, something to be
          replaced. Mosse&apos;s 1999 paper{" "}
          <em>Colonial and Contemporary Ideologies of
          &lsquo;Community Management&rsquo;</em>{" "}argues that
          the very story of decayed <em>kudimaramathu</em>{" "}was
          constructed by colonial administrators to justify
          state takeover. The eris did not stop working because
          the institution failed. The institution was first
          declared failed, and then starved of the authority that
          kept it running.
        </p>
        <p>
          Two pieces of legislation, made in Madras itself,
          finished the job. The{" "}
          <strong>1865 Madras Irrigation Cess Act</strong>{" "}
          let the colonial state collect a
          separate revenue on water, distinct from the land tax;
          the village&apos;s labour obligation to the cascade
          and its right to use the cascade&apos;s water were now
          legally separate transactions. The historian Aditya
          Ramesh (<em>Studies in History</em>, 2018) calls this
          the moment colonial law made the &ldquo;natural&rdquo;
          and &ldquo;customary&rdquo; distinction that broke
          kudimaramathu. The{" "}
          <strong>1882 Madras Compulsory Labour Act</strong>{" "}
          repealed the customary obligation
          itself. By the end of the century, every system tank
          over a hundred acres had passed to the Public Works
          Department, which had neither the local knowledge nor
          the local incentive to maintain them at the cadence
          they needed.
        </p>
        <p>
          Then came an engineering project that, like a knife
          drawn across a country, severed the cascade laterally.
          The <strong>Buckingham Canal</strong> began in 1806 as
          Cochrane&apos;s Canal, an eighteen-kilometre saltwater
          cut from North Madras to Ennore financed by Basil
          Cochrane. In 1877-78, during the Great Famine that
          killed several million people across the Madras
          Presidency, the eight-kilometre stretch linking the
          Adyar and Cooum was excavated as famine relief, at a
          cost of three million rupees. By the time it was
          renamed for the Duke of Buckingham in 1878, the canal
          ran 796 kilometres parallel to the Coromandel coast,
          from Kakinada in present-day Andhra Pradesh to
          Pichavaram in Tamil Nadu. It sliced laterally across
          the south-flowing Coromandel drainage. Tanks that had
          spilled into the natural slope now spilled into a
          fixed-level navigation channel. Some lost their
          downstream cascade entirely. Today the canal is
          largely a sewer.
        </p>
        <p>
          After 1947, the colonial framing carried over. Every
          named tank inside the city limit became a piece of
          land waiting for an excuse.
        </p>
        <PullQuote>
          The District Court complex stands on Sengulam tank&apos;s
          bed in Madurai. T. Nagar stands on the Long Tank&apos;s.
        </PullQuote>
        <p>
          <strong>1923.</strong> The Madras Presidency, under the
          Madras Town Planning Act of 1920, drained the southern
          half of the Long Tank - the Mylapore Tank - to lay out
          the city&apos;s first planned neighbourhood. Theyagaraya
          Nagar, named for Sir Pitti Theagaraya Chetty, opened
          for plotting in 1923-25. The shopping district that
          most of urban Tamil Nadu now thinks of as the centre
          of Chennai is built on a drained tank.{" "}
          <strong>1971.</strong> The northern half - the
          Nungambakkam Tank - was filled to make Valluvar Kottam,
          the memorial to the poet-saint Tiruvalluvar. Spur Tank
          at Chetpet was encroached and silted up by 1939; the
          name survives as Spur Tank Road. The Vyasarpadi tank,
          into which twenty-eight other tanks once flowed, was
          buried under the Tamil Nadu Housing Board&apos;s
          Vyasarpadi Neighbourhood Scheme and the Vyasarpadi
          Industrial Estate in the 1960s and 70s. Of the three
          hundred water bodies S. Muthiah counted within the old
          city limit at the turn of the twentieth century, by the
          late 1990s scarcely two dozen named ones remained as
          functional water inside that footprint - the rest had
          been drained, paved, or built over.
        </p>
        <p>
          South of the city, the larger sponge went under the
          same way - faster.
        </p>
        <Figure
          src="/images/story/chennai/pallikaranai-marsh-2022.jpg"
          alt="Pallikaranai marsh in 2022, photographed from the southern bank in Sholinganallur. Greater flamingoes wade in shallow water in the foreground; an IT park rises directly behind, with high-rise glass towers reflecting in the marsh."
          caption="Pallikaranai marsh, April 2022. Greater flamingoes in the foreground; the IT park behind is built on what was, sixty years ago, the same marsh. The marsh covered roughly 6,000 hectares at its mid-twentieth-century baseline. By 2016 research (Nagendran et al.) only about 593 hectares survived. In April 2022 it was finally designated a Ramsar site of international importance, with a gazetted area of 1,247 hectares - less than a quarter of what was there when the city&apos;s southern boundary was drawn."
          credit="Timothy A. Gonsalves (Tagooty)"
          source="Wikimedia Commons (CC BY-SA 4.0)"
          aspect="3/2"
          size="wide"
        />
        <p>
          Pallikaranai shrank from about six thousand hectares
          at its mid-twentieth-century baseline to roughly nine
          hundred by 1972, and to about 593 hectares as
          documented in 2016 research (Nagendran et al.). Care
          Earth Trust&apos;s founder
          Jayshree Vencatesan, whose 2014 dossier on the marsh
          would later become the evidentiary basis for a Madras
          High Court order halting further encroachment, called
          it a ninety per cent loss in four decades. The list of
          named encroachers reads like a directory of the modern
          city: the Perungudi dump (1970, expanded to 56 hectares
          by 2002 and 136 hectares by 2007, receiving roughly
          half of Chennai&apos;s solid waste); the Mass Rapid
          Transit System through the 1990s; Tidel Park,
          inaugurated by Prime Minister Vajpayee on 4 July 2000
          on eight acres at Taramani; the National Institute of
          Ocean Technology; SIPCOT IT Park at Siruseri across two
          thousand acres; the forty-five-kilometre Old
          Mahabalipuram Road bisecting the cascade that fed the
          marsh from the north. None of these decisions were
          taken by accident. Each was approved, gazetted, and
          built by an identifiable office.
        </p>
        <p>
          And upstream of the city, the same engineers who had
          built the Krishna Water inter-state agreement in 1983
          and the New Veeranam Cauvery transfer in 2004 - both
          intended to backstop a city whose own cascade was
          failing - were also signing off, year after year, on
          the sand-mining leases that lowered the Palar and
          Kosasthalaiyar beds <em>below</em>{" "}the elevation of the
          channels that used to feed the upstream tanks. The
          Chembarambakkam reservoir filled. The eris that should
          have pre-loaded its catchment did not. The cascade was
          no longer just blocked. Like in Madurai, it was
          physically decoupled from the river it used to draw
          from.
        </p>
        <PullQuote>
          The cascade is not gone. It is just disconnected.
        </PullQuote>
      </Chapter>

      <Chapter
        id="where-we-stand"
        number={3}
        title="Where we stand now"
        thesis="The 2015 floods and the 2019 Day Zero were the same catastrophe in different seasons. The sponge that absorbed the monsoon, and held it through summer, was gone."
      >
        <p>
          Chennai&apos;s water condition is one of the better
          documented in the country. Chola inscriptions named the
          larger eris. The 1822 Ravenshaw plan and the 1834
          <em>Environs of Madras</em>{" "}survey mapped them. S.
          Muthiah&apos;s <em>Madras Rediscovered</em>{" "}compiled the
          lost-tank inventory. David Mosse&apos;s anthropology
          traced how the institutional authority unwound. Care
          Earth Trust&apos;s 2014 dossier identified sixty-one
          interconnected wetlands draining into Pallikaranai.
          MIDS economist S. Janakarajan&apos;s long line of work
          on Chennai&apos;s peri-urban water built the case for
          treating flood and drought as one problem. The
          Comptroller and Auditor General&apos;s 2017 audit of the
          2015 floods documented, in the state&apos;s own
          language, what every household south of the Cooum
          already knew. What follows is a comparison between what
          those sources documented and what our own pipeline
          measures from live feeds today.
        </p>
        <p>
          Two events frame the present. The first was the December
          2015 floods. November rainfall over Chennai metro
          totalled 1,218 millimetres at Nungambakkam - three times
          the normal. On 1 December the metro mean for a single
          day was 286 millimetres; one IMD station recorded 494
          millimetres in twenty-four hours. Chembarambakkam
          reservoir, already nearly full, released about thirty
          thousand cusecs into the Adyar over two days. The
          Comptroller and Auditor General would later record that
          the Compendium of Rules for Chembarambakkam had not been
          revised since 1993, that the wireless link from the dam
          had been non-functional for over six months, that the
          Water Resources Department had no real-time inflow
          forecast as required by Central Water Commission
          guidelines, and that the District Collector and police
          were notified only on the day the flood arrived. The
          official toll across Tamil Nadu was at least 289; some
          aggregations put the death toll inside Chennai near
          500. Economic damage was estimated at around three
          billion US dollars (World Weather Attribution; over
          three million people lost basic services). IIT Madras
          was inundated; the semester was cut short.
        </p>
        <p>
          The second was the morning of 19 June 2019. The 2018
          northeast monsoon had delivered 343.7 millimetres of
          rain to Chennai - against a normal of 757.6, a
          fifty-five per cent deficit. By midsummer 2019, all four
          of the city&apos;s reservoirs had effectively gone dry.
          On the morning of 19 June, combined usable storage
          across the four was about nineteen million cubic feet
          (CMWSSB lake-level archive), against a combined design
          capacity of 11,057 million cubic feet. The city was
          short two hundred million
          litres a day. On 12 July, the first Jolarpettai water
          train pulled into the Villivakkam Integral Coach
          Factory siding: fifty wagons, two and a half million
          litres, drawn from a sub-basin a hundred and fifty
          kilometres away. Private tankers, normally selling a
          twelve-thousand-litre load for fifteen hundred to two
          thousand rupees, were charging three to five thousand.
          The New York Times, the BBC, CNN and Reuters all ran
          the story between June and August. An Indian metropolis
          had run out of water. Globally, that was the headline.
          What it actually was - the same broken sponge that had
          drowned the city forty-three months earlier - did not
          travel as well.
        </p>
        <BeforeAfter
          beforeSrc="/images/story/chennai/puzhal-2018-may-nasa.jpg"
          beforeAlt="Landsat 8 OLI image of Puzhal (Red Hills) reservoir on 31 May 2018, showing the reservoir at near-full capacity. Dark blue water fills the bowl; the surrounding land is green-brown."
          beforeLabel="May 2018"
          afterSrc="/images/story/chennai/puzhal-2019-june-nasa.jpg"
          afterAlt="Landsat 8 OLI image of the same Puzhal (Red Hills) reservoir on 19 June 2019. The reservoir has shrunk to a thin streak of water in one corner; most of the bowl is dry, exposed earth."
          afterLabel="June 2019"
          caption="Puzhal (Red Hills) reservoir, one of the four lakes that supply Chennai. Same Landsat 8 viewpoint, thirteen months apart. The June 2019 image was acquired on the morning the city was officially declared dry; combined usable storage across all four reservoirs was about 19 million cubic feet (CMWSSB lake-level archive), against a 11,057 MCFT design capacity. The 2018 northeast monsoon had delivered 55% less rainfall than normal."
          credit="NASA Earth Observatory images by Lauren Dauphin, using Landsat 8 OLI data from USGS"
          source="NASA Earth Observatory (public domain)"
          aspect="4/3"
        />
        <ThenNow
          thenLabel="Earlier record"
          nowLabel="2024-2026 (our pipeline)"
          rows={[
            {
              metric: "Named water bodies, old municipal limit (~50 sq km)",
              then: "~300 around 1900 (S. Muthiah, Madras Rediscovered)",
              now: "~Two dozen surviving as functional water; the rest drained, paved or built over",
              verdict: "worse",
            },
            {
              metric: "Water bodies, Greater Chennai Corporation (~430 sq km)",
              then: "Untracked at this scale; the GCC footprint absorbed Avadi, Tambaram, Pallavaram and Sholinganallur after 2011",
              now: "~1,636 mapped from OSM in our pipeline (556 ponds, 506 generic 'water', 301 reservoirs, 140 lakes, plus canals/basins). Median area 0.8 ha - mostly small fringe tanks now under the same pressure as the central ones a century ago",
              verdict: "same",
            },
            {
              metric: "Pallikaranai marsh extent",
              then: "~6,000 ha mid-20th century baseline (Nagendran et al. 2016); ~593 ha by 2016",
              now: "1,247 ha gazetted Ramsar Site #2481 (April 2022); ~696 ha as Reserve Forest",
              verdict: "better",
            },
            {
              metric: "Cooum water quality (BOD, downstream stations)",
              then: "Pre-colonial trade route; saint Sambandar's 7th-century Tevaram references villages on its banks",
              now: "Annual midpoint 177 mg/L at Amanjikarai (2021), with peaks up to 345 mg/L; CPCB class Below E - 'dead' (CPCB NWMP, our river-quality data)",
              verdict: "worse",
            },
            {
              metric: "Adyar water quality",
              then: "Adyar estuary fed the eri cascade and the Theosophical Society's gardens",
              now: "Severely degraded; CPCB class E in lower reaches; midpoint DO 1.5-5.8 mg/L across stations (CPCB NWMP, our river-quality data)",
              verdict: "worse",
            },
            {
              metric: "Reservoir state, peak crisis",
              then: "Combined capacity 11,057 MCFT across the four main reservoirs (Poondi 3,231; Cholavaram 881; Red Hills 3,300; Chembarambakkam 3,645)",
              now: "~19 MCFT usable storage on 19 June 2019 (CMWSSB lake-level archive); water trains from Jolarpettai, Vellore",
              verdict: "worse",
            },
            {
              metric: "Imported water dependence",
              then: "City drank from its own tanks and wells until the late 19th century",
              now: "Krishna water (15 TMC, Telugu Ganga, since 1996); Veeranam (180 MLD, since 2004); 200 MLD installed desalination (Minjur 100 MLD since 2010, Nemmeli 100 MLD since 2013); Nemmeli expansion under construction. Storage now spans 6 reservoirs totalling 13,222 MCFT.",
              verdict: "worse",
            },
            {
              metric: "Rainwater harvesting compliance",
              then: "No mandate (pre-2003)",
              now: "Mandatory for all buildings (2003 G.O.); ~40% of installed systems judged 'good quality' (Vivek 2016); >40,000 buildings still non-compliant (TN audit, 2019)",
              verdict: "better",
            },
            {
              metric: "Legal protection of water bodies",
              then: "Ad-hoc PILs, no public registry (pre-2024)",
              now: "Madras HC 2014 wetland-encroachment order (Vencatesan dossier); March 2024 statewide water-body registry order, pending compliance",
              verdict: "better",
            },
            {
              metric: "The cascade itself",
              then: "Already disconnected by mid-1990s sand-mining bed drop",
              now: "Still largely disconnected. Single-tank restorations are happening; the cascade as a system is not",
              verdict: "same",
            },
          ]}
        />
        <p>
          Sanitation has improved. Legal frameworks have improved.
          Specific lakes - Sembakkam, Korattur, Madambakkam,
          Velachery, the Adyar Creek estuary - have had bunds
          repaired and inflow channels cleared. Pallikaranai is a
          Ramsar site. The hydraulic system itself, the
          river-channel-tank cascade that defined this city for
          two thousand years, has not. The Cooum is the most
          polluted river in the country. Groundwater under T.
          Nagar - which is to say, under the bed of the drained
          Long Tank - is being drafted faster than it can
          recharge from a tank that no longer exists. The
          reservoirs that the city now depends on sit downstream
          of upstream tanks that no one in any department&apos;s
          plan is responsible for keeping wet. The cascade has
          not reconnected because no one has yet drawn the line
          from sand mining to bed drop to severed channel to dry
          eri to a thirsty reservoir to a city that, every few
          years, alternates between drowning and running out.
        </p>
        <CTA href="/">See today&apos;s live numbers</CTA>
      </Chapter>

      <Chapter
        id="what-we-owe-it"
        number={4}
        title="What we owe it"
        thesis="The fix is not heroic. It is owed."
      >
        <p>
          A city built on three hundred water bodies, of which two
          dozen now survive, is not a private possession. It was
          given to us. The Long Tank we built T. Nagar on was not
          ours to drain. The Pallikaranai marsh we paved with a
          dump and an IT park was not ours to fill. The
          obligation called <em>kudimaramathu</em>, that the
          people who used the cascade owed it maintenance, did
          not end when the colonial office stopped recording it
          in 1882. We just stopped paying.
        </p>
        <PullQuote attribution="Nityanand Jayaraman, Vettiver Collective">
          Sometimes it seems like what is on paper is more
          important than what is on the ground. If you are
          living on a piece of land that you think you own, you
          still have to prove on paper that you are occupying it.
          If what you are sailing on is water, you must have a
          piece of paper that says this is water.
        </PullQuote>
        <p>
          What restoration looks like, concretely, is not
          glamorous. It is a sequence of unromantic decisions,
          some of them already in motion:
        </p>
        <ul>
          <li>
            <strong>The Pallikaranai Ramsar designation (2022).</strong>{" "}
            Site #2481, gazetted area 1,247
            hectares. The first formal recognition that the
            marsh is not waste land. Triggered by Care Earth
            Trust&apos;s 2014 sixty-one-wetland dossier, which
            became the basis for a Madras High Court order
            halting further encroachment in the watershed. Status:
            designated. Implementation of the management plan is
            still partial. Jayshree Vencatesan was named the
            first Indian recipient of the Ramsar Award for Wise
            Use of Wetlands in 2025.
          </li>
          <li>
            <strong>Tholkappia Poonga and the Adyar eco-restoration.</strong>{" "}
            Phase one rehabilitated fifty-eight acres of the
            Adyar Creek; the full plan covers three hundred and
            fifty-eight acres of the Creek and Estuary. Faunal
            species rose from 141 pre-restoration to 424 today;
            over 1.1 lakh students from 1,446 schools have visited
            the environmental education centre. Named for
            Tolkappiyar, the second-century BCE Tamil grammarian
            whose <em>Tolkappiyam</em>{" "}is the oldest surviving
            text in the language.
          </li>
          <li>
            <strong>The Sembakkam-Korattur cascade pilot.</strong>{" "}
            The Nature Conservancy India, with Care Earth and
            IIT Madras, restored Sembakkam (100 acres, ~100,000
            cubic metres of additional storage, ~7 MLD nature-based
            wastewater treatment) on Cognizant and Grundfos CSR
            funding. The stated frame is the right one: the
            interconnected lakes that drain into Pallikaranai,
            restored as a cascade rather than as individual
            tanks. Care Earth&apos;s 2024 plan for Ambattur,
            Rettai and Korattur eris (the West Chennai cascade)
            does the same.
          </li>
          <li>
            <strong>The 2003 rainwater-harvesting mandate.</strong>{" "}
            Tamil Nadu government order making RWH compulsory for
            every building, with disconnection as the penalty.
            The Rain Centre, founded by Sekhar Raghavan, helped
            drive household compliance. In the years since, audits
            have found that compliance is patchy - more than
            forty thousand buildings still lack working systems,
            and only about forty per cent of installed structures
            are judged effective - but the mandate itself is
            durable.
          </li>
          <li>
            <strong>The 2024 Madras High Court water-body registry order.</strong>{" "}
            The same statewide directive
            that pushes Madurai to publish a public register of
            every water body, with survey number and original and
            present extent, applies to Chennai. Status: pending
            compliance. Until compliance happens, every encroached
            tank is plausibly deniable.
          </li>
        </ul>
        <p>
          What is missing from every one of those plans, and what
          this dashboard exists to surface: the cascade itself.
          The eris cannot reconnect to the river system that fed
          them while sand-mining keeps lowering the bed of the
          Palar and the Kosasthalaiyar below the channels that
          used to draw from them. The reservoirs cannot be made
          drought-proof while the upstream tanks that are
          supposed to pre-load their catchments are silted up,
          encroached, or simply absent from any department&apos;s
          line item. A single restored lake fed only by direct
          rainfall is, like a temple tank without its feeder
          channel, a swimming pool. The work this dashboard
          tracks is whether, eri by eri, the cascade comes back.
        </p>
        <p>
          Madras was built at the end of a watershed. Chennai
          will only be drought-proof and flood-proof when it
          starts behaving like one again.
        </p>
        <CTA href="/water-bodies">
          See the cascade today on the map
        </CTA>
        <CTA href="/facts">Quotable facts and citations</CTA>
      </Chapter>
    </StoryPage>
  );
}
