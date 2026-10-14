/**
 * Ahmedabad water story - "The city founded beside a thin stream in a bed of
 * sand - and the canal that now keeps it full." Composed from the Hero / Lede /
 * Chapter / Figure / PullQuote / ThenNow / CTA shortcodes, following the Pune
 * and Surat pattern.
 *
 * IMAGES: eleven plates in /public/images/story/ahmedabad, licence read from the
 * Commons API extmetadata at download time. MANIFEST.json next to them records
 * every plate shipped and every candidate checked and REJECTED, with the reason.
 * Every Figure passes a `source` and a `credit`; the five CC BY-SA photographs
 * carry the photographer and the licence in the caption itself. The hero is a
 * pre-cropped band (40% to 97.5% of the height) of the Rijksmuseum's 1679
 * drawing, because the Hero shortcode centres an object-cover image and the
 * uncropped sheet is mostly blank paper and title cartouche.
 *
 * SOURCE SPINE for every verifiable claim (all opened, page-cited in the r5
 * research spine):
 *   - Gazetteer of the Bombay Presidency, Vol. IV: Ahmedabad (1879): the
 *     river in the dry season, the Hathmati legend and the Gazetteer's own
 *     caveat on it, Kankaria's feeder and 1781 ruin, the rain cisterns, the
 *     1849 pumped supply, the brackish wells, the first Ellis Bridge, the 1875
 *     flood, the 1879 weir proposal, the 1868-69 Khari cut
 *   - Imperial Gazetteer of India, Vol. V (1908): river width, the 1891
 *     Dudheshwar waterworks
 *   - Hope & Fergusson, Architecture at Ahmedabad (1866): Kankaria's form
 *   - Mirat-i-Ahmadi Supplement (trans. 1928): the founding, Dada Harir's
 *     water level, Kankaria's garden staff
 *   - Burgess, Muhammadan Architecture of Ahmadabad II (1905): both stepwells
 *   - World Heritage nomination dossier (2016), ICOMOS evaluation 1551 (2017),
 *     UNESCO list entry 1551: site and drainage, attributes, the OUV sentence,
 *     the river argument
 *   - Amiraly et al. (2004) and Amiraly (2025): how a tanka works, capacity,
 *     the 2001-02 survey and its 2016-17 return, the published estimates
 *   - HUDCO Best Practice compendium p.34: Kankaria 2006-2008, riverfront
 *   - AMC heritage portal: the 1892 steel Ellis Bridge
 *   - AMC Draft City Sanitation Plan (2012): the shift to groundwater and
 *     AMC's period shares, 1999
 *   - Gujarat High Court, WP(PIL) 38 of 2011 (3 Aug 2011): Dharoi
 *   - AMC Water Project page: Kotarpur, Raska, August 2002, the build-out
 *   - CGWB NAQUIM, Ahmedabad (Dec 2021) and CGWB district brochure (2014)
 *   - NCA Publication 3/91 (1991); IITRAM site visit report (2018)
 *   - SRFDCL annual return, website and 2015 presentation; EPC feasibility
 *     report (May 1998); GoG WRD Vasna barrage page; SEIAA clearances
 *   - CPCB polluted river stretches 2018, 2022, 2025; CPCB NWMP 2024; AMC
 *     ESMF (2022); GPCB filings with the NGT; Gujarat HC suo motu PIL 98 of
 *     2021 orders; NGT OA 105/2019 Khari Cut committee report (2020)
 *   - In-repo, for present-day numbers: ahmedabad-supply-overview.json (AMC
 *     Budget 2026-27, and the 2023-24 budget's two hours a day),
 *     gwr-blocks-ahmedabad.json (IN-GRES 2025-26), ahmedabad-dam-storage.json
 *     (Gujarat WRD daily report, 14-10-2026)
 *
 * WHAT THIS STORY DOES NOT SAY, and why:
 *   - No founding day. The three sources that date it disagree by days; the
 *     prose says "early 1411".
 *   - No count of tankas. Published estimates run from about five thousand to
 *     ten thousand and nobody has counted them; the prose says exactly that.
 *   - No single date for the first Narmada release. AMC dates its own works
 *     back in operation from August 2002; no SSNNL or state document we found
 *     dates the release itself.
 *   - No opening date for the riverfront and no single figure for how many
 *     households lived on the riverbed. The household counts are given side by
 *     side, each with its document.
 *   - No figures for the 1927 and 1973 floods: the dossier names the years and
 *     nothing else.
 *   - No annual rate of water-table fall other than CGWB's own piezometers.
 *
 * English-only; Gujarati follows in the i18n pass (the Surat posture).
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
import { STORY_TAGLINES } from "./story-taglines";

export function AhmedabadStoryEn() {
  return (
    <StoryPage
      cityId="ahmedabad"
      cityDisplayName="Ahmedabad"
      tagline={STORY_TAGLINES.ahmedabad}
      lastRevised="October 2026"
    >
      <Hero
        src="/images/story/ahmedabad/ahmedabad-across-the-sabarmati-1679.jpg"
        alt="An ink-and-wash drawing of Ahmedabad seen from across the Sabarmati in 1679. A long line of battlemented walls with round towers runs along the far bank. In front of it lies a wide, flat riverbed of sand and shallow channels, with a palanquin party and horses crossing, a rider and two figures wading, and a wooded bank with travellers in the foreground."
        source="Rijksmuseum, Amsterdam (RP-T-1969-5), via Wikimedia Commons"
        credit="Anonymous draughtsman, 'Ammadabat', 1679 (CC0)"
      />
      <Lede>
        Ahmedabad was founded beside a river that, for most of the year, was
        hardly there. In 1879 the Bombay Gazetteer described the Sabarmati at
        the city as, except in the rains, &ldquo;a thin stream of water in a
        broad bed of deep sand.&rdquo; So for most of its history the city made
        its own water: a 34-sided tank, wells that step down to the water table,
        a cistern for rain under the courtyards of its better-off houses. In the
        twentieth century it pumped its aquifer. Since 2000 it has drunk from
        canals. By the municipal corporation&apos;s 2026-27 budget,{" "}
        <strong>1,550 of the 1,850 million litres a day</strong> it draws come
        down the Narmada Main Canal, and the full river you see through the city
        is held by a barrage and topped up from the same canal.
      </Lede>
      <Lede>
        The city that once kept its drinking water under its own courtyards now
        draws it from a dam on another river, and sends its used water down the
        one it was founded on.
      </Lede>

      <Chapter
        id="a-thin-stream"
        number={1}
        title="A capital beside a thin stream"
        thesis="Ahmad Shah built on the high east bank of a seasonal river, and the oldest water story the city tells about itself is about topping that river up."
      >
        <p>
          Sultan Ahmad I founded Ahmedabad in <strong>early 1411</strong>, on
          ground beside the older settlement of Asaval, on the east bank of the
          Sabarmati. The three sources that date the founding do not agree on the
          day, so we give the season. They agree on the place. The{" "}
          <em>Mirat-i-Ahmadi</em>, an eighteenth-century history of Gujarat, says
          the Sultan halted on the river&apos;s banks, found &ldquo;the climate
          exhilarating&rdquo;, and in consultation with the saint Shaikh Ahmad
          Khattu of Sarkhej chose &ldquo;an open and spacious piece of ground in
          the vicinity of Asawal on the eastern side of the river&rdquo;.
        </p>
        <p>
          The choice was about water as much as air. The World Heritage
          nomination dossier prepared for the city in 2016 places the first fort
          &ldquo;on one of the higher planes of the ravines&rdquo;: a level plain
          raised above the riverbed that sloped down to the south-west and so
          &ldquo;helped drain off the land the surface water&rdquo;. Inside what
          became the walled city the ground falls from about 60 metres at its
          highest to about 48 near the Raikhad and Jamalpur gates, and the dossier
          says the streets were laid so that &ldquo;they all acted as surface water
          channels leading the storm water towards the river&rdquo;. The street
          plan was the drainage plan.
        </p>
        <p>
          The river they drained into was mostly sand. Opposite the city, the
          1879 Gazetteer gives a bed about <strong>1,550 feet</strong> wide
          carrying a fair-season channel of only <strong>375 feet</strong>. The
          Imperial Gazetteer of 1908 gives the same picture in yards: a bed
          &ldquo;from 500 to 600 yards broad; but, except during occasional
          freshes, the width of the stream is not more than 100 yards&rdquo;.
        </p>
        <PullQuote attribution="Gazetteer of the Bombay Presidency, Vol. IV: Ahmedabad (1879)">
          Along the west of the town flows the Sabarmati, except in the rains a
          thin stream of water in a broad bed of deep sand.
        </PullQuote>
        <p>
          Which may explain the first water story the city tells about its
          founder. The same Gazetteer records that Ahmad &ldquo;added to the
          Sabarmati&apos;s scanty stream by turning into it the waters of the
          Hathmati&rdquo;. Elsewhere in the same volume it is more careful: the
          tale of an embankment that turned the Hathmati &ldquo;is not supported
          by any contemporary records&rdquo;. It is a legend, and we give it as
          one. It is still a telling legend. The first thing the city remembers
          its founder doing about water is adding to the river.
        </p>
        <p>
          The walls that followed had twelve gates, and the 2016 dossier measures
          their line at 10.97 kilometres. What the city built next was built to
          hold the water the river could not be relied on to give.
        </p>
        <Figure
          src="/images/story/ahmedabad/city-and-environs-map-1866.jpg"
          alt="A printed map titled 'The City of Ahmedabad with its Environs'. The walled city, hatched, sits on the east bank of the 'Saburmuttee River', which is drawn as braided channels across a wide bed. A numbered key lists mosques, tombs and wells; Kankria Tank is marked to the south-east of the city and Dada Huree's Well at Asarwa to the north-east."
          caption="Ahmedabad and its environs in 1866. The walled city sits on the east bank; the river is drawn as braided channels in a wide bed. Kankaria tank is south-east of the walls and Dada Harir's stepwell at Asarwa to the north-east."
          source="T. C. Hope, Architecture at Ahmedabad (London: John Murray, 1866); British Library scan via Wikimedia Commons"
          credit="Stanford's Geographical Establishment, 1866 (no known copyright restrictions)"
          size="wide"
          aspect="2000/2719"
          fit="contain"
        />
      </Chapter>

      <Chapter
        id="hauz-e-qutb"
        number={2}
        title="A 34-sided reservoir"
        thesis="Forty years after the founding, the city built a tank that a nineteenth-century survey called probably the largest of its kind in India."
      >
        <p>
          In <strong>1451</strong> Sultan Qutb-ud-din completed the Hauz-e-Qutb,
          known today as Kankaria. When T. C. Hope and J. Fergusson recorded
          Ahmedabad&apos;s architecture in 1866 they described it as a regular
          polygon of <strong>34 sides, each 190 feet long</strong>, covering{" "}
          <strong>72 acres</strong>: &ldquo;probably the largest of its kind in
          India&rdquo;. On their figures the rim runs to about two kilometres.
        </p>
        <p>
          It was engineered, not just dug. Tiers of cut-stone steps ran all the
          way round, with six sloping approaches, and the water came in through a
          carved inlet: two of Hope&apos;s plates are titled &ldquo;The
          Supply-sluice&rdquo; and &ldquo;The Strainer of the
          Supply-sluice&rdquo;, and the 1879 Gazetteer calls it &ldquo;an
          exquisitely carved water sluice&rdquo;. In the middle, reached by a
          viaduct of arches, was an island garden called Nagina with a summer
          palace. The <em>Mirat-i-Ahmadi</em> records that under one Mughal
          viceroy &ldquo;two pairs of oxen for drawing water and four gardeners
          were appointed&rdquo; to keep the garden going.
        </p>
        <p>
          The tank was not filled by the river. The Gazetteer traces its water to
          a stream that rises on the west of the Bokh, a natural depression,
          turned towards Kankaria and a second reservoir &ldquo;by a dam near
          Kamod&rdquo;. By 1781, it says, the approaches were in ruins, the bridge
          to the island had fallen in, and there was no trace of the garden or the
          palace. Restoration began in 1872 under the Collector, Mr Borradaile:
          the silt was cleared and the south wall and the island wall rebuilt. In
          1879 a canal eleven miles long was proposed to bring in water from the
          Khari river, which the Gazetteer expected to &ldquo;furnish a valuable
          supply of drinking water to the people of the south-east quarter of the
          town&rdquo;.
        </p>
        <p>
          The corporation took the lake up again in 2006. Its redevelopment,
          completed in December 2008 for <strong>Rs 36 crore</strong>,
          pedestrianised the lakefront along a 2.25-kilometre promenade, and the
          project note in HUDCO&apos;s best-practice compendium gives one of its
          reasons in a phrase worth keeping: the lake &ldquo;represented a source of
          aquifer recharging&rdquo;. In 2011, the same note says, it drew more
          than 1.18 crore visitors.
        </p>
        <Figure
          src="/images/story/ahmedabad/kankaria-groote-tangh-1678.jpg"
          alt="An ink-and-wash drawing titled 'De Groote Tangh buyten Amadabat', dated 1678. A vast oval tank with a stepped stone rim fills the middle of the sheet; at its centre a walled island garden with palms and small pavilions is joined to the far shore by a long arched causeway. Ruined domed buildings, a rider, walkers and a covered bullock cart are in the foreground."
          caption="'The great tank outside Ahmedabad', drawn in 1678: the stepped rim, the island garden and the arched causeway to it, about a century before the Gazetteer records them in ruins."
          source="Rijksmuseum, Amsterdam (RP-T-1969-2), via Wikimedia Commons"
          credit="Anonymous draughtsman, 'De Groote Tangh buyten Amadabat', 1678 (CC0)"
          aspect="2000/1564"
        />
      </Chapter>

      <Chapter
        id="stepwells"
        number={3}
        title="Wells you walk down into"
        thesis="At the turn of the sixteenth century the city's patrons built wells that followed the water table down, storey by storey, and the people who described them recorded where the water stood."
      >
        <p>
          Dada Harir&apos;s stepwell at Asarwa dates itself, to{" "}
          <strong>1499-1500</strong>. A Sanskrit inscription in the well is dated
          to December 1499 and names its builder as Bai Sri Harira, &ldquo;the
          chief superintendent at the entrance of the royal apartments&rdquo;
          under Sultan Mahmud; an Arabic inscription in the same well is dated
          November 1500. J. Burgess of the Archaeological Survey, in his 1905
          account, measured it at 241.5 feet from the entrance pavilion to the
          draw-well, which is an octagonal shaft 14 feet 9 inches across and more
          than 40 feet deep.
        </p>
        <p>
          The Arabic inscription says what it was for. In the Gazetteer&apos;s
          translation the work included a travellers&apos; rest-house and
          &ldquo;a well, and a pool of water for the use of man and beast&rdquo;.
          These were public works on a trade route as much as they were
          monuments.
        </p>
        <p>
          What makes the stepwells useful to a water history is that they were
          built to reach the water wherever it stood, and the people who wrote
          about them noted where that was. The <em>Mirat-i-Ahmadi</em>, written
          in the eighteenth century, calls Dada Harir&apos;s the most prominent of
          the city&apos;s wells &ldquo;as regards solid structure and sweet
          water&rdquo;, and adds: &ldquo;Two storeys are always under water,
          except in famine times when one is dry.&rdquo; Around 1900 Burgess found
          much the same: &ldquo;Usually the water stands well up in the third
          gallery, the fourth being always submerged.&rdquo; Two observers, about
          a century and a half apart, reading the same staircase as a gauge.
        </p>
        <Figure
          src="/images/story/ahmedabad/dada-harir-vav-1913.jpg"
          alt="A colour autochrome looking along the top of a stepwell: flat stone roof slabs over a stepped corridor with openings down into it, low carved parapets on either side, two small domed kiosks at the far end and tall trees behind under a blue sky."
          caption="Dada Harir's stepwell at Asarwa, photographed in colour on 20 December 1913. The galleries below these roof slabs step down to the water."
          source="Musée départemental Albert-Kahn, Archives de la Planète (A 4 180), via Wikimedia Commons"
          credit="Stéphane Passet, autochrome, 1913 (CC0)"
          aspect="4/3"
        />
        <p>
          About twelve miles north of the city, at Adalaj, a Vaghela queen named
          Ruda, or Rudabai, wife of the chief Virasimha, built a slightly longer
          one <strong>around 1499</strong>; the sources read its inscription
          differently by a few years. Burgess measured it at 251 feet long, with a
          main shaft 17 feet across and a reservoir &ldquo;fully 53 feet&rdquo;
          deep from the top of its upper frieze.
        </p>
        <Figure
          src="/images/story/ahmedabad/adalaj-vav-c1860-1870.jpg"
          alt="A sepia albumen print of the carved stone galleries of the Adalaj stepwell, with pillars and lintels framing a long view down the stepped corridor. Three women stand in the galleries carrying stacks of dark water pots on their heads. The print is captioned 'A Sculptured Well at Adalij, Ahmedabad. 2243'."
          caption="Adalaj, about twelve miles north of the city, photographed around 1860-1870 with women carrying water pots in its galleries: a stepwell in use, not only a monument."
          source="Rijksmuseum, Amsterdam (RP-F-F02443), via Wikimedia Commons"
          credit="Bourne &amp; Shepherd (attributed), 'A Sculptured Well at Adalij', c. 1860-1870 (CC0)"
          aspect="2000/1549"
        />
      </Chapter>

      <Chapter
        id="tankas"
        number={4}
        title="A cistern under the courtyard"
        thesis="In 1879 the principal source of the city's drinking water was neither the river nor the wells. It was rain, kept under the courtyards of the better-off houses."
      >
        <p>
          The Gazetteer is direct about it. Rain in Ahmedabad, it says, was used
          &ldquo;to fill cement-lined cisterns, which, fed from the roofs by
          cement channels or iron pipes, are to be found in almost all the
          courtyards of the better class of houses, and form the principal source
          of the townspeople&apos;s drinking water&rdquo;. Of Khadia, one of the
          old wards, it adds: &ldquo;Inside of most two or more storied houses is
          a yard, and under the yard a covered reservoir with supplies of rain
          water for drinking.&rdquo;
        </p>
        <p>
          These cisterns are tankas, and the houses that held them stood in pols,
          the gated streets of the old city. The municipal count in 1879 was{" "}
          <strong>356 pols</strong>: 275 main pols and 81 sub-pols.
        </p>
        <p>
          The researcher Akil Amiraly, who with colleagues surveyed households
          in two pols in 2001-02 and returned in 2016-17, describes how they
          work. Water from the first rains is kept out, and so is water from roofs
          that people walk on. Rain runs off the roof through a gutter, sometimes through a cloth
          or a metal grid, into a chamber under the courtyard built of brick in
          lime mortar and plastered with lime. One opening serves for drawing
          water and for climbing in once a year to clean. The tankas he
          documents hold <strong>between 20,000 and 50,000 litres</strong>; a
          chamber two metres by two by five holds the smaller figure.
        </p>
        <p>
          How many are left is a question with no answer. Published estimates
          run from about five thousand (the Ahmedabad Heritage Centre, 2004) to
          ten thousand (a literary magazine, 2001).{" "}
          <strong>Nobody has counted them.</strong>
        </p>
        <p>
          What exists instead is evidence of how few still work. In the 2001-02
          survey of 60 households in two pols, 10 had a working tanka, 32 had one
          that no longer worked, and 18 had none. The 2016-17 return visit
          recorded the abandonment of the working cisterns found fifteen years
          earlier. What replaced them was piped municipal water, which the
          corporation dates from 1891.
        </p>
        <Figure
          src="/images/story/ahmedabad/pol-gate-2012.jpg"
          alt="A pol gate in Ahmedabad: a painted blue signboard in Gujarati across the top of a plastered arched gateway, opening onto a narrow lane between tall attached houses. A woman carrying a small vessel walks towards the gate, a man stands by a bicycle, and a dog and a cow are in the foreground."
          caption="Gatrad ni Pol, one of the city's gated streets, in 2012. In 1879 the better-off houses of streets like this kept their drinking water in a cistern under the courtyard."
          source="Tarkik Patel, via Wikimedia Commons"
          credit="Gatrad ni Pol, Ahmedabad, 2012. CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0)"
          aspect="2000/2379"
        />
      </Chapter>

      <Chapter
        id="one-gallon-a-day"
        number={5}
        title="One gallon a day, and a flood twenty-two feet high"
        thesis="The colonial city's first piped water was a filtered trickle from the river, and its first bridge across that river lasted five years."
      >
        <p>
          From about <strong>1849</strong> the city pumped river water at its
          south-west corner into a tower fifty-two feet high, filtered it
          &ldquo;through vegetable charcoal and gravel&rdquo;, and carried it by
          an eight-inch earthen pipe to 17 iron standpipes and 10 masonry
          reservoirs. The Gazetteer&apos;s judgement in 1879 was that it yielded
          &ldquo;<strong>not more than one gallon a day</strong> to each of the
          people&rdquo;, and that even after filtering it was impure. In the
          mid-1860s two steam pumps replaced the Persian wheels that had lifted
          the water, and they were worked only at night, because the river was
          &ldquo;much disturbed during the day&rdquo;.
        </p>
        <p>
          The wells inside the walls were worse. Most had become, in the
          Gazetteer&apos;s words, &ldquo;so brackish and impure as to be unfit to
          drink&rdquo;, and it named the cause: there was no plan for taking the
          city&apos;s sewage away. It went into brick cesspools twenty to
          twenty-five feet deep that &ldquo;often remain uncleaned for thirty or
          forty years&rdquo;. Ahmedabad was drinking from the same ground it
          drained into.
        </p>
        <Figure
          src="/images/story/ahmedabad/sabarmati-washing-1890.jpg"
          alt="An engraving of people washing clothes and bathing in a wide, shallow river. Women kneel and beat cloth at the water's edge beside brass pots, a young man stands holding a wet cloth, and in the background a horse-drawn cart fords the river while small figures stand in the water before a low far bank of trees."
          caption="Washing in the Sabarmati at Ahmedabad, engraved for a book of 1890: a wide, shallow river that people waded and carts forded."
          source="W. S. Caine, Picturesque India (London: G. Routledge &amp; Sons, 1890); British Library scan via Wikimedia Commons"
          credit="J. Pedder (drawing) and Dawson (engraving), 1890 (no known copyright restrictions)"
          aspect="1850/1073"
        />
        <p>
          The river was also a barrier. In 1870 the city got its first bridge
          across it, named after Barrow Ellis, the Revenue Commissioner under whom
          it was designed: 23 spans of 60 feet, a roadway 40 feet wide carried on
          Warren girders, piers of wrought-iron screw piles, and a deck of
          four-inch planking. It cost Rs 5,49,210.
        </p>
        <p>
          Water had broken into the city before. The Gazetteer records that the
          Sabarmati flooded it in 1714 and 1739, and that in 1755 the rain was so
          heavy that great breaches were made in the city wall. In 1868
          twenty-seven inches of rain fell in four days, and local drainage and a
          very strong wind destroyed 9,566 houses, though the river itself did not
          flood. The Gazetteer calls the flood of September 1875 &ldquo;the
          highest on record&rdquo;. For the four days ending 23
          September, Idar, the rain-recording station for the river&apos;s
          catchment, reported 21.25 inches. At noon on the 22nd the flood swept
          away the railway bridge three miles above the city. An hour later it was
          &ldquo;breaking against the Ellis Bridge in eight feet high
          waves&rdquo;. Over the next day and a half the bridge lost{" "}
          <strong>20 of its 23 spans</strong>: eight at once, then one on each
          side, then eight more, then two.
        </p>
        <p>
          At five in the afternoon of 23 September the river reached its peak,{" "}
          <strong>twenty-two feet above its ordinary summer level</strong>. That
          is the Gazetteer&apos;s figure, compiled from the records of the
          irrigation engineer, the district engineer and the Collector. Its own
          summary elsewhere gives about nineteen feet, the level its detailed
          account records for the evening of the 22nd. Twelve people died. Inside
          the city <strong>3,887 houses</strong> were ruined, valued at Rs 5,82,080, and
          the water covered &ldquo;more than a third of the town&rdquo;. Until at
          least 1879, passenger boats carried people across the Sabarmati in
          place of the bridge.
        </p>
        <p>
          The Ellis Bridge that stands now is the second one. By the
          corporation&apos;s own heritage record it was built in steel in 1892 by
          the engineer Himmatlal Dhirajram Bhachech, with steel imported from
          Birmingham, at a cost of Rs 4,07,000; its first stone was laid by Lord
          Reay, Governor of Bombay, on 19 December 1889.
        </p>
        <Figure
          src="/images/story/ahmedabad/ellis-bridge-2011.jpg"
          alt="A low view along the deck of the Ellis Bridge: riveted steel bowstring trusses curve up on either side and repeat into the distance, with old lamp posts along the top chords and a hazy morning sky."
          caption="The 1892 steel Ellis Bridge, photographed in 2011. It replaced the first bridge, which the 1875 flood carried away."
          source="Glitterchirag, via Wikimedia Commons"
          credit="Ellis Bridge, Ahmedabad, 2011. CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0)"
          aspect="3/2"
        />
        <p>
          The same decades brought the city&apos;s first waterworks. Opened in{" "}
          <strong>1891</strong> and handed to the municipality the following year,
          it cost nearly 8 lakh rupees, 4.5 lakh of them from the government. Its
          head-works stood at Dudheshwar on the left bank, about 2,000 yards
          north-west of the city: four supply wells, a pump well and a high-level
          reservoir. The corporation dates its piped supply from 1891, and the
          Dudheshwar works, first opened in 1891, were rebuilt around 1950.
          Underground drainage was first laid in Khadia in 1890, and by 1906 the
          city had 28 miles of drains.
        </p>
        <p>
          The river kept flooding. The 2016 dossier&apos;s timeline lists heavy
          floods in 1927 and 1973, and floods again in 2006. We have not found
          official figures for any of them in the documents we opened, so we give
          only the years.
        </p>
      </Chapter>

      <Chapter
        id="underground"
        number={6}
        title="Thirty years of drinking from under the city"
        thesis="From the late 1950s the river could not keep up, and Ahmedabad turned to its aquifer. By the corporation's own figures, groundwater was 87% of its supply through the 1970s."
      >
        <p>
          The corporation&apos;s own account of the turn is short. The
          Sabarmati, its 2012 sanitation plan says, being a non-perennial river,
          gave too little water in the dry months, and &ldquo;in late 1950s, the
          city shifted on ground water sources to cater the demand&rdquo;. The same
          plan reproduces AMC&apos;s figures for groundwater&apos;s share of what
          it supplied: <strong>87% in 1970-80</strong>, 61% in 1980-2000, 21% in
          2000-06 and 10% in 2006-10. In 2001, with Mahi water already arriving
          but before the Narmada, a study working from AMC&apos;s numbers put
          production at 570 million litres a day, 270 of them from borewells, with 300 to 350 of the
          corporation&apos;s 410 borewells running on any given day.
        </p>
        <p>
          There was supposed to be a dam. Dharoi, on the upper Sabarmati nearly
          160 kilometres from the city, was planned with Ahmedabad as a partner
          &ldquo;for the purpose of assured water supply to the Ahmedabad
          city&rdquo;, in the words of the state government&apos;s affidavit to
          the Gujarat High Court. In 1980 the government approved a cost split
          under which AMC&apos;s share of the head-works cost was{" "}
          <strong>52.10%</strong>. The reservoir first filled in 1978, with a
          capacity of 907.832 million cubic metres at full reservoir level; by
          2006 silt had reduced that to 813.137.
        </p>
        <p>
          The same affidavit records what happened to the water. The reservoir
          filled and spilled only ten times between 1978 and 2010, and between
          Dharoi and Ahmedabad there were &ldquo;very high losses nearly
          24% to 87%&rdquo; in different non-monsoon months. AMC had built a 650
          MLD treatment plant at Kotarpur between 1983 and 1987 for Dharoi water;
          its own account says that water was not adequate, so the plant was not
          commissioned. By a letter dated 26 February 1998 the state cancelled
          Ahmedabad&apos;s partnership in the dam. From 1999 releases to the city
          stopped, and the Dudheshwar works and the French wells in the riverbed
          &ldquo;became non-functional&rdquo;.
        </p>
        <p>
          The river&apos;s thin dry-season flow is older than the dam. The
          Gazetteer described it a century before Dharoi existed, and the
          state&apos;s affidavit says so plainly: &ldquo;The Sabarmati river is
          not a perennial river.&rdquo; What changed in 1999 is that the city
          stopped receiving any of Dharoi&apos;s water.
        </p>
        <Figure
          src="/images/story/ahmedabad/dharoi-dam-2021.jpg"
          alt="The gated concrete spillway of Dharoi dam seen across a stony, dry riverbed with a shallow pool of water at its foot, rocky hills to the left and an earthen embankment to the right, under a partly cloudy sky."
          caption="Dharoi dam on the upper Sabarmati in November 2021. AMC's agreed share of its head-works cost was 52.10%; the city stopped receiving its releases in 1999."
          source="Nizil Shah, via Wikimedia Commons"
          credit="Dharoi Dam, 2021. CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0)"
          aspect="4/3"
        />
        <p>
          Meanwhile the aquifer fell. The Central Ground Water Board&apos;s 2021
          aquifer report for Ahmedabad district records the deep confined aquifer
          under the city declining by 0.13 to 1.72 metres a year. At its
          piezometer in the Cantonment the water level was 60.28 metres below
          ground in 1987 and <strong>98.15 metres in 2013</strong>; at Sola it
          went from about 63 metres in 1996 to about 100 metres by 2016-17. Nearer
          the surface, the same report finds the post-monsoon water table deeper
          than 40 metres in the eastern part of the city. In 1879 the Gazetteer
          had recorded well water across the district as &ldquo;generally found at a depth of
          from thirty to sixty feet&rdquo;.
        </p>
        <p>
          The official assessments say the same thing in their own vocabulary. In
          2011 the Board rated the City-Daskroi unit over-exploited, at a stage of
          groundwater development of 103.73%. In the latest national assessment
          (IN-GRES, 2025-26), Ahmedabad district as a whole reads semi-critical at
          79.14%, while the unit under the city, Ahmedabad Urban, is{" "}
          <strong>over-exploited at 128.85%</strong>: it draws more each year than
          the assessment counts as extractable. That unit was only carved out in
          2021-22, so its figures are not a trend with the older ones. What they
          share is the category.
        </p>
        <p>
          The corporation now takes only 100 of its 1,850 MLD from its 555
          borewells, and says it is planning to reduce its use of groundwater in
          the coming years. Private borewells appear in none of its figures.
        </p>
      </Chapter>

      <Chapter
        id="the-canal"
        number={7}
        title="Water from a dam on another river"
        thesis="Mahi water reached the city in 2000 and Narmada water in 2002. By the corporation's 2026-27 budget, the Narmada Main Canal supplies 84% of what Ahmedabad draws."
      >
        <p>
          The first relief came from the Mahi. In <strong>April 2000</strong>{" "}
          AMC commissioned the Raska project: about 300 MLD of Mahi water,
          diverted at the Vanakbori weir into the Mahi canal and its Shedhi
          branch, then pumped from the branch&apos;s tail end through 32
          kilometres of 2,100-millimetre pipe to the Kotarpur works. It cost Rs
          120 crore and, in AMC&apos;s words, was built &ldquo;in record time of
          150 days&rdquo;.
        </p>
        <p>
          The larger source had been planned for years. In 1991 the Narmada
          Control Authority set out how Gujarat&apos;s share of the river, 9
          million acre-feet under the Narmada Water Disputes Tribunal&apos;s
          allocation, would be used: 1.06 million acre-feet of it was set aside
          for domestic, municipal and industrial use. The Narmada Main Canal
          crosses the Sabarmati a few kilometres upstream of the city on a syphon
          built between 1994 and 2001, and about 229 kilometres down the canal
          from Sardar Sarovar dam an escape structure lets canal water into the
          Sabarmati. A site report by IITRAM, a Gujarat state university, says it
          was built &ldquo;to meet the requirements of irrigation, domestic and
          industrial water requirements mainly in Ahmedabad area&rdquo;.
        </p>
        <p>
          AMC&apos;s account of what came next is plain. The canal was aligned
          upstream of Kotarpur and the escape built &ldquo;so that Narmada canal
          water was available in the river to pick up this water&rdquo;. The
          Dudheshwar works and the French wells, out of use since 1999, came back
          into operation from <strong>August 2002</strong>, AMC says. The
          state&apos;s affidavit to the High Court puts it as &ldquo;around
          2002&rdquo;. We have not found a document from the canal&apos;s operator
          or the state that gives an exact date for the first release, so August
          2002 is AMC&apos;s date for its own works, not a date for the water.
        </p>
        <p>
          Then the city built up its intakes. Intake wells at Kotarpur, drawing
          the canal water back out of the river, added 165 MLD in 2003 and 330
          MLD in 2006. A 2,500-millimetre gravity line from the Narmada Main
          Canal to Kotarpur, laid in December 2006 and commissioned in January
          2007, brought 330 MLD; a twin
          2,000-millimetre line in 2015-16 brought 500 MLD more. For the new
          western city, a treatment plant at Jaspur on the canal&apos;s Dholka
          branch opened at 275 MLD in November 2006 and was raised to 400 MLD in
          2014. Groundwater&apos;s share of AMC&apos;s supply fell to 21% in
          2000-06 and 10% in 2006-10.
        </p>
        <Figure
          src="/images/story/ahmedabad/narmada-canal-2008.jpg"
          alt="A wide concrete-lined canal running full of green water through dry, scrubby farmland, crossed by a low concrete bridge on three piers, with low hills on the horizon."
          caption="A lined Sardar Sarovar (Narmada) canal running full in 2008. The photograph does not record which reach."
          source="Nvvchar, via Wikimedia Commons"
          credit="Sardar Sarovar canal with flow, 2008. CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0)"
          aspect="1491/1009"
        />
        <p>
          The corporation&apos;s 2026-27 budget gives the result. Of the{" "}
          <strong>1,850 MLD</strong> it draws,{" "}
          <strong>1,550 MLD, or 84%, comes from three offtakes on the Narmada
          Main Canal</strong>; 200 MLD comes from the Mahi through the Shedhi
          branch, and 100 MLD from borewells. AMC&apos;s water page lists the
          seven French wells in the Sabarmati at 0 MLD in use. AMC&apos;s own
          2023-24 budget described the supply as two hours a day, from 6 to 8 in
          the morning, through unmetered connections.
        </p>
        <p>
          On 14 October 2026 the Gujarat water department&apos;s daily report had
          Sardar Sarovar at 99.76% of its gross storage. How much of that water
          the city is entitled to is not stated in any public order we have found.
        </p>
      </Chapter>

      <Chapter
        id="the-held-river"
        number={8}
        title="A river held between a barrage and a canal"
        thesis="The Sabarmati through the city is now a reservoir about 15 kilometres long, held by the Vasna barrage below and replenished from the Narmada canal above."
      >
        <p>
          Holding water in the river was an old idea with an old problem. In 1879
          the Gazetteer described a proposed weir on the Sabarmati near the city
          that would water 79,500 acres and bring the city &ldquo;a supply of much
          needed water&rdquo;, at an estimated Rs 17,12,880. The chief difficulty
          was &ldquo;the absence in the bed of the river of any solid foundation
          for the weir&rdquo;. In the early 1960s Bernard Kohn, a French architect
          living in the city, proposed reclaiming about 30 hectares of riverbed;
          a hydraulic study by CWPRS found his proposal technically feasible in
          1966. The state built the Vasna barrage below the city between 1972 and
          1976. It holds 5.34 million cubic metres and feeds the Fatehwadi
          irrigation canal.
        </p>
        <p>
          The present project starts in 1997. AMC set up the Sabarmati River
          Front Development Corporation Limited (SRFDCL), incorporated on{" "}
          <strong>28 May 1997</strong>, and in May 1998 its consultants, the
          Environmental Planning Collaborative, delivered a proposal for the nine
          kilometres from Subhash Bridge to the Vasna barrage: embankments on both
          banks, 162 hectares of reclaimed land, a channel 275 metres wide and,
          among its listed features, &ldquo;Retention of water in the river for
          the whole year&rdquo;.
        </p>
        <p>
          The same report worked out why that would need help. If the barrage
          were full on 1 August after a normal monsoon and then lost water only to
          seepage and evaporation, the pond would shrink month by month until:
        </p>
        <PullQuote attribution="Environmental Planning Collaborative, Proposal for Sabarmati Riverfront Development, May 1998">
          On 12th of January the river will be empty.
        </PullQuote>
        <p>
          Its conclusion was that &ldquo;it will be necessary to periodically
          replenish the water in the river.&rdquo; That is what was built. The
          2016 dossier&apos;s timeline records the project as initiated in 2004.
          SRFDCL describes a river channelled to a constant width (263 metres on
          its website, 275 in its own 2015 presentation), about 202 to 205
          hectares of reclaimed riverbed, and a two-level promenade along about
          11.5 kilometres of both banks. Interceptor sewers twelve kilometres long
          on each bank pick up 38 sewage discharge points and carry the sewage to
          treatment plants south of the barrage, at Vasna and Pirana.
        </p>
        <p>
          And the water is held. In SRFDCL&apos;s words, the barrage makes it
          possible to retain water &ldquo;for 15 kilometers upstream, the entire
          length of the river within the city&rdquo;, and the Narmada canal,
          crossing a few kilometres upstream, &ldquo;makes it possible to
          replenish the barrage-retained water that is used up for irrigation or
          is lost to evaporation and seepage&rdquo;. AMC&apos;s own 2022
          environmental framework is plainer: &ldquo;Sabarmati has no flow most
          of the days in a year. It receives required water to retain water at
          the city&apos;s riverfront for aesthetics and recreation.&rdquo;
        </p>
        <Figure
          src="/images/story/ahmedabad/sabarmati-riverfront-2012.jpg"
          alt="A broad, full river between straight concrete embankments. On the near bank a lower promenade with lamp posts runs along the water below a retaining wall and a strip of sand; buildings line the far bank and a long bridge crosses in the distance under a hazy blue sky."
          caption="The Sabarmati through the city in January 2012, between the riverfront's retaining walls and lower promenade. The water is held by the Vasna barrage downstream and replenished from the Narmada canal."
          source="Kashyap2102, via Wikimedia Commons"
          credit="Sabarmati River, Ahmedabad, 2012. CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0)"
          aspect="4/3"
        />
        <p>
          The riverbed was not empty land. How many households lived on it
          depends on which document you open: about 10,000 families in the 1998
          proposal; 10,162 project-affected families in a HUDCO awards
          compendium; 11,736 households entitled to a house in SRFDCL&apos;s 2015
          presentation, of whom 8,396 had been relocated by 30 August 2012; and
          about 14,500 households enumerated by the project&apos;s 2000-02 survey,
          as reported in an academic study (Desai, 2012). We do not pick one.
          Resettlement ran under the Gujarat High Court, in a public interest
          petition registered in 2005. The court closed it in November 2014,
          recording that everyone on both the corporation&apos;s and the
          petitioners&apos; lists had been allotted alternative accommodation,
          provided they completed the formalities.
        </p>
        <p>
          The held river is getting longer. Phase 2, upstream to Indira Bridge,
          received its environmental clearance on 17 February 2022. Phase 3, from
          Indira Bridge to the Narmada canal syphon, was cleared on 12 March 2025
          at a project cost of Rs 1,000 crore. Its upstream end is the canal
          crossing itself: the riverfront is to run all the way to the canal that
          keeps it full.
        </p>
      </Chapter>

      <Chapter
        id="below-vasna"
        number={9}
        title="Downstream of the promenade"
        thesis="Below the barrage the river carries what the city sends back, and the Central Pollution Control Board has listed the Sabarmati at Priority I in every edition of its polluted-stretch list since 2018."
      >
        <p>
          Through the held reach the river measures low. In CPCB&apos;s national
          monitoring for 2024, biochemical oxygen demand (BOD, a measure of
          organic load) at the railway bridge in Ahmedabad ranged from 1.0 to 1.8
          mg/l. At the Vasana-Narol bridge the range was{" "}
          <strong>4.0 to 82.0 mg/l</strong>. At Miroli village it was 3.6 to
          29.0, and at Vautha, after the Meshwa joins, 1.2 to 23.0.
        </p>
        <p>
          AMC&apos;s 2022 environmental framework calls the stretch from Vasna to
          Vautha &ldquo;the critical stretch&rdquo;, carrying pollution that is
          diffuse and not fully attributed to the city&apos;s treatment plants. It
          also records two facts that explain the numbers. The river has no flow
          most days, and &ldquo;dilution of pollutants due to river water / flow
          happens only during monsoons&rdquo;. And the riverfront&apos;s
          interceptors do not take everything: &ldquo;excess quantity of sewage
          from interceptor is discharged into river through an outlet after Vasna
          barrage&rdquo;. A 2022 outfall survey, filed by the Gujarat Pollution
          Control Board with the National Green Tribunal, measured the bypass
          from a single pumping station near the Vasana-Narol bridge at{" "}
          <strong>284.18 MLD</strong>, with an average BOD of 93.75 mg/l.
        </p>
        <p>
          CPCB&apos;s list of polluted river stretches has carried the Sabarmati
          at Priority I, the first of its five classes, in all three editions: in
          2018 as &ldquo;Kheroj to Vautha&rdquo;, with BOD from 4 to 147 mg/l; in
          2022 as &ldquo;Raysan to Vautha&rdquo;, with a maximum of 292 mg/l at
          the Vasana-Narol bridge; and in CPCB&apos;s updated version of October
          2025 as &ldquo;River Sabarmati from V.N. Bridge to A/C with
          Vathua&rdquo;, with a maximum of 105 mg/l. Each
          edition draws the stretch differently and uses different years of data,
          so the three numbers are not a trend. The class is the constant.
        </p>
        <p>
          The Gujarat High Court took up the river on its own motion in 2021. On
          14 September 2021 it set up a Joint Task Force, and nine days later it
          directed that &ldquo;there should be no discharge of untreated waste
          water in the Sabarmati river from either of the outfalls&rdquo; reported
          to it. By December 2021, AMC reports, the task force had disconnected
          more than 380 industrial connections to the sewers. In August 2024 the
          court directed the parties to work towards &ldquo;zero discharge of
          Industrial wastewater in the river Sabarmati&rdquo;.
        </p>
        <p>
          Twenty kilometres downstream, at Miroli, the case reached the people
          who use that water. The court recorded that members of a cooperative
          society there said they were &ldquo;officially drawing
          sewage-cum-industrial effluent and irrigating their fields&rdquo;. Its
          counsel said the society had been set up almost fifty years earlier,
          with the Collector&apos;s permission to draw water from the river, that
          the water served three villages, and that the water in their old
          borewells had receded until the wells were &ldquo;almost
          defunct&rdquo;. The court directed the society to have its members
          revive those borewells, with the water tested by the pollution board
          before use, and directed that &ldquo;no farmer/person/entity shall be
          allowed to draw chemical effluent water for irrigation/agricultural
          purpose&rdquo;.
        </p>
        <p>
          East of the city runs a second waterway with a similar arc. In 1868-69,
          the Gazetteer says, a cut from the Khari river at Raipur was begun as a
          famine relief work and stopped once the famine passed. Between 1878 and
          1881 the Khari Cut was built, &ldquo;designed to irrigate Ahmedabad
          lands and to fill the Chandola lake, three miles south of
          Ahmedabad&rdquo;, in the words of a Bombay High Court judgment quoted in
          a 2020 committee report to the National Green Tribunal. That report
          gives it a length of about 80 kilometres and a planned command of about
          10,200 hectares in 110 villages.
        </p>
        <p>
          By 2020 the canal took its water from the Narmada Main Canal at Muthia,
          and the committee found that it &ldquo;remains by and large dry after
          the month of April however, the canal is used for sewage/trade effluent
          and waste&rdquo;. In about 11 kilometres inside the city it counted{" "}
          <strong>169 outlets</strong> into the canal, 56 of them discharging
          untreated sewage or effluent on the day of inspection; officers of the
          Irrigation Department told it that &ldquo;no permission is granted for
          any outlet in the canal&rdquo;. AMC&apos;s framework notes that the
          canal drains to the Khari river, and CPCB&apos;s 2018 list put the Khari
          from Lali village to Kashipura at Priority I, with a BOD of 235 mg/l.
        </p>
      </Chapter>

      <Chapter
        id="world-heritage"
        number={10}
        title="The cistern made the list; the river stayed outside the line"
        thesis="UNESCO's 2017 inscription names the pol house's own water supply as part of what makes the walled city outstanding. The same file records the argument that the river was never really part of the city."
      >
        <p>
          In <strong>July 2017</strong> the World Heritage Committee inscribed the
          Historic City of Ahmadabad: the walled city, 535.7 hectares inside walls
          10.97 kilometres long, with a buffer zone of 395 hectares, under
          criteria (ii) and (v). Water is in the inscription itself. Under
          criterion (v), the Statement of Outstanding Universal Value says:
        </p>
        <PullQuote attribution="UNESCO, Statement of Outstanding Universal Value, Historic City of Ahmadabad (2017)">
          The house is a self-sufficient unit with its own provisions for water,
          sanitation and climatic control (the court yard as the focus).
        </PullQuote>
        <p>
          That provision is the courtyard cistern: the nomination dossier says the
          central court of the house &ldquo;was the main climatic feature with its
          own rain water storage system&rdquo;. It lists &ldquo;the water
          structures associated with settlement planning of historic times&rdquo;
          among the attributes of the historic town, and it photographs the
          chinni, a narrow alley between rows of houses &ldquo;for ventilation
          &amp; rain water evacuation&rdquo;. The inventory in the dossier counts
          2,247 domestic buildings of heritage value and 449 institutional ones.
          ICOMOS, the advisory body that evaluated the nomination, described pol
          houses as containing &ldquo;courtyards, water storage systems and richly
          embellished façades&rdquo;, asked for more on the &ldquo;role of water
          structures in the historic functions of the city&rdquo;, and said the
          case under criterion (v) needed clearer treatment of &ldquo;water
          management and other traditional characteristics&rdquo;.
        </p>
        <p>
          The river is another matter. Defending a buffer zone drawn along the new
          riverfront edge, India, the nominating State Party, argued, in
          ICOMOS&apos;s summary,
          &ldquo;that in the past there was little direct connection between the
          historic city and the river, and that the river bed offered panoramic
          horizons for the historic city as the river remained dry for much of the
          year&rdquo;. ICOMOS pointed to an older connection: at Ganesh Bari gate,
          at the south-west corner of the fort, &ldquo;water was lifted from the
          river to the fort by water wheels&rdquo;. It noted that high-rise
          buildings appeared to separate the property from the river, recommended
          that the western boundary be extended &ldquo;to re-establish the
          historic connection of the Historic City of Ahmedabad to the
          river&rdquo;, and recommended that the nomination be deferred. The
          Committee inscribed it in July 2017. The integrity statement in the
          inscription records that &ldquo;the hydrology and natural features have
          been subjected to changes due to progressive implementation of
          infrastructure by the local authorities&rdquo;.
        </p>
        <p>
          Both statements are on the record, and between them they hold the
          city&apos;s water history: a house that kept its own rain, beside a
          river that for most of the year was sand. The house&apos;s own water
          supply is now written into a World Heritage inscription, and the one
          survey that went back to the cisterns found the working ones abandoned.
          The river is full, with water carried from Sardar Sarovar and held by a
          barrage, and below the barrage it is a Priority I stretch. The aquifer that carried the city between the two is
          over-exploited.
        </p>
        <ThenNow
          thenLabel="1879"
          nowLabel="2026"
          rows={[
            {
              metric: "Main source of drinking water",
              then: "Rain cisterns under the courtyards",
              now: "The Narmada Main Canal: 1,550 of 1,850 MLD",
            },
            {
              metric: "The Sabarmati at the city, outside the rains",
              then: "A 375-foot stream in a 1,550-foot bed of sand",
              now: "Held for 15 km by the Vasna barrage, topped up from the canal",
            },
            {
              metric: "Piped supply",
              then: "Not more than one gallon a person a day, from the river",
              now: "1,850 MLD a day: Narmada 1,550, Mahi 200, borewells 100",
            },
            {
              metric: "Groundwater under the city",
              then: "Wells inside the walls 'unfit to drink'",
              now: "Ahmedabad Urban unit over-exploited, 128.85% (IN-GRES 2025-26)",
            },
            {
              metric: "Rain cisterns",
              then: "In almost all the courtyards of the better class of houses",
              now: "Estimated at five to ten thousand; never counted",
            },
            {
              metric: "The river below the city",
              then: "'Soiled' as it passed the cantonment and the city",
              now: "CPCB Priority I in 2018, 2022 and 2025",
            },
          ]}
        />
        <CTA href="/ahmedabad">See where Ahmedabad&apos;s water comes from today</CTA>
        <CTA href="/ahmedabad/groundwater">The unit the district average hides</CTA>
        <CTA href="/ahmedabad/rivers">The river above and below Vasna</CTA>
      </Chapter>
    </StoryPage>
  );
}
