import type { WaterwayStory } from "./types";

/** The canal's Story copy: chapter prose, visuals and panel wording. */
export const BUCKINGHAM_CANAL_STORY: WaterwayStory = {
  noun: "canal",
  todayNote:
    "Ten-metre pixels read narrow city reaches conservatively; the ribbon " +
    "shows surface condition, not flow. Suspended-sediment readings cover " +
    "the reaches with enough open water; depth needs a boat, and the last " +
    "public depth survey is from 2014.",
  ledgerChapter: "squeeze",
  chapters: {
    ennore: {
      body:
        "The canal enters Chennai through its heaviest industry: two power " +
        "stations, a refinery belt, a port. The consent regime has steadily " +
        "moved routine industrial discharge off the canal, and TNPCB's " +
        "investigation of the August 2026 fish kill is under way. Continuous " +
        "measurement alongside the regulator's is how such questions get " +
        "answered quickly.",
      visual: {
        kind: "chip",
        file: "site-ennore-junction.jpg",
        alt: "The Ennore creek junction from orbit",
      },
    },
    squeeze: {
      body:
        "Through the city the canal runs under the MRTS railway, routed " +
        "along it in the 1980s after a Planning Commission working group " +
        "found no other corridor economically available. The reach now holds " +
        "the alignment's narrowest water, and therefore the clearest case " +
        "for the measured baseline that restoration planning needs.",
      visual: {
        kind: "width-profile",
        xLabel: "km from Ennore",
        band: { from: 20.5, to: 32, label: "MRTS reach" },
        // "\\u2013" renders literally on the live page; kept as shipped.
        caption:
          "Water-surface width every 200 m, measured from OpenStreetMap water " +
          "polygons (contributor-traced; the polygons carry edits from 2018 to " +
          "March 2026, most since 2022; snapshot Jul 2026). Shaded band: the " +
          "MRTS city reach (km 20.5\\u201332).",
      },
    },
    okkiyam: {
      body:
        "South Chennai drains through one channel into this canal; the marsh " +
        "behind it breathes with the tide through the same gate. CMRL has " +
        "invested in widening the water opening at this crossing, and 2026 field " +
        "reports tracked a construction-phase narrowing alongside - the " +
        "kind of change a live baseline registers as it happens.",
      visual: {
        kind: "chip",
        file: "site-okkiyam-maduvu.jpg",
        alt: "The Okkiyam Maduvu confluence area from orbit",
      },
    },
    estuary: {
      body:
        "Below the city the canal widens into backwaters the tide still " +
        "reaches, and everything changes: birds in the dozens of species, " +
        "working fishers, a boat house, brackish water that stays naturally " +
        "clear of hyacinth. The system hangs on mouths that sand closes for " +
        "most of the year, and mouth management already has a budget line.",
      visual: {
        kind: "chip",
        file: "site-muttukadu.jpg",
        alt: "The Muttukadu backwater from orbit",
      },
    },
    ribbon: {
      body:
        "The last stretch is the canal at its most complete: banks " +
        "un-encroached (though unprotected), no structures for eleven " +
        "kilometres, a channel running green with vegetation. It is the " +
        "least altered water on the alignment, and the easiest place to begin " +
        "the restoration the current programmes plan.",
      visual: {
        kind: "chip",
        file: "seg-km64-66.jpg",
        alt: "The vegetation-choked southern canal from orbit",
      },
    },
    paper: {
      body:
        "The canal's record shows sustained intent: a national-waterway " +
        "designation, a High Court mandate, detailed project reports, an " +
        "umbrella sanction for the three waterways, and now the Urban " +
        "Challenge Fund window with a water-metro study in procurement. " +
        "Seventeen years of groundwork have come together; below is that record, " +
        "dated and sourced.",
      visual: { kind: "timeline" },
    },
    pilot: {
      body:
        "Neer Vazhvu built this page from public records and open satellites; " +
        "keeping it current needs instruments on the water. The list is short " +
        "and standard: levels and flow at the reaches that decide floods, " +
        "dissolved oxygen where the monthly record stopped in 2023, the state " +
        "of the mouths through the seasons, a boat-run depth profile - the " +
        "first since 2014 - and field checks under the vegetation the " +
        "satellite flags. This is the measurement layer Neer Vazhvu proposes " +
        "to operate alongside the institutions doing the restoration; the " +
        "page you are reading is its first deliverable.",
      visual: {
        kind: "list",
        items: [
          "Water level and flow at the reaches that decide floods",
          "Dissolved oxygen, resuming the monthly record",
          "Mouth state at Ennore, Adyar and Muttukadu, continuously",
          "A boat-run depth survey: the first since 2014",
          "Field checks on the vegetation the satellite flags",
        ],
      },
    },
  },
};
