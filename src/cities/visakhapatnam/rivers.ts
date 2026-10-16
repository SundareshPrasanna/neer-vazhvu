import type { CityRiversContent } from "@/content/rivers/types";

// Visakhapatnam. CPCB's NWMP has no river station on any Visakhapatnam or
// Anakapalli river in its 2019-2024 tables. The city's channels are geddas, one
// river and a supply canal; the readings on this page are the reservoir, creek
// and canal stations that sit on them (public/data/river-quality-visakhapatnam.json,
// neer-vazhvu-api/scripts/build_visakhapatnam_water_quality.py).
//
// Sources for the figures below: drawals (41.0 MLD Meghadrigedda, 26.05 MLD
// Thatipudi) from APPCB's report to the NGT in OA 14/2021 (SZ), 22.07.2021,
// pdf pp. 2-3, the same figures as the 'Drawl' column of Table 4 in GVMC's
// ADB IEE for 24x7 water supply in the North West sector, Jan 2019, pdf p20;
// one-day supply (Meghadrigedda 8.44 MGD, 3.04 of it raw water to the Naval
// Dockyard (DGNP) and MES; Thatipudi 9.87 MGD) and the Yeleru canal users
// from GVMC's daily supply statement of 11.03.2021 (NGT OA 14/2021 (SZ)
// annexure, 1421_0.pdf p20); NTPC Simhadri's
// Yeleru draw from NTPC's half-yearly compliance report, Sept 2021, pdf pp. 24,
// 37; the pharma city supplied from the canal by APIIC from APPCB's report of
// 14.12.2023, annexed to its 06.07.2024 report to the NGT in OA 141/2023 (SZ),
// pdf p12; the Godavari and Yeleru source at 190 km from GVMC from CGWB's 2025
// aquifer plan for the Visakhapatnam and Anakapalli UAs, Table 9.1, pdf p102
// (a distance to the source, not the canal's length); VIWSCO's 56 km pipeline
// from Kateru to the Yeleru Left Main Canal from VIWSCO's project
// infrastructure page; dockyard creek DO minimums (2.4 mg/L in 2024, 1.0 in
// 2023, station 5678) from CPCB's NWMP creek and marine tables, 2024 and 2023,
// pdf p1; the inner harbour built at the gedda's mouth from Visakhapatnam
// Port's history page.
// length_km_geom is the drawn OSM line, re-read from
// public/geojson/visakhapatnam-rivers.geojson.
export const RIVERS: CityRiversContent = {
  defaultRiverId: "meghadrigedda",
  metaDescription:
    "Water quality on Visakhapatnam's channels: the Meghadri Gedda, the Gosthani and the Yeleru canal. CPCB's 2019-2024 tables list no river station in the city, so the readings come from the reservoir, creek and canal stations on each channel.",
  // The header tally would count a gedda and a canal as "rivers"; off.
  header: { scopeLabel: "Geddas, the Gosthani and the Yeleru canal", showStats: false },
  map: { center: [17.97, 83.08], zoom: 10 },
  riverInfo: {
    meghadrigedda: {
      display_name: "Meghadri Gedda",
      display_name_te: "మేఘాద్రి గెడ్డ",
      length_km_geom: 29.1,
      description:
        "A gedda, one of the natural drainage channels that cross the city, and not a river CPCB monitors: CPCB's 2019-2024 tables list no river station in Visakhapatnam. The readings on this page come from the Meghadrigedda reservoir, a city drinking-water source, and from a tidal creek at the Naval Dockyard bridge, close to where the channel enters the port's inner harbour. The harbour was built at the gedda's mouth and opened in 1933.",
      upstream_terminus:
        "Catchment above the Meghadrigedda reservoir, mostly in Visakhapatnam district with a small upper part in Vizianagaram district",
      downstream_terminus: "Inner harbour of Visakhapatnam port, past the Naval Dockyard",
      feeds:
        "City drinking water from the Meghadrigedda reservoir, and raw water for the Naval Dockyard (DGNP) and MES. GVMC's daily supply sheet for 11 March 2021 gives 8.44 MGD supplied that day, 3.04 MGD of it raw water. APPCB's 2021 report to the NGT gives 41.0 MLD, the same figure as GVMC's January 2019 source table for the Asian Development Bank",
      status:
        "No river station in CPCB's 2019-2024 tables. Readings: Meghadrigedda reservoir; Naval Dockyard creek, lowest DO 1.0 mg/L in 2023, 2.4 mg/L in 2024.",
      cpcb_nwmp_stations: [
        "5160 Meghadrigedda Reservoir (2024)",
        "5678 Sardar Vallabhai Patel Bridge, Naval Dockyard creek (2023, 2024)",
      ],
      color: "#0e7490",
    },
    gosthani: {
      display_name: "Gosthani",
      display_name_te: "గోస్తని",
      length_km_geom: 112.9,
      description:
        "The one river in this set. CPCB's 2019-2024 tables list no river station on it in Visakhapatnam; the readings on this page are from Thatipudi reservoir on the Gosthani, upstream in Vizianagaram district, which supplies part of the city's drinking water. CPCB stations named 'Gostani' (4372, 4373) and the 'Gostani along Vendra' polluted stretch are a different river, in West Godavari district.",
      upstream_terminus: "Eastern Ghats, above Thatipudi reservoir in Vizianagaram district",
      downstream_terminus: "Bay of Bengal at Bheemunipatnam",
      feeds:
        "City drinking water from Thatipudi reservoir and GVMC's Gosthani infiltration wells. GVMC's daily supply sheet for 11 March 2021 gives 9.87 MGD supplied from Thatipudi that day. APPCB's 2021 report to the NGT gives 26.05 MLD, the same figure as GVMC's January 2019 source table for the Asian Development Bank",
      status:
        "No river station in CPCB's 2019-2024 tables. Readings: Thatipudi reservoir (2021, 2022, 2024), DO 4.1 mg/L or more, BOD 2.8 mg/L or less.",
      cpcb_nwmp_stations: ["4927 Tatipudi Reservoir, Gantyada (2021, 2022, 2024)"],
      color: "#2563eb",
    },
    "yeleru-canal": {
      display_name: "Yeleru Left Main Canal",
      length_km_geom: 154.1,
      description:
        "A supply canal, not a river; CPCB's 2019-2024 tables list no river station in Visakhapatnam. It carries Yeleru reservoir water to GVMC's treatment plants, the steel plant, the pharma city and other industries, topped up with Godavari water: the Purushottapatnam lift sends it to the reservoir, and VIWSCO's 56 km pipeline from Kateru delivers it into the canal. CGWB lists the Godavari and Yeleru system, the city's largest source, at about 190 km from the city. CPCB's one station on the canal, listed as 'Eleru Canal', is near Jawaharlal Nehru Pharma City at Parawada.",
      upstream_terminus: "Yeleru reservoir, which the Purushottapatnam lift tops up with Godavari water",
      downstream_terminus: "Visakhapatnam: GVMC's Narava, Gajuwaka and Aganampudi supply and the steel plant",
      feeds:
        "GVMC's Narava, Gajuwaka and Aganampudi supply, the steel plant, NTPC, Gangavaram Port and APIIC (GVMC supply statement, 11 March 2021). NTPC's draw is for its Simhadri plant (NTPC compliance report, 2021) and APIIC supplies the pharma city from it (APPCB report to the NGT, December 2023)",
      status:
        "Supply canal; no river station in CPCB's 2019-2024 tables. Readings near Pharma City, 2019-2024: DO 4.5 mg/L or more, BOD 3.4 mg/L or less.",
      cpcb_nwmp_stations: ["4356 Eleru (Yeleru) Canal near Pharma City, Parawada (2019-2024)"],
      color: "#0d9488",
    },
  },
};
