import { BANGALORE } from "@/lib/cities/bangalore";
import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  metaDescription:
    "River-system map for Bengaluru - Vrishabhavathi, Arkavathi and the Cauvery lifeline, with pollution status from official monitoring.",
  header: {
    scopeLabel: "Two river systems (Arkavathi and Dakshina Pinakini)",
    showStats: false,
    atlasCtaLabel: "State of Bengaluru's River Systems",
    // The basin ABOVE this city's rivers: a header entry point into the
    // Cauvery (Karnataka) overview, whose Arkavati cell drills back down
    // into the deep dive (docs/specs/cauvery-basin-hierarchy.md §2).
    overviewBasinId: "cauvery-ka",
  },
  // Zoom 11 frames the GBA bbox (~38x41 km) tightly; 10 read as too wide.
  map: { center: [BANGALORE.center.lat, BANGALORE.center.lng], zoom: 11 },
  // Bengaluru is a ridge city across three drainage divides; its
  // "river system" is really three small rivers (Vrishabhavathi west,
  // Arkavati north-west, Dakshina Pinakini east) that the city's
  // sewerage discharges into rather than being fed by.
  riverInfo: {
    vrishabhavathi: {
      display_name: "Vrishabhavathi",
      display_name_ta: "ವೃಷಭಾವತಿ ನದಿ",
      length_km_geom: 68,
      description:
        "The famous foam-and-fire river. Flows south-west out of central BBMP through the Vrishabhavathi Valley, picking up the untreated overflow from the V Valley STPs (180 + 150 MLD design) plus the Mailasandra catchment. Discharges into Byramangala reservoir (348 ha) before joining the Arkavathi, then the Cauvery. The 2015 May Bellandur foam-fire event was downstream of the same sewerage system.",
      description_ta: "",
      upstream_terminus: "Central BBMP (Vrishabhavathi Valley)",
      upstream_terminus_ta: "",
      downstream_terminus: "Byramangala reservoir, then Arkavathi / Cauvery",
      downstream_terminus_ta: "",
      feeds: "Byramangala reservoir; downstream Cauvery via Arkavathi",
      feeds_ta: "",
      status: "KSPCB priority polluted stretch; V Valley STPs over capacity",
      status_ta: "",
      cpcb_nwmp_stations: [
        "Vrishabhavathi at Kengeri (upstream)",
        "Vrishabhavathi downstream of K&C Valley STP discharge",
      ],
      cpcb_nwmp_stations_ta: [],
      color: "#d97706",
    },
    arkavati: {
      display_name: "Arkavathi",
      display_name_ta: "ಅರ್ಕಾವತಿ ನದಿ",
      length_km_geom: 102,
      description:
        "Cauvery tributary that gave Bengaluru its first piped water supplies - Hesaraghatta lake (1894, Chamarajendra Water Works) and Tippagondanahalli reservoir (1933, Chamaraja Sagara). Both impoundments are now defunct as freshwater sources due to upstream urbanisation. TG Halli is being repurposed as a 110 MLD indirect-potable-reuse pilot with SUEZ.",
      description_ta: "",
      upstream_terminus: "Nandi Hills / Doddaballapur (Chikballapur)",
      upstream_terminus_ta: "",
      downstream_terminus: "Joins Cauvery downstream of Kanakapura",
      downstream_terminus_ta: "",
      feeds: "Hesaraghatta + TG Halli reservoirs; downstream irrigation",
      feeds_ta: "",
      status: "Catchment built over; reservoirs effectively dead; TG Halli IPR pilot under SUEZ",
      status_ta: "",
      cpcb_nwmp_stations: [],
      cpcb_nwmp_stations_ta: [],
      color: "#2563eb",
    },
    "dakshina-pinakini": {
      display_name: "Dakshina Pinakini",
      display_name_ta: "ದಕ್ಷಿಣ ಪಿನಾಕಿನಿ",
      length_km_geom: 99,
      description:
        "East-flowing river that originates in BBMP south and exits into Tamil Nadu, where it is called Ponnaiyar. Drains the Koramangala-Challaghatta valley downstream of Bellandur Lake. Carries the cumulative discharge of K&C Valley sewerage to the state border.",
      description_ta: "",
      upstream_terminus: "Chennasandra / Begur area, BBMP south",
      upstream_terminus_ta: "",
      downstream_terminus: "Tamil Nadu border (becomes Ponnaiyar)",
      downstream_terminus_ta: "",
      feeds: "Downstream irrigation in TN's Krishnagiri / Tiruvannamalai",
      feeds_ta: "",
      status: "Sewage-dominated downstream of Bellandur",
      status_ta: "",
      cpcb_nwmp_stations: [],
      cpcb_nwmp_stations_ta: [],
      color: "#7c3aed",
    },
  },
};
