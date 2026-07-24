/**
 * Delhi water story - "The city that stored water for a thousand years, and
 * the twenty-two kilometres where its river dies." Composed from the Lede /
 * Chapter / PullQuote / ThenNow / CTA shortcodes.
 *
 * Source spine for verifiable claims:
 *   - Narayani Gupta, Delhi Between Two Empires 1803-1931 (OUP 1981)
 *   - Amita Baviskar, Uncivil City: Ecology, Equity and the Commons in Delhi (Sage 2020) - analytic spine
 *   - Y.D. Sharma, Delhi and its Neighbourhood (ASI); Lucy Peck, Delhi: A Thousand Years of Building
 *   - Stephen Blake, Shahjahanabad (CUP 1991); Sahapedia, "Traditional Water Systems of Delhi"
 *   - 1994 five-state upper-Yamuna MoU (full text, UYRB)
 *   - CAG, Performance Audit of Functioning of Delhi Jal Board (Report No. 3 of 2025, tabled 23 Mar 2026)
 *   - Delhi Economic Survey 2023-24, Ch. 13; Frontiers in Water (2021) five-axes inequity study
 *   - DPCC monthly Yamuna analysis reports (2026 series, in-repo)
 *   - IN-GRES groundwater assessments 2021-22..2024-25 (in-repo)
 *   - CWC, Delhi Floods 2023 case study; SANDRP flood post-mortems (2023, 2025)
 *   - NGT: Manoj Misra v UoI OA 6/2012 ("Maily Se Nirmal Yamuna", 2015); OA 183/2024 (STP disinfection)
 *   - Down to Earth obituary of Manoj Misra (June 2023); Delhi HC Chhath order coverage (Nov 2024)
 *
 * Images: /public/images/story/delhi/* - provenance, license and processing
 * recorded in MANIFEST.json in that directory (Wikimedia Commons; PD + CC).
 * English-only; Hindi follows in the i18n pass.
 */

import { StoryPage } from "@/components/story/story-page";
import { Chapter, CTA, Figure, Hero, Lede, PullQuote, ThenNow } from "@/components/story/story-shortcodes";

export function DelhiStoryEn() {
  return (
    <StoryPage
      cityId="delhi"
      cityDisplayName="Delhi"
      tagline="The city that stored water for a thousand years - and the twenty-two kilometres where its river dies"
      lastRevised="July 2026"
    >
      <Hero
        src="/images/story/delhi/agrasen-baoli.jpg"
        alt="Agrasen ki Baoli in central Delhi: tiers of arched stone galleries descending steeply to the dry floor of a medieval stepwell."
        source="Wikimedia Commons"
        credit="Vi.vipin (CC BY-SA 4.0)"
      />
      <Lede>
        Two minutes from Connaught Place, behind the glass of Delhi&apos;s
        business district, a flight of a hundred and eight steps drops through
        arched stone galleries to a dry floor. Agrasen ki Baoli is a{" "}
        <em>baoli</em> (बावली) - a stepwell - and the steps exist because the
        people who built it expected the water to move: to stand high in a good
        year and sink in a hard one, always reachable, never gone. For roughly a
        thousand years that was Delhi&apos;s founding skill. Every dynasty that
        raised a capital on this dry plain built its water first - tanks, royal
        reservoirs, stepwells, a canal that ran through the heart of the city.
        Today the baoli is dry, the canal is a road, and Delhi owns no storage at
        all: nine treatment plants turn out roughly 960 million gallons a day of
        water that arrives from five other states, against a requirement its own
        auditor says it misses by a quarter. The city that once stored its own
        water now waits for water - and the river it waits beside carries, in
        the twenty-two kilometres it takes to cross town, about eighty per cent
        of the pollution of its entire thirteen-hundred-kilometre length.
      </Lede>

      <Chapter
        id="talab-hauz-baoli"
        number={1}
        title="Talab, hauz, baoli: the city built on stored water (c. 1052-1857)"
        thesis="Seven capitals rose on a plain with no perennial stream of their own - so each one engineered its water: a dam, a royal tank, a fortress of cisterns, and finally a canal of paradise."
      >
        <p>
          Delhi&apos;s water story starts on the rocky southern ridge, where the
          rain runs off fast and the Yamuna is a day&apos;s walk away. The
          Tomar rajas who held the area around the eighth to eleventh centuries
          answered with masonry: at Anangpur, south of the city, a
          hundred-metre wall of dressed quartzite still stands across a ridge
          stream - India&apos;s oldest surviving gravity dam - feeding the
          stepped reservoir at Surajkund. Their tank at Lal Kot, the Anang Tal
          (c. 1052), watered the first of the capitals. The pattern was set: in
          this landscape a city is a machine for catching rain.
        </p>
        <p>
          The Sultanate scaled the machine up. Iltutmish dug the royal tank of
          Hauz-i-Shamsi (हौज़-ए-शम्सी) at Mehrauli in 1230; it still holds water
          today, nearly eight centuries on. Alauddin Khalji excavated the vast
          Hauz Khas - the &quot;special tank&quot; - for his new city of Siri,
          and Firuz Shah Tughlaq, the great hydraulic obsessive of the
          fourteenth century, restored it in the 1350s and built his madrasa on
          its bund. Ghiyasuddin Tughlaq raised Tughlaqabad as a fortress of
          rainwater - rock-cut cisterns and stepwells inside the walls, a
          seasonal reservoir held by a bund outside them. At Satpula, a
          seven-arched dam doubled as a piece of the city wall. The stepwells
          multiplied - Agrasen&apos;s in the plain, Rajon and Gandhak in
          Mehrauli, the spring-fed baoli at Nizamuddin&apos;s dargah, dug, the
          story goes, by night when the Sultan had banned the work.
        </p>
        <p>
          The Mughals completed the machine with a flourish. In 1638 Shah Jahan
          moved the capital to his new riverside city, and his engineer Ali
          Mardan Khan revived and extended Firuz Shah&apos;s old canal to carry
          Yamuna water more than a hundred kilometres from the north into
          Shahjahanabad. They called it the Nahar-i-Behisht (नहर-ए-बहिश्त) - the
          Stream of Paradise. It filled the channel down the centre of Chandni
          Chowk, fed the fountains of the Red Fort, and made a desert court a
          garden. A city of perhaps half a million people ran on stored rain,
          shallow wells, and one engineered canal - a system with no pumps, no
          treatment plants, and a thousand years of institutional memory.
        </p>
        <Figure
          src="/images/story/delhi/beato-bridge-of-boats-1858.jpg"
          alt="An 1858 albumen photograph of a bridge of boats crossing the wide, sandy Yamuna at Delhi, seen from the fort side of the river."
          caption="Felice Beato's bridge of boats over the Yamuna at Delhi, 1858 - the river as the city's eastern edge and lifeline, photographed months after the Uprising. Within a generation the canal that carried its water into the city would be gone."
          source="https://commons.wikimedia.org/wiki/File:Felice_Beato_(British,_born_Italy_-_Bridge_of_Boats_over_the_Jumna,_Taken_from_Lulim_Ghur_-_Google_Art_Project.jpg"
          credit="Felice Beato, 1858 (public domain)"
          aspect="4/3"
          fit="contain"
        />
        <PullQuote attribution="after Sahapedia, Traditional Water Systems of Delhi">
          Every Delhi before the modern one can be read as a water plan with a
          fort attached.
        </PullQuote>
      </Chapter>

      <Chapter
        id="drain-the-jheel"
        number={2}
        title="Drain the jheel, pump the river (1857-1947)"
        thesis="After 1857 the British dismantled the stored-water city - the canal filled in, the great lake drained, the water table left to the past - and replaced it with a pumped river and a pipe that served some Delhis better than others."
      >
        <p>
          The Uprising of 1857 ended more than a dynasty. In the rebuilt,
          garrisoned Delhi that followed, the Nahar-i-Behisht was cut off and
          the Chandni Chowk channel eventually filled and paved - a security
          risk, an inconvenience, an anachronism to the new administration. The
          city&apos;s most sophisticated piece of water architecture became a
          tram route. What the canal had done for the walled city, a pump would
          now do: Delhi&apos;s first waterworks rose in the 1890s at Chandrawal,
          on the Yamuna&apos;s bank, pushing filtered river water into mains.
          The logic of the city flipped in a generation - from{" "}
          <em>catch it where it falls</em> to <em>take it from the river and
          push it uphill</em>.
        </p>
        <Figure
          src="/images/story/delhi/chandni-chowk-1863.jpg"
          alt="Samuel Bourne's 1860s photograph looking down Chandni Chowk, a broad tree-lined avenue crowded with people, with the channel line running up its centre."
          caption="Chandni Chowk in 1863-67, by Samuel Bourne. The tree line marks the course of the Nahar-i-Behisht, the canal that had run down the avenue's spine since Shah Jahan; within a few decades of this photograph it was filled and paved."
          source="https://commons.wikimedia.org/wiki/File:Chandni_Chowk,_Delhi,_1863-67.jpg"
          credit="Samuel Bourne, 1863-67 (public domain)"
          aspect="4/3"
          fit="contain"
        />
        <p>
          The same decades unmade Delhi&apos;s largest natural water body.
          South-west of the city, the Sahibi river ended in the Najafgarh
          Jheel (झील) - a shallow monsoon lake that in flood years spread over
          some two hundred and twenty-six square kilometres, a sea by
          Delhi&apos;s standards, and a malaria-and-flood problem by the
          administration&apos;s. From the 1860s the engineers cut it a channel
          to the Yamuna and kept cutting until the lake was gone. The channel
          survives. It is the Najafgarh <em>nala</em> (नाला) - today the single
          largest carrier of Delhi&apos;s sewage into the river, a drain that is
          also, if you trace its water back far enough, a buried river.
        </p>
        <p>
          New Delhi, inaugurated in 1931, added the last colonial ingredient:
          inequality by design. The imperial capital&apos;s bungalow zone was
          plumbed generously; the old city and the settlements beyond were not.
          Water in Delhi has run along that gradient ever since - not scarcity
          for everyone, but abundance for some addresses and queues for others.
        </p>
        <PullQuote attribution="after Narayani Gupta, Delhi Between Two Empires (1981)">
          The colonial city did not just take Delhi&apos;s water; it took
          Delhi&apos;s memory of having managed water at all.
        </PullQuote>
      </Chapter>

      <Chapter
        id="sutlej-yamuna-promise"
        number={3}
        title="The Sutlej-Yamuna promise: a capital on other states' water (1947-2007)"
        thesis="Independent Delhi grew twenty-fold and solved each shortage the same way - a longer straw into somebody else's river - until its entire supply hung on a stack of inter-state promises."
      >
        <p>
          Partition doubled the city almost overnight, and the decades after
          kept doubling it. Delhi&apos;s answer was reach. When Bhakra dam rose
          on the Sutlej in 1963, a share of its water turned into the capital
          - arriving, then as now, through Haryana&apos;s Western Yamuna Canal
          system, whose Munak carrier delivers roughly seventy per cent of
          Delhi&apos;s raw water across a hundred and two kilometres the city
          does not control. The straw kept lengthening: by the mid-2000s the
          Sonia Vihar plant was treating Ganga water released from Tehri dam in
          the Himalaya, three hundred cusecs earmarked for Delhi and carried
          down the Upper Ganga Canal.
        </p>
        <p>
          The paper caught up with the plumbing in 1994, when five states -
          Himachal, Haryana, Uttar Pradesh, Rajasthan and Delhi - signed a
          memorandum dividing the upper Yamuna. Delhi&apos;s share: 0.724
          billion cubic metres a year, with a clause putting the
          capital&apos;s drinking water first in a bad year. It was styled an
          interim allocation. Three decades later it is still the operative
          constitution of Delhi&apos;s water, administered by a river board
          whose public reports run years behind, for a canal with no public
          flow meter. In 1998 the Delhi Jal Board was created to run the city
          side of the bargain. And in February 2007 a retired forest officer
          named Manoj Misra founded the Yamuna Jiye Abhiyaan - the campaign
          that the river lives - and began asking, in courtrooms, the question
          the whole arrangement had been built not to ask: if everyone upstream
          takes their share, what is left of the river itself?
        </p>
        <PullQuote attribution="1994 upper-Yamuna MoU, operative clause (paraphrased)">
          In a deficit year, Delhi&apos;s drinking water is served first - the
          rest share what remains. The river is not listed among the parties.
        </PullQuote>
      </Chapter>

      <Chapter
        id="aaj-ka-yamuna"
        number={4}
        title="Aaj ka Yamuna: foam, floods, and the audit (2007-2026)"
        thesis="India's most-instrumented river stretch got worse while every number about it got better known - and the city's own auditor finally put figures on why."
      >
        <p>
          On paper, the last two decades are the best-documented in the
          Yamuna&apos;s history. The National Green Tribunal ran Misra&apos;s
          case for over a decade and delivered the landmark
          &quot;Maily Se Nirmal Yamuna&quot; revitalisation judgment in 2015; a
          monitoring committee followed in 2018; Delhi&apos;s pollution
          watchdog now samples the river at eight stations and its drains at
          dozens more, every month - the highest-cadence public river feed in
          India. The numbers those instruments return are a diagnosis in
          public: the river arrives at Palla meeting the bathing standard, and
          leaves the city with its dissolved oxygen at nil and faecal bacteria
          more than a hundred times the limit. Every October, when the foam
          banks up white at Kalindi Kunj for Chhath, the diagnosis becomes a
          photograph. In November 2024 the Delhi High Court declined to permit
          the ritual on the riverbank at all - a court certifying, in effect,
          that the river is unfit for the festival that honours it.
        </p>
        <Figure
          src="/images/story/delhi/najafgarh-drain-aerial-2016.jpg"
          alt="Aerial view of the broad, dark Najafgarh drain cutting through west Delhi's dense grey fabric of houses and roads."
          caption="The Najafgarh drain from the air, 2016 - the drained lake's outlet channel, now the single largest carrier of Delhi's sewage to the Yamuna. With the Shahdara drain it delivers roughly 84% of the city's load."
          source="https://commons.wikimedia.org/wiki/File:Najafgarh_Drain_-_Aerial_View_-_New_Delhi_2016-08-04_5780.JPG"
          credit="Biswarup Ganguly, 2016 (CC BY 3.0)"
          aspect="3/2"
          fit="cover"
        />
        <p>
          The river can still remind the city whose floodplain it is. In July
          2023 the Yamuna rose to 208.66 metres at the Old Railway Bridge -
          the highest level ever recorded there, a metre above a record that
          had stood since 1978 - and put the Ring Road under water; jammed
          gates at the ITO barrage deepened the flooding in the city&apos;s
          centre. Two monsoons later, in September 2025, an eerily similar
          spell repeated. Between the two floods, in June 2023, Manoj Misra
          died - on the same day a citizens&apos; Yamuna parliament convened in
          Delhi to demand the river&apos;s revival.
        </p>
        <p>
          Then, in March 2026, the city&apos;s own auditor tabled the reckoning.
          The CAG&apos;s performance audit of the Delhi Jal Board found
          fifty-one to fifty-three per cent of the water supply earning no
          revenue - nearly five thousand crore rupees lost - and total debts of
          Rs 66,595 crore; only forty per cent of the water produced was
          billed at all, and there was not a working flow meter at the plants,
          the reservoirs or the borewells to say precisely where the rest went.
          The state&apos;s own Economic Survey uses the word
          &quot;mafia&quot; for where some of it goes. Beneath the streets the
          story repeats: the groundwater assessments now published annually
          show the capital pumping more than nature returns, with New Delhi
          district extracting over a hundred and twenty per cent of its
          recharge. And the master plan for 2041 quietly concedes the arithmetic
          - it sets the future demand target at 1,455 million gallons a day by
          <em> cutting</em> the per-person norm from sixty gallons to fifty.
        </p>
        <ThenNow
          thenLabel="The stored-water city"
          nowLabel="The piped capital"
          rows={[
            { metric: "Source of water", then: "Rain caught in tanks, hauz, baolis + one canal", now: "5 states; ~70% through one 102-km canal", verdict: "worse" },
            { metric: "Who is served first", then: "The court and the walled city", now: "509 LPCD in Central Delhi vs 29 in Mehrauli (17x)", verdict: "same" },
            { metric: "The river", then: "Bathing ghats; a bridge of boats", now: "DO nil through the city; Chhath denied on the bank (2024)", verdict: "worse" },
            { metric: "The great lake", then: "Najafgarh Jheel, ~226 sq km in flood", now: "~7 sq km remnant; its outlet is the city's biggest sewage drain", verdict: "worse" },
            { metric: "Water accounts", then: "A canal you could see", now: "40% of production billed; no flow meters (CAG 2026)", verdict: "worse" },
          ]}
        />
        <p>
          Delhi has more data about its river than any Indian city has about
          any river - and the river got worse anyway. That is the uncomfortable
          finding under all the others: the capital&apos;s water problem is not
          a measurement problem, and it is no longer even a scarcity problem
          alone. It is a promises problem. The MoU promises a share; the canal
          delivers what it delivers, unmetered. The plans promise treatment
          capacity by dates that pass quietly. The baoli behind Connaught Place
          promises nothing - but for a thousand years, it delivered. The
          question this dashboard exists to keep asking is the one Misra took
          to court: not <em>how much water can Delhi take</em>, but{" "}
          <em>what does Delhi owe the water it takes?</em>
        </p>
        <PullQuote attribution="after Amita Baviskar, Uncivil City (2020)">
          In Delhi the river was never lost to ignorance. It was lost in full
          view, with the instruments running.
        </PullQuote>
      </Chapter>

      <CTA href="/delhi">
        See it live: the five-state supply chain, the CAG scoreboard, the
        monthly river readings, and the promises with their due dates - on the
        Delhi dashboard.
      </CTA>
    </StoryPage>
  );
}
