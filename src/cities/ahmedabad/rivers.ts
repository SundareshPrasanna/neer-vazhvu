import type { CityRiversContent } from "@/content/rivers/types";

// The Sabarmati's story is a gradient, so the stations run the whole reach
// CPCB monitors, Dharoi to Vautha, and the map opens on the city where the
// change happens. The Narmada Main Canal and the Kharicut are drawn because
// the city cannot be read without them: one is where its water comes from,
// the other is where its industrial east drains.
export const RIVERS: CityRiversContent = {
  metaDescription:
    "The Sabarmati through Ahmedabad: CPCB station readings from Dharoi to Vautha, 2018-2024, a Priority I polluted stretch below the city, and the canals that feed and drain it.",
  header: { scopeLabel: "The Sabarmati, the Khari and two canals" },
  map: { center: [23.0, 72.58], zoom: 10 },
  riverInfo: {
    sabarmati: {
      display_name: "Sabarmati",
      color: "#2563eb",
      length_km_geom: 275,
      description:
        "The river Ahmedabad was founded on, and no longer drinks from. Through the city it is a 15 km reach held by the Vasna barrage and topped up from the Narmada canal, which crosses it a few kilometres upstream; below the barrage it carries the city's sewage and the industrial effluent of the Mega pipeline and the Narol CETP line, and becomes one of the most polluted stretches CPCB lists.",
      upstream_terminus: "Dharoi dam (Mehsana district), above the city",
      downstream_terminus: "Gulf of Khambhat, after the Meshwo and Vatrak confluences near Vautha",
      feeds: "No AMC abstraction today: AMC's 2026-27 source table lists none from the river",
      status:
        "Clean where it enters the city, anoxic where it leaves. CPCB's highest BOD at Hansol was 1.2 to 5 mg/L in every year from 2018 to 2024; at V.N. Bridge it was 82 to 358 mg/L, and dissolved oxygen fell to 0.3 mg/L, CPCB's detection floor, every year from 2019 to 2024. Priority I in CPCB's 2018, 2022 and 2025 polluted-stretch reports.",
      cpcb_nwmp_stations: [
        "Kheroj bridge (state entry)",
        "Dharoi dam",
        "Mahudi",
        "Chiloda bridge, Gandhinagar",
        "Hansol bridge (city entry)",
        "Railway bridge (riverfront reach)",
        "V.N. Bridge (below the outfalls)",
        "Miroli, Daskroi",
        "Downstream of Miroli",
        "Vautha",
      ],
    },
    khari: {
      display_name: "Khari",
      color: "#b45309",
      length_km_geom: 171,
      description:
        "A tributary that passes the industrial estates east of the city and joins the Sabarmati downstream. The Kharicut canal was cut from it at Raipur in 1878-81 to irrigate the land south of the city and fill the Chandola tank.",
      upstream_terminus: "North-east of the city, along its mapped course",
      downstream_terminus: "The Sabarmati, south of Ahmedabad",
      feeds: "Irrigation through the Kharicut canal",
      status:
        "Priority I in all three CPCB editions; maximum BOD 235 mg/L (2018), 195 (2022) and 68 (2025) at Lali village.",
      cpcb_nwmp_stations: ["Lali village"],
    },
    kharicut: {
      display_name: "Kharicut canal",
      color: "#7c3aed",
      length_km_geom: 26,
      description:
        "A nineteenth-century irrigation canal that now runs through Naroda, Odhav and Vatva, where industrial and domestic outfalls reach it. AMC is rebuilding 12.5 km of it from the Naroda crematorium to Vinzol as closed boxes with a road above; its 2026-27 budget puts phase 1 near completion at Rs 1,100 crore.",
      upstream_terminus: "Offtake from the Khari at Raipur",
      downstream_terminus: "Irrigation command south of the city",
      feeds: "Irrigation (planned command about 10,200 ha in 110 villages)",
      status:
        "Not a CPCB monitoring point. GPCB's outfall sampling along it sits in National Green Tribunal filings rather than in any public series.",
      cpcb_nwmp_stations: [],
    },
    narmada_main_canal: {
      display_name: "Narmada Main Canal",
      color: "#0891b2",
      length_km_geom: 254,
      description:
        "The city's water. AMC's 2026-27 budget draws 1,550 of its 1,850 MLD from three offtakes on this canal, which carries water from Sardar Sarovar; the same canal tops up the Sabarmati through the riverfront.",
      upstream_terminus: "Sardar Sarovar dam on the Narmada",
      downstream_terminus: "North Gujarat, beyond this map",
      feeds: "Kotarpur (head regulators 1 and 2) and Jaspur (Dholka branch) water treatment plants",
      status: "A drinking-water source, not a polluted stretch. Its daily flow at the head regulator is published in the state's dam report.",
      cpcb_nwmp_stations: [],
    },
  },
};
