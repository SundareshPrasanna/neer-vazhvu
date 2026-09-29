import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  metaDescription:
    "River-system map for Mumbai - Mithi, Dahisar, Poisar, Oshiwara and the regional Ulhas, with MPCB water-quality status.",
  header: { scopeLabel: "MMR rivers (urban + eastern Ulhas corridor + source rivers)" },
  // MMR spread: BMC rivers in the SW, the Ulhas corridor in the east, and
  // the source rivers (Vaitarna/Bhatsa/Tansa) in the NE.
  map: { center: [19.35, 73.15] },
  riverInfo: {
    mithi: {
      display_name: "Mithi River",
      length_km_geom: 18,
      description:
        "Mumbai's principal river - rises from the Vihar and Powai lake overflows in the Sanjay Gandhi National Park and runs ~18 km south-west through Saki Naka, Kurla, Dharavi and Mahim to the Arabian Sea at Mahim Creek. Walled and channelised, it carries largely untreated sewage and industrial effluent, and it was the river that overflowed in the 26 July 2005 deluge.",
      upstream_terminus: "Vihar / Powai lake overflows (Sanjay Gandhi NP)",
      downstream_terminus: "Mahim Creek / Arabian Sea",
      feeds: "Mahim Creek estuary",
      status: "CPCB Priority-I polluted stretch; MRDPA jurisdiction; 2025 ED desilting probe",
      cpcb_nwmp_stations: [
        "Mithi at Powai (origin)",
        "Mithi at Kurla (CST Road bridge)",
        "Mithi at Mahim Creek (mouth)",
      ],
      color: "#dc2626",
    },
    dahisar: {
      display_name: "Dahisar River",
      length_km_geom: 12,
      description:
        "Rises from Tulsi Lake in the Sanjay Gandhi National Park and flows ~12 km west through Dahisar to the Gorai/Manori Creek and the Arabian Sea; reduced to a sewage-fed channel through built-up Dahisar.",
      upstream_terminus: "Tulsi Lake (Sanjay Gandhi NP)",
      downstream_terminus: "Gorai / Manori Creek",
      feeds: "Manori Creek",
      status: "CPCB Priority-I polluted stretch; BMC rejuvenation STPs under trial (2025)",
      cpcb_nwmp_stations: [],
      color: "#d97706",
    },
    poisar: {
      display_name: "Poisar River",
      length_km_geom: 7,
      description:
        "Originates in the Sanjay Gandhi National Park and runs ~7 km through Kandivali to the Marve Creek; largely a storm-water and sewage channel through built-up Kandivali.",
      upstream_terminus: "Sanjay Gandhi National Park",
      downstream_terminus: "Marve Creek",
      feeds: "Marve Creek",
      status: "CPCB Priority-I polluted stretch; BMC rejuvenation programme",
      cpcb_nwmp_stations: [],
      color: "#7c3aed",
    },
    oshiwara: {
      display_name: "Oshiwara River",
      length_km_geom: 7,
      description:
        "Rises near the Aarey Milk Colony and the Sanjay Gandhi National Park and flows ~7 km through Goregaon and Jogeshwari to the Malad Creek; heavily encroached and sewage-fed through its urban course.",
      upstream_terminus: "Aarey / Sanjay Gandhi National Park",
      downstream_terminus: "Malad Creek",
      feeds: "Malad Creek",
      status: "CPCB Priority-I polluted stretch; BMC rejuvenation programme",
      cpcb_nwmp_stations: [],
      color: "#2563eb",
    },
  },
};
