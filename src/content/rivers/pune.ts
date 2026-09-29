import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  // Five rivers plus the canal that is the other claimant on the same water.
  header: { scopeLabel: "Mula-Mutha system, with the Pavana, Indrayani and the Khadakwasla canal" },
  // Pune. Every BOD figure below is CPCB's own, from the October 2025
  // "Polluted River Stretches for Restoration of Water Quality (Updated
  // Version)": the priority class from Table 3.17 (2022-23 monitoring) and
  // the 2024 readings from Annexure XIV of the same report. The two vintages
  // are labelled separately and never merged - see
  // public/data/river-quality-pune.json.
  //
  // THE FINDING IS THAT THE REPORT CONTRADICTS ITSELF. It records the Mula as
  // IMPROVED (Priority I to II) while its own annexure puts the Mula at
  // Bopodi at 102.5 mg/L in 2024 - the sixth-highest of 756 locations
  // nationally, above the worst Delhi Yamuna station (85.0) and above the
  // Mithi at Mahim (80.0).
  riverInfo: {
    mutha: {
      display_name: "Mutha",
      display_name_mr: "\u092e\u0941\u0920\u093e",
      length_km_geom: 34.9,
      description:
        "Pune's own river, and the one the city drinks. It rises in the Western Ghats behind Temghar, is impounded four times over - Temghar, Warasgaon and Panshet all release into Khadakwasla - and enters the city below the dam. CPCB measured it at 4.1 mg/L of BOD at Khadakwasla in 2024 and at 50.2 mg/L at Veer Savarkar Bhavan, roughly fifteen kilometres downstream. The river does not arrive polluted.",
      upstream_terminus: "Western Ghats above Temghar dam",
      downstream_terminus: "Sangam, where it meets the Mula",
      feeds: "PMC's entire piped supply, via the Khadakwasla chain and the Mutha Right Bank Canal",
      status:
        "CPCB Priority II (2022-23 monitoring), improved from Priority I in 2018. Measured 2024: 4.1 mg/L at Khadakwasla dam, 32.5 at Deccan Bridge, 35.0 at Sangam, 50.2 at Veer Savarkar Bhavan.",
      cpcb_nwmp_stations: [
        "2680 Khadakwasla Dam (4.1 mg/L, 2024)",
        "2679 Deccan Bridge (32.5)",
        "2191 Sangam Bridge, Shivajinagar (35.0)",
        "2678 Veer Savarkar Bhavan (50.2)",
      ],
      color: "#2563eb",
    },
    mula: {
      display_name: "Mula",
      display_name_mr: "\u092e\u0941\u0933\u093e",
      length_km_geom: 57.2,
      description:
        "Comes down from Mulshi, takes the Pavana at Bopodi, and meets the Mutha at the Sangam. At that confluence CPCB recorded 102.5 mg/L of BOD in 2024 - the sixth-highest reading among 756 locations in India, and higher than any Yamuna station CPCB publishes for Delhi. The same report classifies this stretch as improved.",
      upstream_terminus: "Mulshi dam (Tata hydro), Western Ghats",
      downstream_terminus: "Sangam, Pune",
      feeds: "Joins the Mutha to form the Mula-Mutha",
      status:
        "CPCB Priority II (2022-23), down from Priority I in 2018 - while the same report's 2024 annexure records 102.5 mg/L at Bopodi.",
      cpcb_nwmp_stations: [
        "2194 Harrison Bridge, Mula-Pawana Sangam, Bopodi (102.5 mg/L, 2024)",
        "2193 Aundh Bridge (25.6)",
      ],
      color: "#dc2626",
    },
    "mula-mutha": {
      display_name: "Mula-Mutha",
      display_name_mr: "\u092e\u0941\u0933\u093e-\u092e\u0941\u0920\u093e",
      length_km_geom: 36.0,
      description:
        "The combined river below the Sangam, and the one the JICA pollution-abatement programme is named for. PMC generates 980 MLD of sewage against 477 MLD of operating treatment capacity, so roughly 503 MLD - about half the city's sewage - reaches this channel untreated. The eleven plants of the JICA programme would add 396 MLD.",
      upstream_terminus: "Sangam, Pune",
      downstream_terminus: "Bhima confluence near Ranjangaon",
      feeds: "The Bhima, and through it the Krishna",
      status:
        "CPCB Priority II, unchanged since 2018. Measured 2024: 22.0 mg/L at Mundhawa Bridge, 18.4 downstream of Theur.",
      cpcb_nwmp_stations: [
        "2192 Mundhawa Bridge (22.0 mg/L, 2024)",
        "2677 Downstream of Theur (18.4)",
      ],
      color: "#ea580c",
    },
    pavana: {
      display_name: "Pavana",
      display_name_mr: "\u092a\u0935\u0928\u093e",
      length_km_geom: 58.1,
      description:
        "Pimpri-Chinchwad's river and its water supply in one channel. PCMC lifts its raw water from the Ravet intake near the top of this reach and receives the industrial belt's effluent along the rest of it. CPCB's 2024 readings climb steadily downstream: 7.4 mg/L at Ravet weir, 36.0 at Kasarwadi.",
      upstream_terminus: "Pavana dam, Maval",
      downstream_terminus: "Mula confluence at Bopodi/Dapodi",
      feeds: "PCMC's Nigdi Sector 23 treatment plants; then the Mula",
      status:
        "CPCB Priority II, unchanged since 2018. Measured 2024: 7.4 at Ravet Weir, 17.6 Chinchwadgaon, 28.3 Pimprigaon, 30.0 Sangavigaon, 33.0 Dapodi Bridge, 36.0 Kasarwadi.",
      cpcb_nwmp_stations: [
        "2692 Ravet Weir (7.4 mg/L, 2024)",
        "2693 Chinchwadgaon (17.6)",
        "2694 Pimprigaon (28.3)",
        "2196 Sangavigaon (30.0)",
        "2691 Dapodi Bridge (33.0)",
        "2690 Kasarwadi (36.0)",
      ],
      color: "#d97706",
    },
    indrayani: {
      display_name: "Indrayani",
      display_name_mr: "\u0907\u0902\u0926\u094d\u0930\u093e\u092f\u0923\u0940",
      length_km_geom: 61.4,
      description:
        "The pilgrimage river, past Dehu and Alandi, and the one that periodically runs under a metre of white foam at the Alandi ghats. MPCB attributes the foaming to detergent; PCMC attributes it to the Chakan, Dehu and Talegaon industrial estates. No surfactant measurement has been published either way, which is why this page states the dispute rather than settling it.",
      upstream_terminus: "Kurvande, Western Ghats near Lonavala",
      downstream_terminus: "Bhima confluence at Tulapur",
      feeds: "The Bhima",
      status:
        "CPCB Priority III, improved from Priority II in 2018. Measured 2024: 13.2 mg/L above and below Moshi, 16.1 at Alandigaon.",
      cpcb_nwmp_stations: [
        "2669 Upstream Moshigaon (13.2 mg/L, 2024)",
        "2668 Downstream Moshi (13.2)",
        "2197 Alandigaon (16.1)",
      ],
      color: "#059669",
    },
    bhima: {
      display_name: "Bhima",
      display_name_mr: "\u092d\u0940\u092e\u093e",
      length_km_geom: 73.6,
      description:
        "The river everything above eventually drains into, and a Krishna tributary. CPCB files two Pune city stations under the Bhima, and its own label for the first reads \u201cRiver Bhima at Pune (Mutha River)\u201d - the board flagging that the water at Vithalwadi is the Mutha before it is anything else.",
      upstream_terminus: "Bhimashankar, Western Ghats",
      downstream_terminus: "Ujjani reservoir and on to the Krishna",
      feeds: "The Krishna, via Ujjani",
      status:
        "CPCB Priority II in 2025, having been Priority I in 2022. Measured 2024: 32.0 mg/L upstream Vithalwadi, 34.0 downstream Bundgarden.",
      cpcb_nwmp_stations: [
        "1189 Upstream Vithalwadi, Shankar Mandir (32.0 mg/L, 2024)",
        "1190 Downstream Bundgarden, Yerwada (34.0)",
      ],
      color: "#475569",
    },
    ramnadi: {
      display_name: "Ramnadi",
      display_name_mr: "\u0930\u093e\u092e\u0928\u0926\u0940",
      length_km_geom: 15.2,
      description:
        "A 15-km urban stream through Bavdhan, Pashan and Aundh into the Mula. It carries no CPCB station, so it has no published water quality at all - but it is one of the few Pune streams with its own sanctioned Maharashtra WRD flood-line map, which makes it a rare case of a small urban nala being formally mapped.",
      upstream_terminus: "Bhugaon hills, west of the city",
      downstream_terminus: "Mula confluence near Baner",
      feeds: "The Mula",
      status:
        "No CPCB NWMP station and no published water-quality series. Carried here because it is mapped: WRD publishes a sanctioned flood-line sheet for it (Haveli, chainage 0 to 13,600 m).",
      cpcb_nwmp_stations: [],
      color: "#0d9488",
    },
    "mutha-canal": {
      display_name: "Mutha Right Bank Canal",
      display_name_mr: "\u092e\u0941\u0920\u093e \u0909\u091c\u0935\u093e \u0915\u093e\u0932\u0935\u093e",
      length_km_geom: 45.6,
      description:
        "Not a river. This is the irrigation canal that carries Khadakwasla water east to Daund and Indapur, and it is the other claimant in Pune's entitlement dispute: the Khadakwasla Complex is an irrigation project, 22.55 TMC of its 33.77 TMC of use is the irrigation provision, and MWRRA found in 2018 that the farmers on it \u201care deprived of their share\u201d. It is drawn because Pune's water argument is unreadable without it.",
      upstream_terminus: "Khadakwasla dam",
      downstream_terminus: "The Daund and Indapur command",
      feeds: "About 77,000 ha of planned irrigation command",
      status:
        "Infrastructure, not a monitored water body. No CPCB station applies.",
      cpcb_nwmp_stations: [],
      color: "#a16207",
    },
  },
};
