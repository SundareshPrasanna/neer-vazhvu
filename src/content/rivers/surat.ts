import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  header: { scopeLabel: "Lower Tapi and the Mindhola" },
  riverInfo: {
    tapi: {
      display_name: "Tapi",
      color: "#2563eb",
      length_km_geom: 724,
      description:
        "Surat's only raw-water source and its principal flood risk, in the same channel. The city abstracts from a weir-cum-causeway pond at Singanpor; the water that fills it is released from Ukai dam about 100 km upstream, which the Gujarat Water Resources Department operates rather than the corporation. The Tapi is one of only three major peninsular rivers to flow west, and it reaches the Arabian Sea about 20 km past the city.",
      upstream_terminus: "Ukai dam (Tapi district), operated by the Gujarat Water Resources Department",
      downstream_terminus: "Arabian Sea at the Hazira estuary",
      feeds: "All nine SMC zones, via six water works",
      status:
        "The pollution story here is the opposite of the usual one. CPCB's 2022 monitoring finds BOD at or below detection limit at most Surat stations, so the Tapi is not organically polluted through the city. What climbs is conductivity: 369-513 umhos/cm at Ukai, 363-7,656 at Kathore, and 1,537-49,720 at the ONGC bridge at Hazira, which is seawater. Surat's river problem is salinity and the estuary, not sewage.",
      cpcb_nwmp_stations: [
        "Ukai, Sherula Bridge (upstream)",
        "Mandavi",
        "Near Bardoli, Kapp Bridge (Kakrapar)",
        "Kathore, NH-8 Bridge (upstream of Surat)",
        "Surat upstream of Kathore (Limdeshwar Mahadev)",
        "Rander Bridge, Surat",
        "ONGC Bridge, Hazira (estuary)",
      ],
    },
    mindhola: {
      display_name: "Mindhola",
      color: "#c2410c",
      length_km_geom: 130,
      description:
        "The textile belt's river. It runs south of the city past the Sachin and Pandesara industrial estates, where several hundred dyeing and printing houses sit, and it carries what the common effluent treatment plants there discharge. Monitored by CPCB at the state highway bridge at Sachin.",
      upstream_terminus: "Western Ghats foothills, Tapi district",
      downstream_terminus: "Arabian Sea, south of the Tapi mouth",
      feeds: "No municipal abstraction; receives industrial and municipal discharge",
      status:
        "Monitored at one station only. GPCB and the Gujarat Environment Management Institute publish discharge-point monitoring for the Pandesara and Sachin CETPs separately; that series has not yet been ingested here.",
      cpcb_nwmp_stations: ["State Highway Bridge, Sachin"],
    },
  },
};
