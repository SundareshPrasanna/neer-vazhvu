import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  metaDescription:
    "River-system map for Delhi - the Yamuna's 22-km city stretch, the Munak carrier, the Najafgarh and Shahdara drains, with DPCC monthly water-quality status.",
  // Basin-scoped per the Delhi audit: the reach runs Hathnikund -> Palla ->
  // the 22-km city stretch -> Okhla exit, plus the engineered channels
  // (Munak carrier in, Najafgarh/Shahdara drains out).
  header: { scopeLabel: "Yamuna basin scope (Hathnikund to Okhla, with carriers and drains)" },
  riverInfo: {
    yamuna: {
      display_name: "Yamuna",
      display_name_hi: "यमुना नदी",
      length_km_geom: 499,
      description:
        "The one river of Delhi's water story. Enters NCT at Palla meeting bathing-class BOD limits, absorbs the city's drains across the 22-km Wazirabad-Okhla stretch, and exits at Asgarpur with BOD 15-30x the limit and dissolved oxygen at NIL - the 2% of the river's length that carries ~80% of its pollution load. The reach mapped here runs from the Hathnikund barrage (Haryana) to the Okhla exit, the same span the flood page's 36-72 hour lead time is measured over.",
      upstream_terminus: "Hathnikund barrage (Haryana); Delhi entry at Palla",
      downstream_terminus: "Okhla barrage -> Agra canal / downstream Yamuna",
      feeds: "Wazirabad pond (Wazirabad + Chandrawal WTPs); religious and floodplain use",
      status: "DPCC monthly: DO NIL at 5-6 of 8 stations; exit faecal coliform 124-160x max-permissible. HC denied Chhath rituals on the bank (Nov 2024)",
      cpcb_nwmp_stations: [
        "Palla (entry)",
        "Wazirabad",
        "ISBT Bridge",
        "ITO Bridge",
        "Nizamuddin Bridge",
        "Hindon Cut",
        "Okhla Barrage",
        "Asgarpur (exit)",
      ],
      color: "#2563eb",
    },
    wyc_munak: {
      display_name: "Western Yamuna Canal / Munak carrier",
      display_name_hi: "पश्चिमी यमुना नहर (मुनक)",
      length_km_geom: 302,
      description:
        "Not a river but Delhi's lifeline: the WYC system diverts Yamuna water at Hathnikund into Haryana's canal network, and the 102-km Munak carrier (Carrier-Lined Channel + Delhi Sub-Branch) delivers ~70% of Delhi's raw water to the Haiderpur, Nangloi, Bawana, Dwarka and Okhla WTPs. Its flow is fixed on paper (~1,050 cusecs, 2018 Standing Committee) and unmeasured in public - carriage numbers surface only when a crisis reaches court, as in June 2024.",
      upstream_terminus: "Hathnikund barrage / Munak headworks (Haryana)",
      downstream_terminus: "Haiderpur (Delhi); branches to west-Delhi WTPs",
      feeds: "5 of Delhi's 9 WTPs (~70% of raw water)",
      status: "No public flow data - the biggest measurement gap in Delhi's supply (see Allocation Ledger)",
      cpcb_nwmp_stations: [],
      color: "#0891b2",
    },
    najafgarh: {
      display_name: "Najafgarh drain",
      display_name_hi: "नजफ़गढ़ नाला",
      length_km_geom: 57,
      description:
        "The largest single source of the Yamuna's pollution: a 57-km engineered channel carrying roughly two-thirds of Delhi's sewage from the Najafgarh Jheel outfall through west and north Delhi to the river above Wazirabad. It is also a river in disguise - this is the Sahibi's colonial-era drainage channel (see the Sahibi entry). Mission Sahibi (2026) is dredging ~9.1 million cubic metres of silt from its bed; 12 decentralised STPs (Rs 860 cr) are approved along its length.",
      upstream_terminus: "Najafgarh Jheel regulator (Delhi-Haryana border)",
      downstream_terminus: "Yamuna at Wazirabad (Supplementary drain junction)",
      feeds: "Nothing - it drains; with Shahdara it delivers 84% of Delhi's Yamuna load",
      status: "DPCC monthly (May 2026): BOD 64 mg/l vs 30 standard at outfall; subdrains (Mungeshpur, Bupania) run 135-140",
      cpcb_nwmp_stations: [
        "Najafgarh drain outfall",
        "Najafgarh Jheel upstream / downstream",
        "L1 / L2 / L3 subdrains",
        "Mungeshpur drain",
        "Bupania drain",
      ],
      color: "#dc2626",
    },
    sahibi: {
      display_name: "Sahibi (the buried river)",
      display_name_hi: "साहिबी नदी",
      length_km_geom: 52,
      description:
        "The river Delhi forgot it had. The Sahibi rises in Rajasthan's Aravallis, once terminated in the 226-sq-km Najafgarh Jheel, and its lower course was converted into the Najafgarh drain in the 1860s-1960s - which is why OSM maps this reach as 'Sahibi' while Delhi calls it a nala. The mapped geometry here is the surviving named reach; the jheel's 601-ha remnant is the largest water body in NCT.",
      upstream_terminus: "Aravalli hills (Rajasthan/Haryana)",
      downstream_terminus: "Najafgarh Jheel -> Najafgarh drain (engineered continuation)",
      feeds: "Najafgarh Jheel wetland (remnant)",
      status: "Functionally extinguished as a river in Delhi; survives as the drain's alignment and the jheel",
      cpcb_nwmp_stations: [],
      color: "#d97706",
    },
    hindon: {
      display_name: "Hindon (UP tributary)",
      display_name_hi: "हिंडन नदी",
      length_km_geom: 319,
      description:
        "The Yamuna's left-bank tributary through western UP (Saharanpur to Noida), joining below Delhi - and connected to the city by the engineered Hindon Cut, which routes Yamuna water across to the Hindon system. Its own pollution load (Ghaziabad/Noida industry and sewage) re-enters Delhi's reach via the confluence; DPCC monitors the UP outfall drains (Sahibabad, Banthala, Indrapuri) that ride this system into the Shahdara drain.",
      upstream_terminus: "Upper Shivalik foothills (Saharanpur, UP)",
      downstream_terminus: "Yamuna confluence below Okhla (Noida)",
      feeds: "Hindon Cut interlink; UP canal system",
      status: "Severely polluted through Ghaziabad/Noida; UP outfall drains into Delhi's Shahdara system run BOD 95-110 (DPCC May 2026)",
      cpcb_nwmp_stations: ["Hindon Cut (DPCC river station)", "Sahibabad drain", "Banthala drain", "Indrapuri drain"],
      color: "#7c3aed",
    },
  },
};
