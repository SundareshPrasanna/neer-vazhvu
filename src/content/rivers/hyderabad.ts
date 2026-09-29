import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  // Delhi: Yamuna-basin scope. river_ids match delhi-rivers.geojson. The
  // "stations" listed are DPCC's monthly monitoring points (the highest-
  // cadence feed on the platform: public/data/dpcc-monthly-wq-delhi.json),
  // not CPCB NWMP - Delhi's own committee out-monitors the national
  // programme. NAMING DECISION (documented in data-sources.md): OSM maps
  // most of the Najafgarh drain's course as the Sahibi's engineered reach,
  // so the `sahibi` geometry carries the natural-river framing and the
  // `najafgarh` entry carries the drain story; the two entries cross-
  // reference each other rather than pretending to be separate waters.
  // Hyderabad. The page was stubbed for want of THIS block, not for want of
  // data: hyderabad-rivers.geojson has been in the repo since 26 Jul, and the
  // shared client treats river-quality / river-events / industrial-sources as
  // optional overlays ("404 is expected and silent"), which is how Delhi
  // renders with no industrial-sources file at all.
  //
  // length_km_geom values are COMPUTED from the in-repo OSM geometry
  // (public/geojson/hyderabad-rivers.geojson, fetch-rivers-osm-hyderabad.ts),
  // the same basis every other city uses - not quoted from a secondary source.
  riverInfo: {
    musi: {
      display_name: "Musi",
      display_name_te: "\u0c2e\u0c42\u0c38\u0c40 \u0c28\u0c26\u0c3f",
      length_km_geom: 244,
      description:
        "The river Hyderabad was founded on, dammed to survive, and then discharged into. Osman Sagar (begun 1913, completed 1918) impounds it upstream of the city, built as flood control first and water supply second after the Great Musi Flood of 28 September 1908 took roughly 59,000 houses and breached 221 of the 788 tanks strung along the river. Below the city the Musi carries the sewage load: the state's own interception programme covers a 34 km reach from Bapu Ghat to Gowrelly, and the Musi Riverfront Development programme covers 55 km from Gandipet to Gowrelly. The tank cascade the river once organised is still traceable - 428 tanks linked by 411 flow paths, chains running up to nine deep.",
      upstream_terminus: "Anantagiri hills, Vikarabad district; Osman Sagar impounds the upper reach",
      downstream_terminus: "Joins the Krishna downstream of the city, in Nalgonda district",
      feeds: "Osman Sagar (Gandipet) - one of six HMWSSB sources, ~4-7% of daily city draw",
      status:
        "CPCB Priority-I polluted stretch (Hyderabad to Nalgonda); DO at or below 0.5 mg/L through the city every year 2019-2024",
      cpcb_nwmp_stations: [
        "U/s of Musi at Gandipet, Osman Sagar (1172)",
        "River Musi at Nagole (2339)",
        "D/s of Musi at Pratapasingaram (1173)",
        "River Musi at Kasaniguda (3082)",
      ],
      color: "#2563eb",
    },
    esi: {
      display_name: "Esi",
      display_name_te: "\u0c08\u0c38\u0c40 \u0c28\u0c26\u0c3f",
      length_km_geom: 10,
      description:
        "The Musi's tributary, and the reason Hyderabad has two protected catchments rather than one. Himayat Sagar was built on the Esi after Osman Sagar, completing the pair of impounding reservoirs M. Visvesvaraya proposed in 1909 to hold back 'all floods in excess of what the river channel could carry'. Only 10 km of its course falls inside the mapped extent here, which is why it reads as a short line rather than a river system.",
      upstream_terminus: "Rises west of the city; Himayat Sagar impounds it",
      downstream_terminus: "Joins the Musi below the twin reservoirs",
      feeds: "Himayat Sagar - one of six HMWSSB sources",
      status:
        "Catchment protected by GO 111 (1996), repealed 2022; the twins have been drawn on every day since 2020",
      cpcb_nwmp_stations: [],
      color: "#0891b2",
    },
    haldi: {
      display_name: "Haldi",
      length_km_geom: 57,
      description:
        "Mapped here because OpenStreetMap carries 57 km of it inside our extent, and a river drawn on the map with nothing behind it is worse than one that says so. We hold no monitoring, no narrative and no programme for the Haldi: it appears in no CPCB NWMP station list we have parsed, in no Telangana pollution-board return, and in none of the state's polluted-stretch classifications. The line is OSM geometry and nothing more.",
      upstream_terminus: "Not established from public sources",
      downstream_terminus: "Not established from public sources",
      feeds: "No HMWSSB source draws from it",
      status: "No monitoring data located; OSM geometry only",
      cpcb_nwmp_stations: [],
      color: "#94a3b8",
    },
    manjira: {
      display_name: "Manjira",
      display_name_te: "\u0c2e\u0c02\u0c1c\u0c40\u0c30\u0c3e \u0c28\u0c26\u0c3f",
      length_km_geom: 174,
      description:
        "Not a Hyderabad river but a Hyderabad supply line: a Godavari tributary carrying two of HMWSSB's six sources, the Manjira and Singur reservoirs, from well outside the city. It is the oldest of the long-distance transfers the city now runs on, and the reason the twin reservoirs stopped being the whole story long before GO 111 was repealed.",
      upstream_terminus: "Rises in the Western Ghats, Maharashtra; Singur reservoir on the middle reach",
      downstream_terminus: "Joins the Godavari",
      feeds: "Singur (29,917 mcft) and Manjira (1,500 mcft) - two of six HMWSSB sources",
      status:
        "CPCB Priority-II stretch (Gowdicherla to Nakkavagu); DO holds near 6 mg/L either side of the confluence",
      cpcb_nwmp_stations: [
        "U/s Manjeera at Gowdicharla, before Nakkavagu confluence (2374)",
        "D/s Manjeera at Gowdicherla, after Nakkavagu confluence (2375)",
      ],
      color: "#059669",
    },
  },
};
