import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  sources: {
    gwYearbook: { en: "Source: CGWB observation wells via the India-WRIS Ground Water Level dataset (network stops reporting 20 Sep 2025) + CGWB Dynamic Ground Water Resources 2024-25, assessed by DISTRICT for Delhi rather than by block.", hi: "स्रोत: India-WRIS के माध्यम से CGWB निरीक्षण कूप + CGWB डायनामिक भूजल संसाधन 2024-25 (जिला-स्तर)।" },
    infra: { en: "Source: OSM-traced drains (community-mapped; the IFC 2018 Drainage Master Plan's 3,737 km across 11 agencies is PDF-only). DJB sewer network not public - its OpenCity dataset was delisted." },
    river: { en: "Distance is straight-line from ward centroid to the nearest DPCC monitoring station on the Yamuna. Water quality from DPCC's monthly Yamuna analysis reports." },
  },
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "DJB grievance redressal",
        href: "https://delhijalboard.delhi.gov.in/jalboard/grievance-redressal-mechanism",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Delhi Jal Board",
        href: "https://delhijalboard.delhi.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1916", href: "tel:1916" },
      { labelKey: "my_ward.hl_tanker_booking", value: null, href: "https://djb.gov.in/DJBWaterTanker/" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1077", href: "tel:1077" },
    ],
  },
};
