import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  metaDescription:
    "River-system map for Kolkata - the Hooghly, the Adi Ganga through south Kolkata, the Bidyadhari and the Saraswati, with WBPCB tidal-paired water-quality status.",
  // Kolkata's channels are TIDAL, which is why WBPCB samples each Adi Ganga
  // point separately at high and low tide - a distinction no other city on this
  // platform has. Station lists below are WBPCB EMIS stations, not CPCB NWMP.
  riverInfo: {
    hooghly: {
      display_name: "Hooghly",
      display_name_bn: "\u09b9\u09c1\u0997\u09b2\u09bf",
      length_km_geom: 140,
      description:
        "The distributary of the Ganga that Kolkata was built on, and the source of essentially all its drinking water. KMC abstracts at Palta, about 22 km north in Barrackpore, and at Garden Reach downstream - run-of-river, with no impounded storage anywhere in the system. The river is tidal this far inland, so quality readings swing with the tide.",
      upstream_terminus: "Farakka Barrage feeder canal (via the Bhagirathi)",
      downstream_terminus: "Bay of Bengal, ~130 km downstream",
      feeds: "Palta (Indira Gandhi WTP), Garden Reach, Jorabagan, Watgunge; bulk sales to Bidhannagar and Budge Budge",
      status: "Comparatively healthy at the city's intakes - DO 5.6-6.3 mg/l, BOD ~2.1-2.2, faecal coliform 46,000-48,000 MPN/100ml (WBPCB, Jul 2026). The pollution story is not the mainstem, it is the Adi Ganga.",
      cpcb_nwmp_stations: ["Ganga at Palta (intake)", "Ganga at Dakshineswar", "Ganga at Garden Reach"],
      color: "#2563eb",
    },
    "adi-ganga": {
      display_name: "Adi Ganga",
      display_name_bn: "\u0986\u09a6\u09bf \u0997\u0999\u09cd\u0997\u09be",
      length_km_geom: 39,
      description:
        "The original course of the Ganga, running through south Kolkata past Kalighat, now largely an engineered channel also known as Tolly's Nullah. WBPCB samples it at six points, each SEPARATELY at high tide and low tide - the only tidal station pairing on this platform, and the correct way to measure a channel that reverses twice a day.",
      upstream_terminus: "Hooghly offtake at Hastings",
      downstream_terminus: "Rejoins the tidal creek system towards the Sundarbans",
      feeds: "Nothing - it is a drainage and sewage channel, not a supply source",
      status:
        "Dead. Dissolved oxygen NIL at every monitored point in the latest round, faecal coliform 3.4 to 11 million MPN/100ml, water recorded by WBPCB's own observers as 'Blackish' and 'Pungent'. Low tide is consistently worse than high: at Bansdroni, BOD 14.53 against 10.75 and faecal coliform 8.4m against 4.9m on the same day.",
      cpcb_nwmp_stations: [
        "Bansdroni (high + low tide)",
        "Jirat Bridge (high + low tide)",
        "Kalighat (high + low tide)",
        "Karunamoyee (high + low tide)",
        "Kudghat (high + low tide)",
        "Sahid Kshudiram (high + low tide)",
      ],
      color: "#dc2626",
    },
    bidyadhari: {
      display_name: "Bidyadhari",
      display_name_bn: "\u09ac\u09bf\u09a6\u09cd\u09af\u09be\u09a7\u09b0\u09c0",
      length_km_geom: 38,
      description:
        "The channel that drains the East Kolkata Wetlands eastward towards the Sundarbans. It carried Kolkata's drainage until it silted up in the early twentieth century - the failure that created the wetland fishery system now treating 910 MLD of the city's sewage.",
      upstream_terminus: "East Kolkata Wetlands outfall",
      downstream_terminus: "Raimangal estuary / Sundarbans",
      feeds: "Wetland fisheries; no drinking-water abstraction",
      status: "No public WBPCB series at the city end; monitored upstream at Haroa Bridge in North 24 Parganas.",
      cpcb_nwmp_stations: ["U/S of Bidyadhari river at Haroa Bridge"],
      color: "#d97706",
    },
    saraswati: {
      display_name: "Saraswati",
      display_name_bn: "\u09b8\u09b0\u09b8\u09cd\u09ac\u09a4\u09c0",
      length_km_geom: 67,
      description:
        "A former principal channel of the Ganga west of the Hooghly, now a much-reduced watercourse through Howrah and Hooghly districts. Included as basin context: it is part of the deltaic braid the city sits in, not a Kolkata supply or drainage arm.",
      upstream_terminus: "Hooghly offtake near Tribeni",
      downstream_terminus: "Rejoins the Hooghly near Sankrail",
      feeds: "No Kolkata abstraction",
      status: "No dedicated WBPCB station on this reach; shown for basin context. The line renders in two pieces with a 10.6 km break: through that stretch OpenStreetMap maps the channel not as the Saraswati but as the 'Kana' (Bengali for blind or dead) and as unnamed 'khal' ditches. We do not join them, because that would assert an identity the map itself does not make - the break is where the river stopped being called a river.",
      cpcb_nwmp_stations: [],
      color: "#64748b",
    },
  },
};
