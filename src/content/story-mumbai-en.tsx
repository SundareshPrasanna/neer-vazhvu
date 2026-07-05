/**
 * Mumbai water story - "City of seven islands: a place with no river, and the
 * forty-five litres that divide it." Composed from the Lede / Chapter /
 * PullQuote / ThenNow / CTA shortcodes.
 *
 * Source spine for verifiable claims:
 *   - Nikhil Anand, Hydraulic City: Water and the Infrastructures of Citizenship in Mumbai (Duke 2017) - keystone
 *   - Sharada Dwivedi & Rahul Mehrotra, Bombay: The Cities Within (1995)
 *   - Gillian Tindall, City of Gold: The Biography of Bombay (1982)
 *   - Sahapedia - "Pyaaus of Mumbai" and Banganga / Walkeshwar historical studies
 *   - Madhav Chitale Fact-Finding Committee Report on Mumbai Floods (2006, 3 volumes)
 *   - Praja Foundation, Status of Civic Issues in Mumbai (2024)
 *   - Mandala et al., water-access study of notified vs non-notified slums (2023)
 *   - National Green Tribunal orders: Mahul (2015), Powai Lake (2024-25)
 *   - Contemporary press: 26/7/2005 deluge, Coastal Road mangroves (SC 2025),
 *     salt-pan transfer, April 2025 tanker strike, Mithi desilting probe, Gargai tender (Dec 2025)
 *
 * Images: /public/images/story/mumbai/* - every file's provenance, license
 * and processing is recorded in MANIFEST.json in that directory (Wikimedia
 * Commons; PD + CC BY-SA). English-only; Marathi follows in the i18n pass.
 */

import { StoryPage } from "@/components/story/story-page";
import { Chapter, CTA, Figure, Hero, Lede, PullQuote, ThenNow } from "@/components/story/story-shortcodes";

export function MumbaiStoryEn() {
  return (
    <StoryPage
      cityId="mumbai"
      cityDisplayName="Mumbai"
      tagline="City of seven islands: a place with no river, and the forty-five litres that divide it"
      lastRevised="July 2026"
    >
      <Hero
        src="/images/story/mumbai/banganga-2023.jpg"
        alt="Banganga Tank at Walkeshwar: a rectangular stepped stone tank ringed by dense residential towers, with temple deepstambhas at the water's edge."
        source="Wikimedia Commons"
        credit="Alexey Komarov, 2023 (CC BY-SA 4.0)"
      />
      <Lede>
        Mumbai was born without a river. The seven islands the Portuguese handed
        to the English in 1661 - Colaba, Old Woman&apos;s Island, Bombay,
        Mazagaon, Parel, Worli and Mahim - were low, brackish and sea-girt, and
        the only fresh water on them fell from the sky. So the islanders stored
        it: in <em>talao</em> (तळे), tanks cut into rock and lined with stone, and
        in <em>vihir</em> (विहीर), wells sunk to the thin freshwater lens beneath
        the basalt. Four centuries later the city drinks from seven lakes up to a
        hundred and thirty kilometres away, moves close to 3,850 million litres a
        day through its mains - and still cannot answer the oldest question a
        coastal settlement asks: who, on a thirsty island, gets the water first.
        Today the answer is measured in litres. A household in a notified slum
        receives about forty-five litres per person per day. A household a road
        away, in a non-slum building, receives about a hundred and thirty-five.
      </Lede>

      <Chapter
        id="talao"
        number={1}
        title="Talao: the water beneath the seven islands (to 1670)"
        thesis="A city with no river learned to store rain in stone - tanks and wells and one freshwater spring beside the sea - long before it had a single pipe."
      >
        <p>
          The original Mumbaikars were the Koli fisherfolk, whose
          <em> gaothans</em> (village cores) still sit, stubbornly, inside the
          glass city - Worli Koliwada, Khar Danda, Versova. Their water was the
          creek for the boats and the tank for the pot, and for centuries the two
          were kept rigorously apart. The most storied of those tanks is the
          Banganga (बाणगंगा) at Walkeshwar, on the southern tip - a rectangular
          stone <em>talao</em> fed by a freshwater spring that wells up within a
          few hundred metres of the Arabian Sea. Tradition ties it to the
          Silhara dynasty and a temple complex of the twelfth century; whatever
          its exact age, it is the proof of the islands&apos; founding fact, that
          fresh water here was a point source to be guarded, not a flow to be
          taken for granted.
        </p>
        <p>
          As the East India Company turned its swampy dowry into a trading town,
          it dug more of the same. Private philanthropy financed tanks the way it
          later financed hospitals: the Parsi merchant Framji Cowasji Banaji built
          a large tank near the Esplanade in the 1830s; Cowasji Patel, Gowalia,
          Babula and a dozen other named tanks pock the early maps. Stepwells -
          <em> baodi</em> (बावडी) in the regional vocabulary - and shallow wells
          did the daily work. It was a water system without a watershed: every
          drop was either caught where it fell or carried in. That worked while
          the town was small. It stopped working the moment the islands became
          one.
        </p>
        <Figure
          src="/images/story/mumbai/bombay-1843-murphy-map.jpg"
          alt="An 1843 map of the Island of Bombay and Colaba, drawn tall and narrow, showing the fused islands, the Fort at the south-east and the open low-lying Flats in the centre."
          caption="Murphy's map of the Island of Bombay and Colaba, 1843 - the seven islands two generations after the Vellard fused them. The open 'Flats' in the centre are the low bowl the city later built over: the ground that drowned on 26 July 2005."
          source="https://commons.wikimedia.org/wiki/File:1843_Murphy_Map_of_Island_of_Bombay_and_Colaba.png"
          credit="Materials Towards a Statistical Account of the Town and Island of Bombay, 1843 (public domain)"
          aspect="3/4"
          fit="contain"
        />
        <PullQuote attribution="Sharada Dwivedi &amp; Rahul Mehrotra, Bombay: The Cities Within (1995)">
          The making of Bombay was the making of land - and the unmaking of the
          tidal water that had always defined it.
        </PullQuote>
      </Chapter>

      <Chapter
        id="the-first-pipe"
        number={2}
        title="The first pipe: the Vellard, Vihar, and the Sanitary Commissioner (1782-1900)"
        thesis="Joining the islands created a city too large for its tanks; cholera and a colonial Sanitary Commissioner brought the first pipe - and the first inequity built into it."
      >
        <p>
          Between 1782 and 1784 Governor William Hornby drove a causeway, the
          Hornby Vellard, across the Worli breach where the sea poured in at high
          tide. It was an act of reclamation that fused the islands into a single
          landmass and made the modern city possible - and it bequeathed Mumbai
          its founding hydrological curse, a bowl of low-lying made land behind a
          sea wall, draining badly. The town that grew on it outran its tanks
          within two generations. Wells turned saline and foul; cholera arrived
          with the crowds. In 1845 the citizens petitioned for a proper supply,
          and the colonial state, which measured a port by its death rate, finally
          listened.
        </p>
        <p>
          The answer came from the hills of Salsette to the north. The Vihar
          Waterworks, opened in 1860 under the eye of the Municipal Commissioner
          Arthur Crawford, dammed the headwaters of the Mithi at Vihar lake and
          piped the city its first impounded, gravity-fed water. Tulsi followed in
          1879, Tansa in 1892 - the Tansa main, a hundred-odd kilometres of iron,
          one of the engineering marvels of Victorian India. For the well-to-do
          fort and the European quarter, water now arrived at the turn of a tap.
          For everyone else, it arrived at the <em>pyaav</em> (पाणपोई) - the ornate
          public drinking fountain, financed by the same merchant philanthropy
          that had built the tanks, dotting the streets so the labouring city
          could drink.
        </p>
        <Figure
          src="/images/story/mumbai/vihar-lake-mulund.jpg"
          alt="A wide panorama of Vihar Lake surrounded by forested hills, with the high-rise skyline of Mulund rising directly behind the ridge."
          caption="Vihar Lake from Yogi Hills, 2025, the towers of Mulund behind. The reservoir that gave Bombay its first piped water in 1860 still sits inside the city that outgrew it - today it supplies about 90 of Mumbai's roughly 4,000 MLD."
          source="https://commons.wikimedia.org/wiki/File:Mulund_skyline_and_Vihar_Lake_from_Yogi_Hills.jpg"
          credit="Planemad, 2025 (CC BY-SA 4.0)"
          size="wide"
          aspect="21/9"
        />
        <p>
          But a piped city is a city of choices about where the pipe goes, and
          those choices were made in a colonial grammar of worth. The fort, the
          cantonment and the European bungalows were plumbed first and fullest;
          the mill districts of Girangaon and the chawls that housed the workers
          who ran them came last, at lower pressure, for fewer hours. The
          inequality was not an accident of the network - it was the network. A
          map of who got water in 1900 and a map of who gets twenty-four-hour
          water in 2026 are, disquietingly, almost the same map.
        </p>
        <PullQuote attribution="Sahapedia, &ldquo;Pyaaus of Mumbai&rdquo;">
          The fountain was charity made visible: the city could not yet give every
          street a pipe, so it gave the poor a place to cup their hands.
        </PullQuote>
      </Chapter>

      <Chapter
        id="hydraulic-citizenship"
        number={3}
        title="Hydraulic citizenship: Modak Sagar to Middle Vaitarna (1957-2014)"
        thesis="As Mumbai reached deeper into the Western Ghats for water, a household connection became the proof that you were a citizen - and millions were left proving it."
      >
        <p>
          The Salsette lakes could not slake a metropolis. So the city walked its
          intake into the Ghats, dam by dam: Modak Sagar on the Vaitarna in 1957,
          Upper Vaitarna in 1973, the vast Bhatsa - today nearly half of
          Mumbai&apos;s supply - impounded in stages through 1981, and finally
          Middle Vaitarna in 2014, the first new source in a generation. Each dam
          pushed the source farther from the tap and the tap farther from the
          people the dam displaced. The water now travelled a hundred kilometres
          and more to reach a city where, increasingly, the people who needed it
          most had no legal way to receive it.
        </p>
        <Figure
          src="/images/story/mumbai/vaitarna-dam-igatpuri.jpg"
          alt="A dam on the Vaitarna river in full monsoon flow, water sheeting over the spillway between green Western Ghats hills."
          caption="The Vaitarna near Igatpuri in monsoon, 2016. The river's dams - Modak Sagar (1957), Upper Vaitarna (1973), Middle Vaitarna (2014) - mark the city's long walk into the Ghats, each one pushing the source farther from the tap."
          source="https://commons.wikimedia.org/wiki/File:Vaitarana_Dam,_Igatpuri.jpg"
          credit="Sailee5, 2016 (CC BY-SA 4.0)"
        />
        <p>
          For the millions arriving into Mumbai&apos;s settlements through the
          mill closures and the boom that followed, a water connection was never
          merely plumbing. It was recognition. To get a metered pipe you had to
          prove your settlement existed, which meant proving you existed - the
          right documents, the right cut-off date, the right councillor. The
          anthropologist Nikhil Anand gave this its name: <em>hydraulic
          citizenship</em>, the way Mumbai&apos;s poor bargain for belonging in the
          literal currency of water pressure, and the way the city&apos;s
          engineers and politicians dispense citizenship one valve at a time.
          Movements like SPARC, the National Slum Dwellers Federation and Mahila
          Milan turned that bargaining into method, enumerating themselves so the
          state could no longer say they were not there.
        </p>
        <p>
          The same decades laid a darker pipe. Tens of thousands of families
          settled along the Tansa main itself - the very artery that carried the
          city its drinking water - in the only vacant land a poor migrant could
          find. The state would later decide that those people, sitting atop the
          pipe, were a security risk to the water inside it. Where to move them
          became a question the next chapter answers, in a place called Mahul.
        </p>
        <PullQuote attribution="Nikhil Anand, Hydraulic City (Duke University Press, 2017)">
          Water does not flow to those who need it, but to those who are able to
          make claims on the state - and pressure, in Mumbai, is both a
          hydraulic and a political fact.
        </PullQuote>
      </Chapter>

      <Chapter
        id="foam-flood-forty-five-litres"
        number={4}
        title="Foam, flood, and forty-five litres (2005-2026)"
        thesis="Three things broke into the open after 2005 - the flood the city had engineered, the buffers it kept selling, and the inequity it had piped in from the start."
      >
        <p>
          On 26 July 2005 the Santacruz observatory recorded 944 millimetres of
          rain in twenty-four hours. The Mithi - the river the city had walled,
          narrowed and forgotten, the same river born at the Vihar and Powai
          overflows that gave Mumbai its first pipe - could not carry it, and
          rose into the bowl behind the Vellard. More than a thousand people died
          across the region. The Chitale Fact-Finding Committee, three volumes the
          following year, read like an indictment of the whole hydraulic history:
          the holding ponds built over, the storm drains designed for a colonial
          rainfall and never upgraded, the Mithi reduced to a sewer. Two decades
          on, the city has spent thousands of crores on the Mithi and on the
          BRIMSTOWAD drainage plan - and in 2025 the desilting contracts that were
          meant to keep it flowing became the subject of a money-laundering probe.
        </p>
        <Figure
          src="/images/story/mumbai/borivali-flood-2005.jpg"
          alt="A red state-transport bus abandoned at an angle on a wrecked road near a flyover, debris and stranded vehicles around it."
          caption="A state transport bus near the Western Express Highway flyover at Borivali, 28 July 2005 - two days after Santacruz recorded 944 mm of rain in twenty-four hours."
          source="https://commons.wikimedia.org/wiki/File:An_ST_bus_near_the_WEH_flyover_at_Borivali_(35520283).jpg"
          credit="Rakesh, Bangalore, 2005 (CC BY-SA 2.0)"
        />
        <p>
          Mumbai&apos;s defences against the next deluge are the same wetlands it
          keeps converting. Salt pans and mangroves absorb the surge; in March
          2025 the Supreme Court cleared roughly forty-five thousand mangroves for
          the Coastal Road&apos;s northern reach, and two hundred and fifty-six
          acres of public salt-pan land were earmarked for the Adani-led Dharavi
          redevelopment. The city floods, and then builds over the ground that
          would have drained it. iFLOWS-Mumbai, the integrated flood-warning model
          built with public money, briefs officials but not the public; the best
          open flood signal Mumbaikars have is a research radar network run out of
          the Indian Institute of Tropical Meteorology.
        </p>
        <p>
          And beneath the flood runs the older inequity, now measured precisely.
          Praja Foundation&apos;s 2024 audit found that one ward in twenty-four
          gets twenty-four-hour water, that the citywide average is about five and
          a third hours a day, and that a metered slum household receives roughly
          forty-five litres per person against a hundred and thirty-five for a
          non-slum one. A peer-reviewed study put the gap between notified and
          non-notified slums at thirty-eight per cent even after accounting for
          income. When the tankers that fill the gap went on strike in April 2025,
          the city invoked the Disaster Management Act - the first known use of it
          for a water dispute. And the families once moved off the Tansa pipeline
          ended up in Mahul, a resettlement colony ringed by refineries that the
          National Green Tribunal had already declared, in 2015, unfit for human
          habitation.
        </p>
        <ThenNow
          thenLabel="The island city"
          nowLabel="The metropolis"
          rows={[
            { metric: "Source of water", then: "On-island tanks, wells, one spring", now: "7 lakes, up to 130 km away", verdict: "worse" },
            { metric: "Who is served first", then: "Fort + European quarter", now: "1 of 24 wards gets 24x7", verdict: "same" },
            { metric: "Litres per person, poorest", then: "What the pyaav could give", now: "~45 LPCD (slum) vs ~135 (non-slum)", verdict: "worse" },
            { metric: "Flood defence", then: "Tidal creeks + salt pans + mangroves", now: "~40% of mangroves lost since 1991", verdict: "worse" },
          ]}
        />
        <p>
          The question the seven islands first asked - who, on a thirsty island,
          drinks first - is still the question. Mumbai has answered it with ever
          longer pipes and ever larger dams, the next one, Gargai, tendered in
          December 2025 to drown two thousand acres of forest and move six hundred
          families. But more water has never been the same thing as fairer water.
          The forty-five litres are not a supply problem. They are a citizenship
          problem - the same one the city has carried, unresolved, since the first
          pipe reached the fort and stopped.
        </p>
        <PullQuote attribution="Praja Foundation, Status of Civic Issues in Mumbai (2024)">
          The water reaches the city. It is the citizen it does not always reach.
        </PullQuote>
      </Chapter>

      <CTA href="/mumbai">
        See the inequality in numbers on the live dashboard - the metropolitan
        supply ranking, the days of water left, and the commitments the city
        has made to close the gap.
      </CTA>
    </StoryPage>
  );
}
